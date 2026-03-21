import * as assert from 'assert';
import * as path from 'path';
import { CodeAnalyzer } from '../analyzer/parser';

async function runTests() {
  console.log('Running CodeAnalyzer tests...');
  const workspaceRoot = path.resolve(__dirname, 'fixtures');
  const analyzer = new CodeAnalyzer(workspaceRoot);

  const result = await analyzer.analyzeProject();
  const { graph, entityCounts, totalFilesAnalyzed, totalFilesSkipped } = result;

  // Helpers
  const nodes = graph.nodes;
  const links = graph.links;

  console.log('--- Test 1: ASTParser correctly extracts entities from sample.ts ---');
  // Should find 2 class nodes (User, Admin)
  const classNodes = nodes.filter(n => n.type === 'class');
  assert.strictEqual(classNodes.length, 2, 'Should find 2 class nodes');
  assert.ok(classNodes.some(n => n.label === 'User'), 'Should find User class');
  assert.ok(classNodes.some(n => n.label === 'Admin'), 'Should find Admin class');

  // Should find 3+ function nodes (including arrow functions)
  // Functions: add, multiply, incrementCount
  const functionNodes = nodes.filter(n => n.type === 'function');
  assert.ok(functionNodes.length >= 3, 'Should find at least 3 function nodes');
  assert.ok(functionNodes.some(n => n.label === 'add'), 'Should find add function');
  assert.ok(functionNodes.some(n => n.label === 'multiply'), 'Should find multiply function');
  assert.ok(functionNodes.some(n => n.label === 'incrementCount'), 'Should find incrementCount function');

  // Should find module nodes for each file
  const moduleNodes = nodes.filter(n => n.type === 'module');
  assert.ok(moduleNodes.length >= 4, 'Should find module nodes for each valid file (sample, moduleA, moduleB, empty)');

  console.log('--- Test 2: GraphTransformer produces correct links ---');
  // Check import links
  assert.ok(links.some(l => l.type === 'import'), 'Should have import links');

  // Link sources and targets should be valid node IDs
  const nodeIds = new Set(nodes.map(n => n.id));
  links.forEach(link => {
    assert.ok(nodeIds.has(link.source), `Link source ${link.source} should be a valid node ID`);
    assert.ok(nodeIds.has(link.target), `Link target ${link.target} should be a valid node ID`);
  });

  console.log('--- Test 3: Circular dependency detection ---');
  // Detect cycle between moduleA and moduleB
  // moduleA imports from moduleB, moduleB imports from moduleA
  // In the current implementation, links go from source to target.
  const aToB = links.find(l => l.source === 'module:moduleA.ts' && l.target === 'module:moduleB.ts');
  const bToA = links.find(l => l.source === 'module:moduleB.ts' && l.target === 'module:moduleA.ts');
  assert.ok(aToB, 'Should detect import from moduleA to moduleB');
  assert.ok(bToA, 'Should detect import from moduleB to moduleA');

  console.log('--- Test 4: Empty file handling ---');
  // Should not crash on empty .ts file
  assert.ok(nodes.some(n => n.label === 'empty.ts'), 'Should process empty.ts without crashing');

  console.log('--- Test 5: Syntax error handling ---');
  // Should skip file with syntax errors and continue
  // Our syntaxError.ts is an invalid file, it should be skipped.
  assert.ok(totalFilesSkipped > 0, 'Should skip at least one file due to syntax errors');
  assert.ok(!nodes.some(n => n.label === 'syntaxError.ts'), 'Should not include syntaxError.ts module if parsing failed');

  console.log('All tests passed!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
