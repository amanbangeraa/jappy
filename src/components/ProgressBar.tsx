import { type FC } from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
}

const ProgressBar: FC<ProgressBarProps> = ({ current, total }) => {
  const pct = total > 0 ? Math.round((Math.min(current, total) / total) * 100) : 0;
  const clamped = Math.max(0, Math.min(current, total));

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
          Progress
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--heading)' }}>
          {clamped}<span style={{ opacity: 0.35 }}>/{total}</span>
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default ProgressBar;