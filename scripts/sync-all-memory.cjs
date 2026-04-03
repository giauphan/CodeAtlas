const fs = require('fs');
const path = require('path');

const projects = [
  '/home/biibon/Crawler-AI-video-douyin',
  '/home/biibon/auto-edit-video-reup-tool',
  '/home/biibon/game-store'
];

for (const projectDir of projects) {
  const analysisPath = path.join(projectDir, '.codeatlas', 'analysis.json');
  if (!fs.existsSync(analysisPath)) {
    console.log(projectDir + ': NO ANALYSIS - SKIP');
    continue;
  }

  const memoryDir = path.join(projectDir, '.agents', 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });

  const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
  const nodes = analysis.graph.nodes;
  const links = analysis.graph.links;
  const projectName = path.basename(projectDir);

  // --- system-map.md ---
  const modules = nodes.filter(n => n.type === 'module' && n.filePath);
  const classes = nodes.filter(n => n.type === 'class');
  const functions = nodes.filter(n => n.type === 'function');

  let mermaid = 'graph TD\n';
  const nodeSet = new Set();
  let edgeCount = 0;
  const maxEdges = 80;

  for (const link of links) {
    if (edgeCount >= maxEdges) break;
    if (link.type === 'import' || link.type === 'call') {
      const src = String(link.source).replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 30);
      const tgt = String(link.target).replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 30);
      if (src !== tgt) {
        nodeSet.add(src);
        nodeSet.add(tgt);
        const label = link.type === 'import' ? 'imports' : 'calls';
        mermaid += '  ' + src + ' -->|' + label + '| ' + tgt + '\n';
        edgeCount++;
      }
    }
  }

  const systemMap = [
    '# System Map: ' + projectName,
    '',
    'Auto-generated: ' + new Date().toISOString(),
    '',
    '## Architecture',
    '',
    '```mermaid',
    mermaid,
    '```',
    '',
    '## Key Modules',
    '',
    '| Module | Path |',
    '|--------|------|',
    ...modules.slice(0, 30).map(m => '| ' + m.name + ' | ' + (m.filePath || '') + ' |'),
    '',
    '## Stats',
    '- Modules: ' + modules.length,
    '- Classes: ' + classes.length,
    '- Functions: ' + functions.length,
    '- Total nodes: ' + nodes.length,
    '- Total links: ' + links.length,
    ''
  ].join('\n');

  fs.writeFileSync(path.join(memoryDir, 'system-map.md'), systemMap);

  // --- modules.json ---
  const modulesData = modules.slice(0, 100).map(m => {
    const imports = links.filter(l => String(l.source) === m.name && l.type === 'import').map(l => String(l.target));
    const contains = links.filter(l => String(l.source) === m.name && l.type === 'contains').map(l => String(l.target));
    return { name: m.name, path: m.filePath, imports, contains };
  });
  fs.writeFileSync(path.join(memoryDir, 'modules.json'), JSON.stringify(modulesData, null, 2));

  // --- feature-flows.json ---
  const keywords = {};
  for (const n of nodes) {
    if (!n.filePath || !n.name) continue;
    const parts = n.name.toLowerCase().split(/[_.\-\/]/);
    for (const p of parts) {
      if (p.length > 2 && !['the', 'and', 'for', 'get', 'set', 'has', 'init', 'self', 'none', 'true', 'false'].includes(p)) {
        if (!keywords[p]) keywords[p] = new Set();
        keywords[p].add(n.filePath);
      }
    }
  }
  const featureFlows = {};
  for (const [k, v] of Object.entries(keywords)) {
    if (v.size >= 2 && v.size <= 20) {
      featureFlows[k] = [...v];
    }
  }
  fs.writeFileSync(path.join(memoryDir, 'feature-flows.json'), JSON.stringify(featureFlows, null, 2));

  // --- business-rules.json ---
  const brPath = path.join(memoryDir, 'business-rules.json');
  if (!fs.existsSync(brPath)) {
    fs.writeFileSync(brPath, JSON.stringify([], null, 2));
  }

  // --- change-log.json ---
  const clPath = path.join(memoryDir, 'change-log.json');
  if (!fs.existsSync(clPath)) {
    fs.writeFileSync(clPath, JSON.stringify([{
      timestamp: new Date().toISOString(),
      description: 'Initial memory sync'
    }], null, 2));
  }

  // --- conventions.md ---
  const langs = new Set();
  for (const n of nodes) {
    if (n.filePath) {
      const ext = path.extname(n.filePath);
      if (ext) langs.add(ext);
    }
  }
  const conventions = [
    '# Conventions: ' + projectName,
    '',
    'Auto-generated: ' + new Date().toISOString(),
    '',
    '## Languages',
    ...[...langs].map(l => '- ' + l),
    '',
    '## Structure',
    '- Modules: ' + modules.length,
    '- Classes: ' + classes.length,
    '- Functions: ' + functions.length,
    ''
  ].join('\n');
  fs.writeFileSync(path.join(memoryDir, 'conventions.md'), conventions);

  console.log('✅ ' + projectName + ': .agents/memory/ created (' + Object.keys(featureFlows).length + ' features detected)');
}
