import React, { useEffect, useState } from 'react';
import { EntityCounts } from '../../analyzer/types';

interface EntityOverviewProps {
  counts: EntityCounts;
}

const CountUp: React.FC<{ end: number }> = ({ end }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1000;
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [end]);

  return <span>{count}</span>;
};

const EntityOverview: React.FC<EntityOverviewProps> = ({ counts }) => {
  return (
    <div className="overview-container">
      <h2 className="panel-title">Entity Overview</h2>
      
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(76, 201, 240, 0.1)', color: '#4cc9f0' }}>M</div>
          <div className="stat-info">
            <div className="stat-value"><CountUp end={counts.modules} /></div>
            <div className="stat-label">Modules</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(247, 37, 133, 0.1)', color: '#f72585' }}>ƒ</div>
          <div className="stat-info">
            <div className="stat-value"><CountUp end={counts.functions} /></div>
            <div className="stat-label">Functions</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(248, 150, 30, 0.1)', color: '#f8961e' }}>C</div>
          <div className="stat-info">
            <div className="stat-value"><CountUp end={counts.classes} /></div>
            <div className="stat-label">Classes</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(114, 9, 183, 0.1)', color: '#7209b7' }}>⇄</div>
          <div className="stat-info">
            <div className="stat-value"><CountUp end={counts.dependencies} /></div>
            <div className="stat-label">Dependencies</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityOverview;
