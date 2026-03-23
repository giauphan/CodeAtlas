import React, { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GraphData, GraphNode } from '../../analyzer/types';

interface GraphViewProps {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  searchQuery?: string;
  activeFilters?: {
    module: boolean;
    function: boolean;
    class: boolean;
    variable: boolean;
  };
  searchEnterTrigger?: number;
}

const GraphView: React.FC<GraphViewProps> = ({
  data,
  onNodeClick,
  searchQuery = '',
  activeFilters = { module: true, function: true, class: true, variable: true },
  searchEnterTrigger = 0
}) => {
  const fgRef = useRef<any>();
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);

  // Performance thresholds
  const nodeCount = data.nodes.length;
  const isLargeGraph = nodeCount > 500;
  const isVeryLargeGraph = nodeCount > 1000;

  // Filter graph data based on active filters
  const [filteredData, setFilteredData] = useState<GraphData>({ nodes: [], links: [] });

  useEffect(() => {
    const visibleNodes = data.nodes.filter(node => activeFilters[node.type as keyof typeof activeFilters]);
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

    // Some implementations of ForceGraph2D mutate links to replace source/target strings with node object references.
    // We handle both cases here.
    const visibleLinks = data.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });

    setFilteredData({
      nodes: visibleNodes,
      links: visibleLinks
    });
  }, [data, activeFilters]);

  // Handle search enter to zoom to node
  useEffect(() => {
    if (searchEnterTrigger > 0 && searchQuery && fgRef.current) {
      const q = searchQuery.toLowerCase();
      const match = filteredData.nodes.find(n => n.label.toLowerCase().includes(q));
      if (match && (match as any).x !== undefined && (match as any).y !== undefined) {
        // Zoom to the matched node
        fgRef.current.centerAt((match as any).x, (match as any).y, 1000);
        fgRef.current.zoom(4, 1000);
      }
    }
  }, [searchEnterTrigger, searchQuery, filteredData]);

  useEffect(() => {
    // Zoom to fit on initial load
    if (fgRef.current && data.nodes.length > 0) {
      setTimeout(() => {
        fgRef.current.zoomToFit(400, 50);
      }, 500);
    }
  }, [data]);

  const getLinkColor = (link: any) => {
    return link.type === 'import' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(247, 37, 133, 0.4)';
  };

  const getLinkWidth = (link: any) => {
    return link.type === 'import' ? 1 : 2;
  };

  const drawNode = (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.label;
    const isHovered = hoverNode === node;

    // Determine if node matches search query
    const isSearchActive = searchQuery.trim().length > 0;
    const isMatch = isSearchActive && label.toLowerCase().includes(searchQuery.toLowerCase());

    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Inter, sans-serif`;
    
    // Base node value
    const baseVal = node.val || 5;
    const nodeVal = isMatch ? baseVal + 3 : baseVal;

    // Set opacity based on search
    ctx.globalAlpha = (isSearchActive && !isMatch) ? 0.2 : 1;

    // Draw glow effect if hovered or matched (skip for very large graphs unless hovered)
    if (isHovered || (isMatch && !isVeryLargeGraph)) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeVal + 2, 0, 2 * Math.PI, false);
      ctx.fillStyle = isMatch ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
    }

    // Reduce shadow complexity for large graphs
    ctx.save();
    if (!isLargeGraph) {
      ctx.shadowBlur = isMatch ? 25 : 15;
      ctx.shadowColor = isMatch ? '#fff' : node.color;
    }
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeVal, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.restore();
    
    // Node border
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1 / globalScale;
    ctx.stroke();

    // Show labels: always for hovered/matched, conditionally for zoom level
    // For large graphs, only show labels when zoomed in more
    const labelZoomThreshold = isLargeGraph ? 2.5 : 1.5;
    if (isHovered || isMatch || globalScale > labelZoomThreshold) {
      const textWidth = ctx.measureText(label).width;
      const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - nodeVal - fontSize - 2 - bckgDimensions[1]/2, bckgDimensions[0], bckgDimensions[1]);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, node.x, node.y - nodeVal - fontSize - 2);
    }

    // Reset globalAlpha
    ctx.globalAlpha = 1;
  };

  // Node click handler with zooming
  const handleNodeClick = (node: GraphNode) => {
    if (fgRef.current && (node as any).x !== undefined && (node as any).y !== undefined) {
      fgRef.current.centerAt((node as any).x, (node as any).y, 1000);
      fgRef.current.zoom(4, 1000);
    }
    onNodeClick(node);
  };

  // Dynamic physics based on graph size
  const d3AlphaDecay = isVeryLargeGraph ? 0.05 : isLargeGraph ? 0.03 : 0.02;
  const d3VelocityDecay = isVeryLargeGraph ? 0.5 : isLargeGraph ? 0.4 : 0.3;
  const warmupTicks = isVeryLargeGraph ? 100 : isLargeGraph ? 50 : 0;

  return (
    <div className="graph-container">
      <ForceGraph2D
        ref={fgRef}
        graphData={filteredData}
        nodeLabel="label"
        nodeColor="color"
        nodeVal="val"
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        nodeCanvasObject={drawNode}
        onNodeHover={(node) => setHoverNode(node as GraphNode)}
        onNodeClick={(node) => handleNodeClick(node as GraphNode)}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={isLargeGraph ? 0 : (link: any) => link.type === 'call' ? 4 : 0}
        linkDirectionalParticleSpeed={isLargeGraph ? 0 : (link: any) => link.type === 'call' ? 0.02 : 0.01}
        d3AlphaDecay={d3AlphaDecay}
        d3VelocityDecay={d3VelocityDecay}
        warmupTicks={warmupTicks}
        backgroundColor="transparent"
      />
      
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.5)}>+</button>
        <button className="zoom-btn" onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.5)}>-</button>
        <button className="zoom-btn" onClick={() => fgRef.current?.zoomToFit(400)}>⊞</button>
      </div>

      {/* Node count indicator */}
      {isLargeGraph && (
        <div className="graph-perf-indicator">
          ⚡ {filteredData.nodes.length} nodes
        </div>
      )}
    </div>
  );
};

export default GraphView;
