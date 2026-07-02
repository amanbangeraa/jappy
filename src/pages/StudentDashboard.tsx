import { type CSSProperties, type FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLessons } from '../hooks/useLessons';
import { useAuth } from '../contexts/auth';
import { LEVEL_ORDER, LEVEL_COLORS, LEVEL_LABELS, type LessonLevel } from '../types';
import type { LessonWithStats } from '../api/client';
import LessonCard from '../components/LessonCard';
import Icon from '../components/Icon';
import BrandLogo from '../components/BrandLogo';

const StudentDashboard: FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { lessons, loading } = useLessons();
  const [selectedLevel, setSelectedLevel] = useState<LessonLevel | null>(null);
  const [showLessons, setShowLessons] = useState(false);

  const groupedLessons: Record<LessonLevel, LessonWithStats[]> = {
    N5: [], N4: [], N3: [], N2: [], N1: [], Kanji: [],
  };

  for (const lesson of lessons) {
    const lvl = lesson.level as LessonLevel;
    if (groupedLessons[lvl]) {
      groupedLessons[lvl].push(lesson);
    }
  }

  const totalDue = lessons.reduce((sum, l) => sum + l.stats.dueCards, 0);
  const levelsToShow = selectedLevel ? [selectedLevel] : LEVEL_ORDER;
  const displayName = user?.username?.trim() || 'learner';
  const profileInitial = displayName.charAt(0).toUpperCase();
  const [profileOpen, setProfileOpen] = useState(false);
  const dueMessage = loading
    ? 'I am getting your Japanese practice ready.'
    : totalDue > 0
      ? `You have ${totalDue} card${totalDue === 1 ? '' : 's'} waiting today.`
      : 'No cards are due right now. You can still review your lessons.';

  return (
    <div className="page">
      {/* ── Nav Bar ── */}
      <div className="nav-bar">
        <div>
          <BrandLogo />
          <div className="app-tagline">Student · Japanese flashcards</div>
        </div>
        <div className="student-profile-menu">
          <button
            type="button"
            className="student-profile-trigger"
            onClick={() => setProfileOpen((open) => !open)}
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
          >
            <span className="student-profile-avatar" aria-hidden="true">{profileInitial}</span>
          </button>

          {profileOpen && (
            <div className="student-profile-dropdown anim-popIn" role="menu">
              <div className="student-profile-copy">
                <span>Signed in as</span>
                <strong>{displayName}</strong>
              </div>
              <button className="student-profile-logout" onClick={() => logout()} role="menuitem">
                <Icon name="log-out" size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {!showLessons ? (
        <section className="student-welcome-hero anim-fadeInUp" aria-labelledby="student-welcome-title">
          <div className="student-welcome-glow" aria-hidden="true" />
          <div className="student-welcome-sparkle student-welcome-sparkle-one" aria-hidden="true">*</div>
          <div className="student-welcome-sparkle student-welcome-sparkle-two" aria-hidden="true">*</div>

          <div className="tiger-mascot" role="img" aria-label="Jappy, a cheerful tiger study buddy">
            <div className="tiger-mascot-ear tiger-mascot-ear-left" />
            <div className="tiger-mascot-ear tiger-mascot-ear-right" />
            <div className="tiger-mascot-head">
              <span className="tiger-stripe tiger-stripe-left" />
              <span className="tiger-stripe tiger-stripe-center" />
              <span className="tiger-stripe tiger-stripe-right" />
              <div className="tiger-eye tiger-eye-left" />
              <div className="tiger-eye tiger-eye-right" />
              <div className="tiger-muzzle">
                <span className="tiger-nose" />
                <span className="tiger-smile" />
              </div>
              <span className="tiger-blush tiger-blush-left" />
              <span className="tiger-blush tiger-blush-right" />
            </div>
            <div className="tiger-card" aria-hidden="true">あ</div>
          </div>

          <p className="student-welcome-kicker">Jappy study buddy</p>
          <h1 id="student-welcome-title" className="student-welcome-title">
            Welcome back, {displayName}!
          </h1>
          <p className="student-welcome-copy">{dueMessage}</p>
          <button className="btn btn-green student-welcome-cta" onClick={() => setShowLessons(true)}>
            Get started
            <Icon name="arrow-right" size={18} color="#fff" />
          </button>
        </section>
      ) : (
        <>
          <section className="student-dashboard-focus anim-fadeInUp" aria-labelledby="student-dashboard-title">
            <p className="student-dashboard-kicker">Today's practice</p>
            <h1 id="student-dashboard-title" className="student-dashboard-title">
              Welcome back, {displayName}
            </h1>
            <p className="student-dashboard-copy">{dueMessage}</p>
            <button
              className="btn btn-green student-study-all-cta"
              onClick={() => navigate('/study?lesson=all')}
              disabled={loading || totalDue === 0}
            >
              <Icon name="play" size={18} color="#fff" />
              Study All
              <span className="student-study-all-count">{totalDue}</span>
            </button>
          </section>

          {lessons.length > 0 && (
            <div className="student-filter-panel anim-fadeInUp">
              <label className="level-select-label">Filter by section</label>
              <div className="student-filter-chips">
                {LEVEL_ORDER.map((lvl) => {
                  const count = groupedLessons[lvl].length;
                  const isActive = selectedLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      className={`student-filter-chip ${isActive ? 'student-filter-chip-active' : ''}`}
                      style={{
                        '--level-color': LEVEL_COLORS[lvl],
                        opacity: count === 0 ? 0.4 : 1,
                      } as CSSProperties}
                      onClick={() => setSelectedLevel(isActive ? null : lvl)}
                      disabled={count === 0}
                    >
                      {lvl}
                      {count > 0 && <span>{count}</span>}
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
        </>
      )}
    </div>
  );
};

export default StudentDashboard;