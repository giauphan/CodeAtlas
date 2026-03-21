import React, { useEffect, useState } from 'react';
import { EntityCounts } from '../../analyzer/types';

interface EntityOverviewProps {
  counts: EntityCounts;
}

const CountUp: React.FC<{ end: number }> = ({ end }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const duration = 1000; // 1 second

    // easeOutCubic easing function
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = currentTime - startTime;
      const t = Math.min(progress / duration, 1);
      
      const easedProgress = easeOutCubic(t);
      setCount(Math.floor(easedProgress * end));

      if (progress < duration) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    const reqId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqId);
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
