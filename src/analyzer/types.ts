export interface GraphNode {
  id: string;
  label: string;
  type: 'module' | 'function' | 'class';
  val?: number; // Size in graph
  color?: string;
  filePath?: string;
  line?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'import' | 'call';
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface AIInsight {
  id: string;
  type: 'refactor' | 'security' | 'maintainability' | 'performance' | 'architecture';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedNodes: string[];
}

export interface EntityCounts {
  modules: number;
  functions: number;
  classes: number;
  dependencies: number;
}

export interface AnalysisResult {
  graph: GraphData;
  insights: AIInsight[];
  entityCounts: EntityCounts;
}
