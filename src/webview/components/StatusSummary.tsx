import React, { useState, useEffect } from 'react';

interface StatusSummaryProps {
  entityCount: number;
  relationshipCount: number;
  insightsCount: number;
  lastUpdateTimestamp?: number;
}

const StatusSummary: React.FC<StatusSummaryProps> = ({ entityCount, relationshipCount, insightsCount, lastUpdateTimestamp }) => {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState<string>('just now');
  const [isPulsing, setIsPulsing] = useState<boolean>(false);

  // Update lastUpdated when lastUpdateTimestamp changes (implies new analysis data arrived)
  useEffect(() => {
    if (lastUpdateTimestamp) {
      setLastUpdated(new Date(lastUpdateTimestamp));
    } else {
      setLastUpdated(new Date());
    }
    setTimeAgo('just now');
    setIsPulsing(true);
    
    // Remove pulse after animation completes
    const timer = setTimeout(() => {
      setIsPulsing(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [lastUpdateTimestamp]);

  // Update timeAgo string periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
      
      if (diffInSeconds < 5) {
        setTimeAgo('just now');
      } else if (diffInSeconds < 60) {
        setTimeAgo(`${diffInSeconds}s ago`);
      } else {
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        setTimeAgo(`${diffInMinutes}m ago`);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <div className={`status-bar ${isPulsing ? 'pulse-update' : ''}`}>
      <div className="status-left">
        {entityCount} Entity Nodes | {relationshipCount} Relationships
      </div>
      <div className="status-center">
        {insightsCount} AI Insights
      </div>
      <div className="status-right">
        Last updated: {timeAgo}
      </div>
    </div>
  );
};

export default StatusSummary;
