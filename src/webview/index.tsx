import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import GraphView from './components/GraphView';
import AIInsights from './components/AIInsights';
import EntityOverview from './components/EntityOverview';
import AICopilotChat from './components/AICopilotChat';
import StatusSummary from './components/StatusSummary';
import SearchBar from './components/SearchBar';
import LoadControls from './components/LoadControls';
import './styles/main.css';
import { AnalysisResult, AnalysisManifest, GraphData, GraphNode, GraphLink } from '../analyzer/types';

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
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Progressive loading state
  const [manifest, setManifest] = useState<AnalysisManifest | null>(null);
  const [isProgressiveMode, setIsProgressiveMode] = useState(false);
  const [loadedNodeCount, setLoadedNodeCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentGraph, setCurrentGraph] = useState<GraphData>({ nodes: [], links: [] });

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
      switch (message.command) {
        case 'updateAnalysis':
          // Full data (small project or load-all response)
          setAnalysisData(message.data);
          setCurrentGraph(message.data.graph);
          setLoadedNodeCount(message.data.graph.nodes.length);
          setIsProgressiveMode(false);
          setManifest(null);
          setLastUpdateTimestamp(Date.now());
          setIsRefreshing(false);
          setIsLoadingMore(false);
          break;

        case 'initialLoad':
          // Progressive loading: initial subset
          const initData = message.data;
          setManifest(initData.manifest);
          setIsProgressiveMode(true);
          setCurrentGraph(initData.initialGraph);
          setLoadedNodeCount(initData.initialGraph.nodes.length);
          // Build a partial AnalysisResult for UI compatibility
          setAnalysisData({
            graph: initData.initialGraph,
            insights: initData.manifest.insights,
            entityCounts: initData.manifest.entityCounts,
            totalFilesAnalyzed: initData.manifest.totalFiles - initData.manifest.totalFilesSkipped,
            totalFilesSkipped: initData.manifest.totalFilesSkipped
          });
          setLastUpdateTimestamp(Date.now());
          setIsRefreshing(false);
          break;

        case 'appendNodes':
          // Incremental load response
          setCurrentGraph(prev => {
            const existingNodeIds = new Set(prev.nodes.map(n => n.id));
            const newNodes = (message.nodes as GraphNode[]).filter(n => !existingNodeIds.has(n.id));
            const updatedNodes = [...prev.nodes, ...newNodes];
            
            const existingLinkKeys = new Set(prev.links.map(l => `${l.source}-${l.target}`));
            const newLinks = (message.links as GraphLink[]).filter(l => !existingLinkKeys.has(`${l.source}-${l.target}`));
            const updatedLinks = [...prev.links, ...newLinks];
            
            const updatedGraph = { nodes: updatedNodes, links: updatedLinks };
            
            // Update analysisData to sync with new graph
            setAnalysisData(prevData => prevData ? {
              ...prevData,
              graph: updatedGraph
            } : null);
            
            setLoadedNodeCount(updatedNodes.length);
            return updatedGraph;
          });
          setIsLoadingMore(false);
          setLastUpdateTimestamp(Date.now());
          break;

        case 'appendChunk':
          // Folder chunk append
          setCurrentGraph(prev => {
            const existingNodeIds = new Set(prev.nodes.map(n => n.id));
            const newNodes = (message.chunk.nodes as GraphNode[]).filter(n => !existingNodeIds.has(n.id));
            const allLinks = [...(message.chunk.links || []), ...(message.crossLinks || [])];
            const existingLinkKeys = new Set(prev.links.map(l => `${l.source}-${l.target}`));
            const newLinks = allLinks.filter((l: GraphLink) => !existingLinkKeys.has(`${l.source}-${l.target}`));
            
            const updatedNodes = [...prev.nodes, ...newNodes];
            const updatedLinks = [...prev.links, ...newLinks];
            const updatedGraph = { nodes: updatedNodes, links: updatedLinks };
            
            setAnalysisData(prevData => prevData ? {
              ...prevData,
              graph: updatedGraph
            } : null);
            
            setLoadedNodeCount(updatedNodes.length);
            return updatedGraph;
          });
          setIsLoadingMore(false);
          setLastUpdateTimestamp(Date.now());
          break;

        case 'updateGraphPhysics':
          // Handled by GraphView internally if needed
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Signal to extension host that React is ready to receive data
    if (window.vscode) {
      window.vscode.postMessage({ command: 'webviewReady' });
    }

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

  const handleLoadMore = useCallback(() => {
    if (window.vscode && !isLoadingMore) {
      setIsLoadingMore(true);
      window.vscode.postMessage({
        command: 'loadMore',
        currentCount: loadedNodeCount,
        batchSize: 100
      });
    }
  }, [loadedNodeCount, isLoadingMore]);

  const handleLoadAll = useCallback(() => {
    if (window.vscode && !isLoadingMore) {
      setIsLoadingMore(true);
      window.vscode.postMessage({
        command: 'loadAll'
      });
    }
  }, [isLoadingMore]);

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
            {isProgressiveMode && manifest && (
              <span className="progressive-badge" title="Progressive loading active">
                ⚡ {loadedNodeCount}/{manifest.totalNodes}
              </span>
            )}
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
      {/* Progressive loading controls */}
      {isProgressiveMode && manifest && (
        <LoadControls
          manifest={manifest}
          loadedCount={loadedNodeCount}
          isLoadingMore={isLoadingMore}
          onLoadMore={handleLoadMore}
          onLoadAll={handleLoadAll}
        />
      )}
      <div className="codeatlas-app">
        {/* Left panel toggle */}
        <button
          className={`panel-toggle panel-toggle-left ${showLeftPanel ? '' : 'collapsed'}`}
          onClick={() => setShowLeftPanel(!showLeftPanel)}
          title={showLeftPanel ? 'Hide AI Insights' : 'Show AI Insights'}
        >
          {showLeftPanel ? '◀' : '▶'}
        </button>
        <div className={`left-panel panel ${showLeftPanel ? 'slide-in-1' : 'panel-hidden'}`}>
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
            data={currentGraph}
            onNodeClick={handleNodeClick}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            searchEnterTrigger={searchEnterTrigger}
          />
        </div>
        <div className={`right-panel panel ${showRightPanel ? 'slide-in-2' : 'panel-hidden'}`}>
          <EntityOverview counts={analysisData.entityCounts} />
        </div>
        {/* Right panel toggle */}
        <button
          className={`panel-toggle panel-toggle-right ${showRightPanel ? '' : 'collapsed'}`}
          onClick={() => setShowRightPanel(!showRightPanel)}
          title={showRightPanel ? 'Hide Entity Overview' : 'Show Entity Overview'}
        >
          {showRightPanel ? '▶' : '◀'}
        </button>
        <AICopilotChat graphData={currentGraph} counts={analysisData.entityCounts} />
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
