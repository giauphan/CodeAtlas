import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import GraphView from './components/GraphView';
import AIInsights from './components/AIInsights';
import EntityOverview from './components/EntityOverview';
import AICopilotChat from './components/AICopilotChat';
import './styles/main.css';
import { AnalysisResult } from '../analyzer/types';

// Mock vscode api for development
declare global {
  interface Window {
    vscode: any;
  }
}

const App = () => {
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'updateAnalysis') {
        setAnalysisData(message.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleNodeClick = (node: any) => {
    if (window.vscode && node.filePath) {
      window.vscode.postMessage({
        command: 'navigateToNode',
        filePath: node.filePath,
        line: node.line
      });
    }
  };

  if (!analysisData) {
    return (
      <div className="loading-container">
        <div className="skeleton-graph"></div>
        <p className="loading-text">Analyzing Workspace...</p>
      </div>
    );
  }

  return (
    <div className="codeatlas-app">
      <div className="left-panel panel slide-in-1">
        <AIInsights insights={analysisData.insights} />
      </div>
      <div className="center-panel">
        <GraphView data={analysisData.graph} onNodeClick={handleNodeClick} />
      </div>
      <div className="right-panel panel slide-in-2">
        <EntityOverview counts={analysisData.entityCounts} />
      </div>
      <AICopilotChat graphData={analysisData.graph} counts={analysisData.entityCounts} />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
