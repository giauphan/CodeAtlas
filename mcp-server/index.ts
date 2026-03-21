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

// Find the analysis.json in current working directory or parent dirs
function findAnalysisFile(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, ".codeatlas", "analysis.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadAnalysis(): AnalysisResult | null {
  const filePath = findAnalysisFile();
  if (!filePath) return null;
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Create MCP server
const server = new McpServer({
  name: "codeatlas",
  version: "1.1.2",
});

// Tool 1: Get project structure
server.tool(
  "get_project_structure",
  "Get all modules, classes, functions, and variables in the analyzed project. Returns entity type, name, file path, and line number.",
  {
    type: z.enum(["all", "module", "class", "function", "variable"]).optional().describe("Filter by entity type"),
    limit: z.number().optional().describe("Max results to return (default: 100)"),
  },
  async ({ type, limit }) => {
    const analysis = loadAnalysis();
    if (!analysis) {
      return { content: [{ type: "text" as const, text: "No analysis data found. Run 'CodeAtlas: Analyze Project' in VS Code first." }] };
    }

    let nodes = analysis.graph.nodes;
    if (type && type !== "all") {
      nodes = nodes.filter((n) => n.type === type);
    }

    const maxResults = limit || 100;
    const truncated = nodes.length > maxResults;
    nodes = nodes.slice(0, maxResults);

    const result = {
      total: analysis.graph.nodes.length,
      showing: nodes.length,
      truncated,
      stats: analysis.stats,
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
    source: z.string().optional().describe("Filter by source entity name"),
    target: z.string().optional().describe("Filter by target entity name"),
    relationship: z.enum(["all", "import", "call", "contains"]).optional().describe("Filter by relationship type"),
    limit: z.number().optional().describe("Max results (default: 100)"),
  },
  async ({ source, target, relationship, limit }) => {
    const analysis = loadAnalysis();
    if (!analysis) {
      return { content: [{ type: "text" as const, text: "No analysis data found. Run 'CodeAtlas: Analyze Project' first." }] };
    }

    const nodeMap = new Map(analysis.graph.nodes.map((n) => [n.id, n.label]));
    let links = analysis.graph.links;

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
      total: analysis.graph.links.length,
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
    const analysis = loadAnalysis();
    if (!analysis) {
      return { content: [{ type: "text" as const, text: "No analysis data found. Run 'CodeAtlas: Analyze Project' first." }] };
    }

    const result = {
      stats: analysis.stats,
      insights: analysis.insights,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 4: Search entities
server.tool(
  "search_entities",
  "Search for functions, classes, modules, or variables by name. Supports fuzzy matching.",
  {
    query: z.string().describe("Search query (case-insensitive, partial match)"),
    type: z.enum(["all", "module", "class", "function", "variable"]).optional().describe("Filter by entity type"),
  },
  async ({ query, type }) => {
    const analysis = loadAnalysis();
    if (!analysis) {
      return { content: [{ type: "text" as const, text: "No analysis data found. Run 'CodeAtlas: Analyze Project' first." }] };
    }

    let nodes = analysis.graph.nodes;
    if (type && type !== "all") {
      nodes = nodes.filter((n) => n.type === type);
    }

    const q = query.toLowerCase();
    const matches = nodes.filter((n) => n.label.toLowerCase().includes(q));

    // For each match, find its relationships
    const links = analysis.graph.links;
    const nodeMap = new Map(analysis.graph.nodes.map((n) => [n.id, n.label]));

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
    filePath: z.string().describe("File path (partial match, e.g. 'User.php' or 'src/models')"),
  },
  async ({ filePath }) => {
    const analysis = loadAnalysis();
    if (!analysis) {
      return { content: [{ type: "text" as const, text: "No analysis data found. Run 'CodeAtlas: Analyze Project' first." }] };
    }

    const q = filePath.toLowerCase().replace(/\\/g, "/");
    const matches = analysis.graph.nodes.filter((n) => {
      const fp = (n.filePath || n.id).toLowerCase().replace(/\\/g, "/");
      return fp.includes(q);
    });

    const links = analysis.graph.links;
    const nodeMap = new Map(analysis.graph.nodes.map((n) => [n.id, n.label]));

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
