import React, { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GraphData, GraphNode } from '../../analyzer/types';

interface GraphViewProps {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
}

const GraphView: React.FC<GraphViewProps> = ({ data, onNodeClick }) => {
  const fgRef = useRef<any>();
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);

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
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Inter, sans-serif`;
    
    // Draw glow effect if hovered
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.val + 2, 0, 2 * Math.PI, false);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
    }

    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = node.color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.restore();
    
    // Node border
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1 / globalScale;
    ctx.stroke();

    if (isHovered || globalScale > 1.5) {
      const textWidth = ctx.measureText(label).width;
      const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - node.val - fontSize - 2 - bckgDimensions[1]/2, bckgDimensions[0], bckgDimensions[1]);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(label, node.x, node.y - node.val - fontSize - 2);
    }
  };

  return (
    <div className="graph-container">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeLabel="label"
        nodeColor="color"
        nodeVal="val"
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        nodeCanvasObject={drawNode}
        onNodeHover={(node) => setHoverNode(node as GraphNode)}
        onNodeClick={(node) => onNodeClick(node as GraphNode)}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={(link: any) => link.type === 'call' ? 4 : 0}
        linkDirectionalParticleSpeed={(link: any) => link.type === 'call' ? 0.02 : 0.01}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        backgroundColor="transparent"
      />
      
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.5)}>+</button>
        <button className="zoom-btn" onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.5)}>-</button>
        <button className="zoom-btn" onClick={() => fgRef.current?.zoomToFit(400)}>⊞</button>
      </div>
    </div>
  );
};

export default GraphView;
