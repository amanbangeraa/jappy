import { type FC, useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useAuth } from '../contexts/auth';
import FlashCard from '../components/FlashCard';
import ProgressBar from '../components/ProgressBar';
import Icon from '../components/Icon';
import type { SummaryData } from '../types';

const SWIPE_THRESHOLD = 80; // px needed to register a swipe

const StudyPage: FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const lessonParam = searchParams.get('lesson') ?? 'all';
  const lessonId = lessonParam === 'all' ? 'all' : Number(lessonParam);
  const homePath = user?.role === 'admin' ? '/admin' : '/student';

  const { currentCard, loading, finished, summary, progress, startSession, gradeCard } =
    useSession(lessonId);

  const [flipped, setFlipped] = useState(false);
  const hasNavigated = useRef(false);

  // Swipe state
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void Promise.resolve().then(startSession);
  }, [startSession]);
  useEffect(() => {
    if (finished && summary && !hasNavigated.current) {
      hasNavigated.current = true;
      navigate('/summary', {
        state: { summary, studyPath: `/study?lesson=${lessonParam}` } as { summary: SummaryData; studyPath: string },
        replace: true,
      });
    }
  }, [finished, summary, navigate]);

  const handleGrade = useCallback((key: 'miss' | 'got') => {
    setFlipped(false);
    setDragX(0);
    setIsDragging(false);
    void gradeCard(key);
  }, [gradeCard]);

  /* ── Pointer / Touch handlers ── */
  const onDragStart = (clientX: number) => {
    if (!flipped) return;
    startXRef.current = clientX;
    setIsDragging(true);
  };

  const onDragMove = (clientX: number) => {
    if (!isDragging) return;
    setDragX(clientX - startXRef.current);
  };

  const onDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX < -SWIPE_THRESHOLD) {
      handleGrade('miss');
    } else if (dragX > SWIPE_THRESHOLD) {
      handleGrade('got');
    } else {
      setDragX(0);
    }
  };

  // Mouse events
  const onMouseDown  = (e: React.MouseEvent) => onDragStart(e.clientX);
  const onMouseMove  = (e: React.MouseEvent) => onDragMove(e.clientX);
  const onMouseUp    = () => onDragEnd();
  const onMouseLeave = () => { if (isDragging) onDragEnd(); };

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => onDragStart(e.touches[0].clientX);
  const onTouchMove  = (e: React.TouchEvent) => onDragMove(e.touches[0].clientX);
  const onTouchEnd   = () => onDragEnd();

  /* ── Derived drag visuals ── */
  const clampedDrag   = Math.max(-160, Math.min(160, dragX));
  const rotateDeg     = clampedDrag * 0.08;
  const missOpacity   = Math.max(0, -clampedDrag / SWIPE_THRESHOLD);
  const gotOpacity    = Math.max(0, clampedDrag / SWIPE_THRESHOLD);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="page-center">
        <p className="loading-text">Preparing your session…</p>
      </div>
    );
  }

  /* ── Nothing due ── */
  if (!currentCard && !finished) {
    return (
      <div className="page-center" style={{ gap: 0 }}>
        <div style={{ marginBottom: 20, color: 'var(--green)' }}>
          <Icon name="check-circle" size={72} strokeWidth={1.5} />
        </div>
        <h2 className="heading-md" style={{ marginBottom: 8 }}>Nothing due today</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 600, marginBottom: 28 }}>
          You're all caught up!
        </p>
        <button className="btn btn-green" onClick={() => navigate(homePath)}>
          <Icon name="home" size={16} /> Go home
        </button>
      </div>
    );
  }

  if (!currentCard) return null;

  return (
    <div className="study-page">

      {/* ── Top bar ── */}
      <div className="study-header">
        <button className="close-btn" onClick={() => navigate(homePath)}>
          <Icon name="x" size={16} />
        </button>
        <ProgressBar current={progress.current} total={progress.total} />
      </div>

      {/* ── Card with swipe ── */}
      <div className="study-card-area">
        <div
          key={currentCard?.id ?? 0}
          ref={cardRef}
          style={{
            transform: `translateX(${clampedDrag}px) rotate(${rotateDeg}deg)`,
            transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
            cursor: flipped ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
            userSelect: 'none',
            position: 'relative',
            width: '100%',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <FlashCard
            japanese={currentCard.japanese}
            reading={currentCard.reading}
            english={currentCard.english}
            flipped={flipped}
            onFlip={() => { if (!flipped && !isDragging) setFlipped(true); }}
          />

          {/* Miss overlay (swipe left) */}
          {missOpacity > 0.05 && (
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: 'var(--radius-xl)',
              background: `rgba(255,75,75,${missOpacity * 0.18})`,
              border: `3px solid rgba(255,75,75,${missOpacity})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              opacity: missOpacity,
              transition: 'none',
            }}>
              <div style={{
                background: '#FF4B4B', borderRadius: '50%',
                padding: 12, color: '#fff',
                transform: `scale(${0.7 + missOpacity * 0.3})`,
              }}>
                <Icon name="x" size={28} strokeWidth={3} />
              </div>
            </div>
          )}

          {/* Got overlay (swipe right) */}
          {gotOpacity > 0.05 && (
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: 'var(--radius-xl)',
              background: `rgba(88,204,2,${gotOpacity * 0.18})`,
              border: `3px solid rgba(88,204,2,${gotOpacity})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              opacity: gotOpacity,
              transition: 'none',
            }}>
              <div style={{
                background: '#58CC02', borderRadius: '50%',
                padding: 12, color: '#fff',
                transform: `scale(${0.7 + gotOpacity * 0.3})`,
              }}>
                <Icon name="check" size={28} strokeWidth={3} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Hint / Action area ── */}
      {!flipped ? (
        <div style={{ textAlign: 'center', paddingBottom: 16 }}>
          <p style={{
            fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.12em',
          }}>
            Tap the card to reveal
          </p>
        </div>
      ) : (
        <div
          className="study-actions"
          style={{
            opacity: flipped ? 1 : 0,
            transform: flipped ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
          }}
        >
          {/* Swipe hint */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginBottom: 4,
          }}>
            <Icon name="arrow-left" size={14} color="var(--text-muted)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              swipe or tap
            </span>
            <Icon name="arrow-right" size={14} color="var(--text-muted)" />
          </div>

          {/* Two big buttons */}
          <div className="study-grade-actions">
            {/* Miss — left */}
            <button
              className="btn btn-red"
              style={{ fontSize: 16, padding: '16px 12px', borderRadius: 'var(--radius-lg)', gap: 10 }}
              onClick={() => handleGrade('miss')}
            >
              <Icon name="x" size={20} strokeWidth={2.5} />
              Missed
            </button>

            {/* Got it — right */}
            <button
              className="btn btn-green"
              style={{ fontSize: 16, padding: '16px 12px', borderRadius: 'var(--radius-lg)', gap: 10 }}
              onClick={() => handleGrade('got')}
            >
              <Icon name="check" size={20} strokeWidth={2.5} />
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyPage;