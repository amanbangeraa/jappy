import { useState, type FC } from 'react';
import type { LessonStats } from '../types';
import Icon from './Icon';

interface LessonCardProps {
  name: string;
  stats: LessonStats;
  onClick: () => void;
}

const LessonCard: FC<LessonCardProps> = ({ name, stats, onClick }) => {
  const { totalCards, dueCards, lastStudied } = stats;
  const [renderedAt] = useState(() => Date.now());

  const formatDate = (ts: number | null) => {
    if (!ts) return null;
    const diff = renderedAt - ts;
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) return 'Today';
    if (hours < 48) return 'Yesterday';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const lastStr = formatDate(lastStudied);
  const pct = totalCards > 0 ? Math.round(((totalCards - dueCards) / totalCards) * 100) : 0;
  const hasDue = dueCards > 0;

  return (
    <button onClick={onClick} className="lesson-card">
      <div
        className={`lesson-icon ${hasDue ? 'lesson-icon-active' : 'lesson-icon-done'}`}
        style={{ color: hasDue ? 'var(--green)' : 'var(--text-muted)' }}
      >
        <Icon
          name={hasDue ? 'book-open' : 'check-circle'}
          size={24}
          strokeWidth={1.8}
          color={hasDue ? 'var(--green)' : 'var(--text-muted)'}
        />
      </div>

      <div className="lesson-card-body">
        <div className="lesson-card-top">
          <h3 className="lesson-card-title">{name}</h3>

          {hasDue ? (
            <div className="lesson-card-due" aria-label={`${dueCards} cards due`}>
              <span className="lesson-card-due-label">due</span>
              <span className="lesson-card-due-count">{dueCards}</span>
            </div>
          ) : (
            <Icon name="star" size={20} strokeWidth={1.8} color="var(--text-muted)" />
          )}
        </div>

        <div className="lesson-card-meta">
          <span>{totalCards} words</span>
          {lastStr && (
            <>
              <span className="lesson-card-dot">·</span>
              <Icon name="clock" size={12} color="var(--text-muted)" strokeWidth={2} />
              <span>{lastStr}</span>
            </>
          )}
        </div>

        {totalCards > 0 && (
          <div className="lesson-card-progress">
            <div
              className="lesson-card-progress-fill"
              style={{
                width: `${pct}%`,
                background: hasDue ? 'var(--green)' : 'var(--blue)',
              }}
            />
          </div>
        )}
      </div>
    </button>
  );
};

export default LessonCard;