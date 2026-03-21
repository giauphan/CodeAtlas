import React from 'react';
import { AIInsight } from '../../analyzer/types';

interface AIInsightsProps {
  insights: AIInsight[];
}

const severityColor = {
  low: '#06d6a0',
  medium: '#ffd166',
  high: '#ef476f',
};

const AIInsights: React.FC<AIInsightsProps> = ({ insights }) => {
  return (
    <div className="insights-container">
      <h2 className="panel-title">AI Insights</h2>
      {insights.map(insight => (
        <div key={insight.id} className="insight-card" style={{ borderLeft: `4px solid ${severityColor[insight.severity]}` }}>
          <div className="insight-header">
            <span className={`badge severity-${insight.severity}`}>{insight.type.toUpperCase()}</span>
            <h3>{insight.title}</h3>
          </div>
          <p className="insight-description">{insight.description}</p>
          {insight.affectedNodes.length > 0 && (
            <div className="affected-nodes">
              <strong>Affected:</strong>
              <ul>
                {insight.affectedNodes.slice(0, 3).map(n => <li key={n}>{n.split(':').pop()}</li>)}
                {insight.affectedNodes.length > 3 && <li>...and {insight.affectedNodes.length - 3} more</li>}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AIInsights;
