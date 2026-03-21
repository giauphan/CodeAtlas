import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import GraphView from './components/GraphView';
import AIInsights from './components/AIInsights';
import EntityOverview from './components/EntityOverview';
import AICopilotChat from './components/AICopilotChat';
import StatusSummary from './components/StatusSummary';
import SearchBar from './components/SearchBar';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    module: true,
    function: true,
    class: true,
    variable: true
  });
  const [searchEnterTrigger, setSearchEnterTrigger] = useState(0);

  const toggleFilter = (type: 'module' | 'function' | 'class' | 'variable') => {
    setActiveFilters(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handleSearchEnter = () => {
    setSearchEnterTrigger(prev => prev + 1);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<number>(0);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'updateAnalysis') {
        setAnalysisData(message.data);
        setLastUpdateTimestamp(Date.now());
        setIsRefreshing(false);
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

  const handleRefresh = () => {
    if (window.vscode) {
      setIsRefreshing(true);
      window.vscode.postMessage({
        command: 'requestAnalysis'
      });
    }
  };

  const handleOpenSettings = () => {
    if (window.vscode) {
      window.vscode.postMessage({ command: 'openSettings' });
    }
  };

  const renderHeader = () => (
    <div className="header-bar">
      <div className="header-left">
        <span className="header-title">🗺️ CodeAtlas</span>
        <button className="refresh-btn" onClick={handleRefresh} title="Refresh Analysis">
          🔄
        </button>
      </div>
      <div className="header-right">
        {!analysisData || isRefreshing ? (
          <div className="header-status">
            <div className="spinner"></div>
            <span>{isRefreshing ? 'Refreshing...' : 'Analyzing...'}</span>
          </div>
        ) : (
          <div className="header-status ready">
            <span className="ready-dot"></span>
            <span>Ready</span>
          </div>
        )}
      </div>
    </div>
  );

  if (!analysisData) {
    return (
      <div className="app-container">
        {renderHeader()}
        <div className="loading-container">
          <div className="skeleton-graph"></div>
          <p className="loading-text">Analyzing Workspace...</p>
        </div>
      </div>
    );
  }

  const entityCount = analysisData.entityCounts.modules + analysisData.entityCounts.functions + analysisData.entityCounts.classes;
  const relationshipCount = analysisData.entityCounts.dependencies;
  const insightsCount = analysisData.insights.length;

  return (
    <div className="app-container">
      {renderHeader()}
      <div className="codeatlas-app">
        <div className="left-panel panel slide-in-1">
          <AIInsights insights={analysisData.insights} />
        </div>
        <div className="center-panel">
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeFilters={activeFilters}
            toggleFilter={toggleFilter}
            onSearchEnter={handleSearchEnter}
          />
          <GraphView
            data={analysisData.graph}
            onNodeClick={handleNodeClick}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            searchEnterTrigger={searchEnterTrigger}
          />
        </div>
        <div className="right-panel panel slide-in-2">
          <EntityOverview counts={analysisData.entityCounts} />
        </div>
        <AICopilotChat graphData={analysisData.graph} counts={analysisData.entityCounts} />
      </div>
      <StatusSummary 
        entityCount={entityCount} 
        relationshipCount={relationshipCount} 
        insightsCount={insightsCount} 
        lastUpdateTimestamp={lastUpdateTimestamp}
      />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
