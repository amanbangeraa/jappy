import { type FC, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import XPBadge from '../components/XPBadge';
import Icon from '../components/Icon';
import { getRoleHomePath } from '../utils/role';
import type { SummaryData } from '../types';

const SummaryPage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const summary: SummaryData | null = (location.state as { summary?: SummaryData })?.summary ?? null;

  const [barsVisible, setBarsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarsVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  if (!summary) {
    return (
      <div className="page-center" style={{ gap: 0 }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontWeight: 600 }}>No session data found.</p>
        <button className="btn btn-green" onClick={() => navigate(getRoleHomePath())}><Icon name="home" size={16} /> Go home</button>
      </div>
    );
  }

  const { totalReviewed, againCount, goodCount, xpEarned, accuracy, results } = summary;
  // Two buckets: missed = againCount, got it = goodCount
  const missedCount = againCount;
  const gotItCount  = goodCount;

  const bars = [
    { label: 'Missed',  count: missedCount, color: '#FF4B4B', icon: 'x'     as const },
    { label: 'Got it',  count: gotItCount,  color: '#58CC02', icon: 'check'  as const },
  ];
  const maxCount = Math.max(...bars.map((b) => b.count), 1);

  return (
    <div className="page" style={{ maxWidth: 520 }}>

      {/* ── Trophy header ── */}
      <div style={{ textAlign: 'center', marginBottom: 32 }} className="anim-fadeIn">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 0 #CC8800, 0 10px 30px rgba(255,200,0,0.3)',
            color: '#fff',
          }}>
            <Icon name="trophy" size={36} strokeWidth={1.8} />
          </div>
        </div>
        <h1 className="heading-xl" style={{ marginBottom: 6 }}>Session complete!</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 600 }}>
          {totalReviewed} cards reviewed&nbsp;·&nbsp;{accuracy}% accuracy
        </p>
      </div>

      {/* ── XP Badge ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
        <XPBadge xp={xpEarned} delay={200} />
      </div>

      {/* ── Two stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {bars.map((bar, i) => (
          <div key={bar.label} className="anim-fadeInUp" style={{ animationDelay: `${200 + i * 100}ms` }}>
            <div style={{
              background: 'var(--card)',
              border: `2px solid ${bar.color}33`,
              borderRadius: 'var(--radius-xl)',
              padding: '20px 16px',
              textAlign: 'center',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: `${bar.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
                color: bar.color,
              }}>
                <Icon name={bar.icon} size={22} strokeWidth={2.5} color={bar.color} />
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--heading)', lineHeight: 1 }}>
                {bar.count}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
                {bar.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bar chart ── */}
      <div style={{
        background: 'var(--card)',
        border: '2px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '20px 20px 16px',
        marginBottom: 24,
      }} className="anim-fadeInUp delay-400">
        <p style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 16 }}>
          Breakdown
        </p>
        {bars.map((bar) => {
          const w = barsVisible ? (bar.count / maxCount) * 100 : 0;
          return (
            <div key={bar.label} className="stat-bar-row">
              <span className="stat-bar-label" style={{ color: bar.color, display: 'flex', justifyContent: 'flex-end' }}>
                <Icon name={bar.icon} size={16} strokeWidth={2.5} color={bar.color} />
              </span>
              <div className="stat-bar-track">
                <div className="stat-bar-fill" style={{ width: `${w}%`, background: bar.color, minWidth: bar.count > 0 ? 20 : 0 }} />
              </div>
              <span className="stat-bar-count">{bar.count}</span>
            </div>
          );
        })}
      </div>

      {/* ── Toggle details ── */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{ background: 'none', border: 'none', fontSize: 14, fontWeight: 700, color: 'var(--blue)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name={showDetails ? 'chevron-left' : 'chevron-left'} size={14} color="var(--blue)"
            style={{ transform: showDetails ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
          />
          {showDetails ? 'Hide details' : 'Show card details'}
        </button>
      </div>

      {/* ── Card results ── */}
      {showDetails && (
        <div style={{ marginBottom: 28 }} className="anim-fadeIn">
          {results.map((r, i) => {
            const isGot = r.grade >= 2;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--card)', border: '2px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 8,
                animation: `fadeInUp 0.3s ease-out ${i * 30}ms both`,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--font-jp)', fontSize: 18, fontWeight: 700, color: 'var(--heading)' }}>
                    {r.japanese}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                    → {r.english}
                  </span>
                </div>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: isGot ? '#58CC0222' : '#FF4B4B22',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isGot ? '#58CC02' : '#FF4B4B',
                }}>
                  <Icon name={isGot ? 'check' : 'x'} size={14} strokeWidth={2.5} color={isGot ? '#58CC02' : '#FF4B4B'} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button className="btn btn-ghost" onClick={() => navigate(getRoleHomePath())}>
          <Icon name="home" size={16} /> Home
        </button>
        <button className="btn btn-green" onClick={() => navigate(getRoleHomePath())}>
          <Icon name="lightning" size={16} /> Study again
        </button>
      </div>

    </div>
  );
};

export default SummaryPage;