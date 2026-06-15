import { type FC } from 'react';
import type { LessonStats } from '../types';
import Icon from './Icon';

interface LessonCardProps {
  name: string;
  stats: LessonStats;
  onClick: () => void;
}

const LessonCard: FC<LessonCardProps> = ({ name, stats, onClick }) => {
  const { totalCards, dueCards, lastStudied } = stats;

  const formatDate = (ts: number | null) => {
    if (!ts) return null;
    const diff = Date.now() - ts;
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
      {/* Icon */}
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

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h3 style={{
            fontSize: 17, fontWeight: 800, color: 'var(--heading)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name}
          </h3>

          {/* Due badge */}
          {hasDue ? (
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--green)' }}>
                due
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, color: 'var(--green)' }}>
                {dueCards}
              </div>
            </div>
          ) : (
            <Icon name="star" size={20} strokeWidth={1.8} color="var(--text-muted)" />
          )}
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            {totalCards} words
          </span>
          {lastStr && (
            <>
              <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>·</span>
              <Icon name="clock" size={12} color="var(--text-muted)" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{lastStr}</span>
            </>
          )}
        </div>

        {/* Progress bar */}
        {totalCards > 0 && (
          <div style={{ marginTop: 10, height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: hasDue ? 'var(--green)' : 'var(--blue)',
              borderRadius: 999, transition: 'width 0.5s ease',
            }} />
          </div>
        )}
      </div>
    </button>
  );
};

export default LessonCard;