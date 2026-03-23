#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  color?: string;
  filePath?: string;
  line?: number;
  val?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
}

interface AnalysisResult {
  graph: { nodes: GraphNode[]; links: GraphLink[] };
  insights: any[];
  stats: { files: number; functions: number; classes: number; dependencies: number; circularDeps: number };
}

// Auto-discover all projects with .codeatlas/analysis.json
function discoverProjects(): { name: string; dir: string; analysisPath: string; modifiedAt: Date }[] {
  const projects: { name: string; dir: string; analysisPath: string; modifiedAt: Date }[] = [];
  const homeDir = process.env.HOME || process.env.USERPROFILE || "/home";

  // Scan directories for .codeatlas/analysis.json
  const searchDirs: string[] = [];

  // Add env var project if specified
  if (process.env.CODEATLAS_PROJECT_DIR) {
    searchDirs.push(process.env.CODEATLAS_PROJECT_DIR);
  }

  // Add cwd
  searchDirs.push(process.cwd());

  // Scan home directory children (max depth 2)
  try {
    const homeDirs = fs.readdirSync(homeDir);
    for (const d of homeDirs) {
      if (d.startsWith(".")) continue;
      const fullPath = path.join(homeDir, d);
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          searchDirs.push(fullPath);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  // Check each directory for .codeatlas/analysis.json
  const seen = new Set<string>();
  for (const dir of searchDirs) {
    const analysisPath = path.join(dir, ".codeatlas", "analysis.json");
    if (seen.has(analysisPath)) continue;
    seen.add(analysisPath);

    if (fs.existsSync(analysisPath)) {
      try {
        const stat = fs.statSync(analysisPath);
        projects.push({
          name: path.basename(dir),
          dir,
          analysisPath,
          modifiedAt: stat.mtime,
        });
      } catch { /* skip */ }
    }
  }

  // Sort by most recently modified
  projects.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  return projects;
}

function loadAnalysis(projectDir?: string): { analysis: AnalysisResult; projectName: string; projectDir: string } | null {
  const projects = discoverProjects();
  if (projects.length === 0) return null;

  let target = projects[0]; // default: most recently modified

  if (projectDir) {
    const match = projects.find(
      (p) => p.dir === projectDir || p.name.toLowerCase() === projectDir.toLowerCase()
    );
    if (match) target = match;
  }

  try {
    const data = fs.readFileSync(target.analysisPath, "utf-8");
    return { analysis: JSON.parse(data), projectName: target.name, projectDir: target.dir };
  } catch {
    return null;
  }
}

// Create MCP server
const server = new McpServer({
  name: "codeatlas",
  version: "1.2.2",
});

// Tool 0: List all discovered projects
server.tool(
  "list_projects",
  "List all projects that have been analyzed by CodeAtlas. Returns project names, paths, and last analysis time.",
  {},
  async () => {
    const projects = discoverProjects();
    if (projects.length === 0) {
      return { content: [{ type: "text" as const, text: "No analyzed projects found. Run 'CodeAtlas: Analyze Project' in VS Code first." }] };
    }

    const result = {
      projectCount: projects.length,
      projects: projects.map((p) => ({
        name: p.name,
        path: p.dir,
        lastAnalyzed: p.modifiedAt.toISOString(),
      })),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 1: Get project structure
server.tool(
  "get_project_structure",
  "Get all modules, classes, functions, and variables in the analyzed project. Returns entity type, name, file path, and line number.",
  {
    project: z.string().optional().describe("Project name or path (auto-detects if omitted)"),
    type: z.enum(["all", "module", "class", "function", "variable"]).optional().describe("Filter by entity type"),
    limit: z.number().optional().describe("Max results to return (default: 100)"),
  },
  async ({ project, type, limit }) => {
    const loaded = loadAnalysis(project);
    if (!loaded) {
      return { content: [{ type: "text" as const, text: "No analysis data found. Run 'CodeAtlas: Analyze Project' in VS Code first." }] };
    }

    let nodes = loaded.analysis.graph.nodes;
    if (type && type !== "all") {
      nodes = nodes.filter((n) => n.type === type);
    }

    const maxResults = limit || 100;
    const truncated = nodes.length > maxResults;
    nodes = nodes.slice(0, maxResults);

    const result = {
      project: loaded.projectName,
      projectDir: loaded.projectDir,
      total: loaded.analysis.graph.nodes.length,
      showing: nodes.length,
      truncated,
      stats: loaded.analysis.stats,
      entities: nodes.map((n) => ({
        name: n.label,
        type: n.type,
        filePath: n.filePath || null,
        line: n.line || null,
      })),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 2: Get dependencies
server.tool(
  "get_dependencies",
  "Get import/call/containment relationships between entities. Shows how modules, classes, and functions are connected.",
  {
    project: z.string().optional().describe("Project name or path"),
    source: z.string().optional().describe("Filter by source entity name"),
    target: z.string().optional().describe("Filter by target entity name"),
    relationship: z.enum(["all", "import", "call", "contains"]).optional().describe("Filter by relationship type"),
    limit: z.number().optional().describe("Max results (default: 100)"),
  },
  async ({ project, source, target, relationship, limit }) => {
    const loaded = loadAnalysis(project);
    if (!loaded) {
      return { content: [{ type: "text" as const, text: "No analysis data found. Run 'CodeAtlas: Analyze Project' first." }] };
    }

    const nodeMap = new Map(loaded.analysis.graph.nodes.map((n) => [n.id, n.label]));
    let links = loaded.analysis.graph.links;

    if (relationship && relationship !== "all") {
      links = links.filter((l) => l.type === relationship);
    }
    if (source) {
      links = links.filter((l) => {
        const label = nodeMap.get(l.source) || l.source;
        return label.toLowerCase().includes(source.toLowerCase());
      });
    }
    if (target) {
      links = links.filter((l) => {
        const label = nodeMap.get(l.target) || l.target;
        return label.toLowerCase().includes(target.toLowerCase());
      });
    }

    const maxResults = limit || 100;
    const truncated = links.length > maxResults;
    links = links.slice(0, maxResults);

    const result = {
      total: loaded.analysis.graph.links.length,
      showing: links.length,
      truncated,
      dependencies: links.map((l) => ({
        source: nodeMap.get(l.source) || l.source,
        target: nodeMap.get(l.target) || l.target,
        type: l.type,
      })),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 3: Get AI insights
server.tool(
  "get_insights",
  "Get AI-generated code insights including refactoring suggestions, security issues, and maintainability analysis.",
  {},
  async () => {
    const loaded = loadAnalysis();
    if (!loaded) {
      return { content: [{ type: "text" as const, text: "No analysis data found. Run 'CodeAtlas: Analyze Project' first." }] };
    }

    const result = {
      project: loaded.projectName,
      stats: loaded.analysis.stats,
      insights: loaded.analysis.insights,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 4: Search entities
server.tool(
  "search_entities",
  "Search for functions, classes, modules, or variables by name. Supports fuzzy matching.",
  {
    project: z.string().optional().describe("Project name or path"),
    query: z.string().describe("Search query (case-insensitive, partial match)"),
    type: z.enum(["all", "module", "class", "function", "variable"]).optional().describe("Filter by entity type"),
  },
  async ({ project, query, type }) => {
    const loaded = loadAnalysis(project);
    if (!loaded) {
      return { content: [{ type: "text" as const, text: "No analysis data found. Run 'CodeAtlas: Analyze Project' first." }] };
    }

    let nodes = loaded.analysis.graph.nodes;
    if (type && type !== "all") {
      nodes = nodes.filter((n) => n.type === type);
    }

    const q = query.toLowerCase();
    const matches = nodes.filter((n) => n.label.toLowerCase().includes(q));

    // For each match, find its relationships
    const links = loaded.analysis.graph.links;
    const nodeMap = new Map(loaded.analysis.graph.nodes.map((n) => [n.id, n.label]));

    const result = {
      query,
      matchCount: matches.length,
      results: matches.slice(0, 50).map((n) => {
        const incomingLinks = links
          .filter((l) => l.target === n.id)
          .map((l) => ({ from: nodeMap.get(l.source) || l.source, type: l.type }));
        const outgoingLinks = links
          .filter((l) => l.source === n.id)
          .map((l) => ({ to: nodeMap.get(l.target) || l.target, type: l.type }));

        return {
          name: n.label,
          type: n.type,
          filePath: n.filePath || null,
          line: n.line || null,
          incomingRelationships: incomingLinks,
          outgoingRelationships: outgoingLinks,
        };
      }),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 5: Get file entities
server.tool(
  "get_file_entities",
  "Get all entities (classes, functions, variables) defined in a specific file.",
  {
    project: z.string().optional().describe("Project name or path"),
    filePath: z.string().describe("File path (partial match, e.g. 'User.php' or 'src/models')"),
  },
  async ({ project, filePath }) => {
    const loaded = loadAnalysis(project);
    if (!loaded) {
      return { content: [{ type: "text" as const, text: "No analysis data found. Run 'CodeAtlas: Analyze Project' first." }] };
    }

    const q = filePath.toLowerCase().replace(/\\/g, "/");
    const matches = loaded.analysis.graph.nodes.filter((n) => {
      const fp = (n.filePath || n.id).toLowerCase().replace(/\\/g, "/");
      return fp.includes(q);
    });

    const links = loaded.analysis.graph.links;
    const nodeMap = new Map(loaded.analysis.graph.nodes.map((n) => [n.id, n.label]));

    // Group by file
    const byFile = new Map<string, typeof matches>();
    for (const n of matches) {
      const fp = n.filePath || "unknown";
      if (!byFile.has(fp)) byFile.set(fp, []);
      byFile.get(fp)!.push(n);
    }

    const result = {
      query: filePath,
      filesFound: byFile.size,
      files: Array.from(byFile.entries()).map(([fp, entities]) => ({
        filePath: fp,
        entities: entities.map((e) => ({
          name: e.label,
          type: e.type,
          line: e.line || null,
          dependencies: links
            .filter((l) => l.source === e.id)
            .map((l) => ({ to: nodeMap.get(l.target) || l.target, type: l.type })),
        })),
      })),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CodeAtlas MCP server running on stdio");
}

main().catch(console.error);
