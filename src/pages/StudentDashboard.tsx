import { type FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLessons } from '../hooks/useLessons';
import { LEVEL_ORDER, LEVEL_COLORS, LEVEL_LABELS, type JLPTLevel } from '../types';
import type { LessonWithStats } from '../api/client';
import LessonCard from '../components/LessonCard';
import Icon from '../components/Icon';

const StudentDashboard: FC = () => {
  const navigate = useNavigate();
  const { lessons, loading } = useLessons();
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel | null>(null);

  const groupedLessons: Record<JLPTLevel, LessonWithStats[]> = {
    N5: [], N4: [], N3: [], N2: [], N1: [],
  };

  for (const lesson of lessons) {
    const lvl = lesson.level as JLPTLevel;
    if (groupedLessons[lvl]) {
      groupedLessons[lvl].push(lesson);
    }
  }

  const totalDue = lessons.reduce((sum, l) => sum + l.stats.dueCards, 0);
  const levelsToShow = selectedLevel ? [selectedLevel] : LEVEL_ORDER;

  return (
    <div className="page">
      {/* ── Nav Bar ── */}
      <div className="nav-bar">
        <div>
          <div className="app-logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="book-open" size={18} strokeWidth={2} color="#fff" />
            </div>
            Jappy
          </div>
          <div className="app-tagline">Student · Japanese flashcards</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {totalDue > 0 && (
            <button className="btn btn-green btn-sm" onClick={() => navigate('/study?lesson=all')}>
              <Icon name="play" size={14} color="#fff" />
              Study All
              <span style={{
                background: 'rgba(255,255,255,0.25)', borderRadius: 999,
                padding: '1px 7px', fontSize: 12, fontWeight: 900,
              }}>
                {totalDue}
              </span>
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            <Icon name="home" size={14} /> Switch role
          </button>
        </div>
      </div>

      {/* ── Level Filter Pills ── */}
      {lessons.length > 0 && (
        <div className="level-select-group" style={{ marginBottom: 20 }}>
          <label className="level-select-label">Filter by level</label>
          <div className="level-select-row" style={{ flexWrap: 'wrap' }}>
            {LEVEL_ORDER.map((lvl) => {
              const count = groupedLessons[lvl].length;
              const isActive = selectedLevel === lvl;
              return (
                <button
                  key={lvl}
                  className={`level-select-btn ${isActive ? 'level-select-btn-active' : ''}`}
                  style={{
                    '--level-color': LEVEL_COLORS[lvl],
                    opacity: count === 0 ? 0.35 : 1,
                  } as React.CSSProperties}
                  onClick={() => setSelectedLevel(isActive ? null : lvl)}
                  disabled={count === 0}
                >
                  {lvl}
                  {count > 0 && (
                    <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, opacity: 0.7 }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading ? (
        <div className="loading-text">Loading lessons…</div>
      ) : lessons.length === 0 ? (
        <div className="empty-state">
          <div style={{ color: 'var(--green)', marginBottom: 8, animation: 'float 3s ease-in-out infinite' }}>
            <Icon name="book-open" size={72} strokeWidth={1.2} color="var(--green)" />
          </div>
          <h2 className="heading-md" style={{ marginBottom: 6 }}>No lessons yet</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 600 }}>
            Check back later — the admin hasn't uploaded any lessons.
          </p>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginTop: 20 }}>
            <Icon name="home" size={14} /> Switch role
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {levelsToShow.map((level) => {
            const items = groupedLessons[level];
            if (items.length === 0) return null;
            const color = LEVEL_COLORS[level];
            const levelDue = items.reduce((s, l) => s + l.stats.dueCards, 0);

            return (
              <div key={level} className="anim-fadeInUp">
                {/* Level Header */}
                <div className="level-header" style={{ borderLeftColor: color }}>
                  <div className="level-badge" style={{ background: `${color}18`, color }}>
                    {level}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--heading)' }}>
                      {LEVEL_LABELS[level]}
                    </h3>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                      {items.length} lesson{items.length !== 1 ? 's' : ''}
                      {levelDue > 0 && (
                        <> · <span style={{ color, fontWeight: 800 }}>{levelDue} due</span></>
                      )}
                    </span>
                  </div>
                </div>

                {/* Lesson Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {items.map((lesson, i) => (
                    <div key={lesson.id} className="anim-fadeInUp" style={{ animationDelay: `${i * 50}ms` }}>
                      <LessonCard
                        name={lesson.name}
                        stats={lesson.stats}
                        onClick={() => navigate(`/lessons/${lesson.id}`)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;