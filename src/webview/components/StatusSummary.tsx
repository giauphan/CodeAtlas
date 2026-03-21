import React from 'react';

interface StatusSummaryProps {
  entityCount: number;
  relationshipCount: number;
  insightsCount: number;
}

const StatusSummary: React.FC<StatusSummaryProps> = ({ entityCount, relationshipCount, insightsCount }) => {
  return (
    <div className="status-bar">
      <div className="status-left">
        {entityCount} Entity Nodes | {relationshipCount} Relationships
      </div>
      <div className="status-center">
        {insightsCount} AI Insights
      </div>
      <div className="status-right">
        CodeAtlas v1.0
      </div>
    </div>
  );
};

export default StatusSummary;
