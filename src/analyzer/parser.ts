import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@typescript-eslint/typescript-estree';
import { GraphData, GraphNode, GraphLink, AnalysisResult, AIInsight } from './types';

export class CodeAnalyzer {
  private workspaceRoot: string;
  private nodes: Map<string, GraphNode> = new Map();
  private links: GraphLink[] = [];

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  public async analyzeProject(): Promise<AnalysisResult> {
    this.nodes.clear();
    this.links = [];

    const files = this.getFiles(this.workspaceRoot);
    
    for (const file of files) {
      this.analyzeFile(file);
    }

    // Add graph layout sizes based on relationships
    this.nodes.forEach(node => {
      let degree = this.links.filter(l => l.source === node.id || l.target === node.id).length;
      node.val = (node.type === 'module' ? 8 : (node.type === 'class' ? 6 : 4)) + Math.log1p(degree) * 2;
    });

    const graph: GraphData = {
      nodes: Array.from(this.nodes.values()),
      links: this.links
    };

    const insights = this.generateAIInsights(graph);

    const counts = {
      modules: Array.from(this.nodes.values()).filter(n => n.type === 'module').length,
      functions: Array.from(this.nodes.values()).filter(n => n.type === 'function').length,
      classes: Array.from(this.nodes.values()).filter(n => n.type === 'class').length,
      dependencies: this.links.filter(l => l.type === 'import').length
    };

    return { graph, insights, entityCounts: counts };
  }

  private getFiles(dir: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      // Skip node_modules and hidden directories
      if (file === 'node_modules' || file.startsWith('.') || file === 'dist' || file === 'out') {
        continue;
      }
      
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        this.getFiles(filePath, fileList);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
        fileList.push(filePath);
      }
    }
    
    return fileList;
  }

  private analyzeFile(filePath: string) {
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(this.workspaceRoot, filePath);
      const moduleId = `module:${relativePath}`;
      
      this.addNode({
        id: moduleId,
        label: path.basename(filePath),
        type: 'module',
        color: '#4cc9f0',
        filePath: filePath,
        line: 1
      });

      const ast = parse(code, {
        loc: true,
        range: true,
        jsx: true
      });

      this.traverseAST(ast, moduleId, filePath);
    } catch (e) {
      console.error(`Failed to parse file: ${filePath}`, e);
    }
  }

  private traverseAST(node: any, currentModuleId: string, filePath: string) {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach(child => this.traverseAST(child, currentModuleId, filePath));
      return;
    }

    if (node.type === 'ImportDeclaration') {
      const importPath = node.source?.value;
      if (typeof importPath === 'string') {
        const targetModuleId = this.resolveImportPath(importPath, filePath);
        this.addLink({
          source: currentModuleId,
          target: targetModuleId,
          type: 'import'
        });
        
        // Ensure target module node exists (even if it's an external module for now)
        if (!this.nodes.has(targetModuleId)) {
          this.addNode({
            id: targetModuleId,
            label: importPath.split('/').pop() || importPath,
            type: 'module',
            color: '#7209b7' // external module color
          });
        }
      }
    }

    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      const funcId = `function:${currentModuleId}:${node.id.name}`;
      this.addNode({
        id: funcId,
        label: node.id.name,
        type: 'function',
        color: '#f72585',
        filePath: filePath,
        line: node.loc?.start?.line
      });
      this.addLink({
        source: currentModuleId,
        target: funcId,
        type: 'import' // using import to mean 'contains' for visualization tree
      });
    }
    
    if (node.type === 'ClassDeclaration' && node.id?.name) {
      const classId = `class:${currentModuleId}:${node.id.name}`;
      this.addNode({
        id: classId,
        label: node.id.name,
        type: 'class',
        color: '#f8961e',
        filePath: filePath,
        line: node.loc?.start?.line
      });
      this.addLink({
        source: currentModuleId,
        target: classId,
        type: 'import' // contains
      });
    }

    // CallExpressions for function calls within another function could be extracted here
    // For simplicity, we just add nodes and simple links for now

    Object.keys(node).forEach(key => {
      if (key !== 'loc' && key !== 'range' && typeof node[key] === 'object') {
        this.traverseAST(node[key], currentModuleId, filePath);
      }
    });
  }

  private resolveImportPath(importPath: string, currentFilePath: string): string {
    if (importPath.startsWith('.')) {
      try {
        const absolutePath = path.resolve(path.dirname(currentFilePath), importPath);
        // This is simplified, real resolution needs to check .ts, .js, /index.ts etc.
        const relativeToWorkspace = path.relative(this.workspaceRoot, absolutePath);
        // Normalize slashes
        return `module:${relativeToWorkspace.replace(/\\/g, '/')}`;
      } catch {
        return `external:${importPath}`;
      }
    }
    return `external:${importPath}`;
  }

  private addNode(node: GraphNode) {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
    }
  }

  private addLink(link: GraphLink) {
    this.links.push(link);
  }

  private generateAIInsights(graph: GraphData): AIInsight[] {
    const insights: AIInsight[] = [];
    
    // Mock AI Insights generation based on simple heuristics
    
    // 1. Large files / God objects
    const modulesWithManyFunctions = Array.from(this.nodes.values()).filter(n => {
      if (n.type !== 'module') return false;
      const functionCount = graph.links.filter(l => l.source === n.id && l.type === 'import' && l.target.startsWith('function')).length;
      return functionCount > 10; // threshold
    });

    if (modulesWithManyFunctions.length > 0) {
      insights.push({
        id: 'i-1',
        type: 'refactor',
        title: 'God Object Detected',
        description: `Found ${modulesWithManyFunctions.length} modules containing a large number of functions. Consider splitting them.`,
        severity: 'high',
        affectedNodes: modulesWithManyFunctions.map(n => n.id)
      });
    }

    // 2. High coupling
    const moduleDependencies = new Map<string, number>();
    graph.links.forEach(l => {
      if (l.type === 'import' && l.source.startsWith('module:') && l.target.startsWith('module:')) {
        moduleDependencies.set(l.source, (moduleDependencies.get(l.source) || 0) + 1);
      }
    });
    
    const highlyCoupled = Array.from(moduleDependencies.entries()).filter(([_, count]) => count > 15).map(([id]) => id);
    if (highlyCoupled.length > 0) {
      insights.push({
        id: 'i-2',
        type: 'architecture',
        title: 'High Coupling',
        description: `Some modules have excessive external dependencies, making them hard to test.`,
        severity: 'medium',
        affectedNodes: highlyCoupled
      });
    }

    // Generic fallback insight if none found
    if (insights.length === 0) {
       insights.push({
        id: 'i-default',
        type: 'maintainability',
        title: 'Clean Architecture',
        description: 'No major structural issues detected in the analyzed scope.',
        severity: 'low',
        affectedNodes: []
      });
    }

    return insights;
  }
}
