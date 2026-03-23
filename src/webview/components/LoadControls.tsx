import React from 'react';
import { AnalysisManifest, FolderInfo } from '../../analyzer/types';

interface LoadControlsProps {
  manifest: AnalysisManifest;
  loadedCount: number;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onLoadAll: () => void;
}

const LoadControls: React.FC<LoadControlsProps> = ({
  manifest,
  loadedCount,
  isLoadingMore,
  onLoadMore,
  onLoadAll
}) => {
  const totalNodes = manifest.totalNodes;
  const percentage = Math.round((loadedCount / totalNodes) * 100);
  const remaining = totalNodes - loadedCount;
  const isFullyLoaded = loadedCount >= totalNodes;

  if (isFullyLoaded) {
    return null;
  }

  return (
    <div className="load-controls">
      <div className="load-progress">
        <div className="load-progress-bar">
          <div 
            className="load-progress-fill" 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="load-progress-text">
          {loadedCount.toLocaleString()} / {totalNodes.toLocaleString()} nodes ({percentage}%)
        </span>
      </div>
      <div className="load-actions">
        <button 
          className="load-btn load-more-btn"
          onClick={onLoadMore}
          disabled={isLoadingMore || isFullyLoaded}
          title="Load next 100 nodes"
        >
          {isLoadingMore ? (
            <>
              <span className="btn-spinner" />
              Loading...
            </>
          ) : (
            <>📦 Load More ({Math.min(100, remaining)})</>
          )}
        </button>
        <button 
          className="load-btn load-all-btn"
          onClick={() => {
            if (remaining > 1000) {
              if (confirm(`Loading all ${remaining.toLocaleString()} remaining nodes may cause performance issues. Continue?`)) {
                onLoadAll();
              }
            } else {
              onLoadAll();
            }
          }}
          disabled={isLoadingMore || isFullyLoaded}
          title={`Load all ${remaining.toLocaleString()} remaining nodes`}
        >
          🚀 Load All ({remaining.toLocaleString()})
        </button>
      </div>
    </div>
  );
};

export default LoadControls;
