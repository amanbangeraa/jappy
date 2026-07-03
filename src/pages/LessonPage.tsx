import { type FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLessons } from '../hooks/useLessons';
import { useCards } from '../hooks/useCards';
import { useAuth } from '../contexts/auth';
import { LEVEL_COLORS, type LessonLevel } from '../types';
import Icon from '../components/Icon';

const LessonPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const lessonId = Number(id);
  const { lessons, removeLesson } = useLessons();
  const { cards, loading } = useCards(lessonId);
  const homePath = user?.role === 'admin' ? '/admin' : '/student';

  const lesson = lessons.find((l) => l.id === lessonId);

  if (!lesson && !loading) {
    return (
      <div className="page-center">
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Lesson not found.</p>
        <button className="btn btn-ghost" onClick={() => navigate(homePath)}>
          <Icon name="chevron-left" size={16} /> Go home
        </button>
      </div>
    );
  }

  const hasDue = (lesson?.stats.dueCards ?? 0) > 0;
  const totalCards = lesson?.stats.totalCards ?? 0;
  const dueCards   = lesson?.stats.dueCards ?? 0;
  const pct = totalCards > 0 ? Math.round(((totalCards - dueCards) / totalCards) * 100) : 0;
  const levelColor = lesson ? LEVEL_COLORS[lesson.level as LessonLevel] ?? 'var(--text-muted)' : 'var(--text-muted)';

  const handleDelete = async () => {
    if (!lesson?.id) return;
    const confirmed = window.confirm(`Delete "${lesson.name}" and all its cards? This cannot be undone.`);
    if (!confirmed) return;
    await removeLesson(lesson.id);
    navigate(homePath);
  };

  return (
    <div className="page">

      {/* ── Back ── */}
      <button className="back-btn" onClick={() => navigate(-1)}>
        <Icon name="chevron-left" size={16} /> Back
      </button>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }} className="anim-fadeInUp">
        <div className="lesson-header-row">
          <div className="lesson-header-main">
            <div className="lesson-title-row">
              <h1 className="heading-lg" style={{ marginBottom: 0 }}>
                {lesson?.name ?? 'Loading…'}
              </h1>
              {lesson && (
                <span className="level-badge" style={{ background: `${levelColor}18`, color: levelColor, fontSize: 12, padding: '3px 10px' }}>
                  {lesson.level}
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>
              {totalCards} cards
              {hasDue && (
                <> · <span style={{ color: 'var(--green)', fontWeight: 800 }}>{dueCards} due today</span></>
              )}
            </p>
          </div>
          <div className="lesson-header-actions">
            {lesson && (
              <button
                className="btn btn-green btn-sm"
                onClick={() => navigate(`/study?lesson=${lessonId}${hasDue ? '' : '&mode=all'}`)}
              >
                <Icon name="play" size={14} color="#fff" /> {hasDue ? 'Study now' : 'Review again'}
              </button>
            )}
            {lesson && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleDelete}
                style={{ padding: '10px 12px' }}
                title="Delete lesson"
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        {totalCards > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Mastered
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--green)' }}>
                {totalCards - dueCards}/{totalCards}
              </span>
            </div>
            <div className="progress-track" style={{ height: 10 }}>
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── All done ── */}
      {lesson && !hasDue && (
        <div className="empty-state anim-popIn" style={{ padding: '48px 24px' }}>
          <div style={{ color: 'var(--green)', marginBottom: 12 }}>
            <Icon name="check-circle" size={64} strokeWidth={1.4} color="var(--green)" />
          </div>
          <h2 className="heading-md">Nothing due today</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>
            Come back tomorrow for scheduled reviews, or review this lesson again now.
          </p>
        </div>
      )}

      {/* ── Card list ── */}
      {loading ? (
        <div className="loading-text">Loading cards…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cards.map((card, i) => (
            <div key={card.id} className="word-row anim-fadeInUp" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="word-main">
                <span className="word-ja">{card.japanese}</span>
                {card.reading && <span className="word-reading">{card.reading}</span>}
              </div>
              <span className="word-en">{card.english}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LessonPage;