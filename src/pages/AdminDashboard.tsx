import { type FC, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLessons } from '../hooks/useLessons';
import { parseCSV } from '../utils/csvParser';
import { LEVEL_ORDER, LEVEL_COLORS, LEVEL_LABELS, type JLPTLevel } from '../types';
import type { LessonWithStats } from '../api/client';
import LessonCard from '../components/LessonCard';
import Icon from '../components/Icon';

const AdminDashboard: FC = () => {
  const navigate = useNavigate();
  const { lessons, loading, importCSV, removeLesson } = useLessons();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<{ text: string; lessonId: number } | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel>('N5');

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const lessonName = file.name.replace(/\.csv$/i, '');

      const existing = lessons.find((l) => l.name === lessonName);
      if (existing) {
        setError(`"${lessonName}" already exists. Delete it first to re-import.`);
        setImporting(false);
        return;
      }

      const { rows, errors } = await parseCSV(file);
      if (errors.length > 0) { setError(errors.join('\n')); setImporting(false); return; }
      if (rows.length === 0) { setError('CSV has no valid rows.'); setImporting(false); return; }

      const lesson = await importCSV(lessonName, selectedLevel, rows);

      setSuccessMsg({ text: `Imported "${lessonName}" (${selectedLevel}) — ${rows.length} cards`, lessonId: lesson.id! });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (lesson: LessonWithStats) => {
    if (!lesson.id) return;
    const confirmed = window.confirm(`Delete "${lesson.name}" (${lesson.level}) and all its cards? This cannot be undone.`);
    if (!confirmed) return;
    await removeLesson(lesson.id);
  };

  const totalDue = lessons.reduce((sum, l) => sum + l.stats.dueCards, 0);

  const groupedLessons: Record<JLPTLevel, LessonWithStats[]> = {
    N5: [], N4: [], N3: [], N2: [], N1: [],
  };
  for (const lesson of lessons) {
    const lvl = lesson.level as JLPTLevel;
    if (groupedLessons[lvl]) groupedLessons[lvl].push(lesson);
  }

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
          <div className="app-tagline">Admin · Manage lessons</div>
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

      {/* ── Alerts ── */}
      {error && (
        <div className="alert alert-error anim-fadeIn" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Icon name="x" size={16} color="#DC2626" style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success anim-fadeIn" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="check-circle" size={16} color="#16A34A" />
            <span>{successMsg.text}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999 }}
              onClick={() => navigate(`/lessons/${successMsg.lessonId}`)}>
              View lesson
            </button>
            <button className="btn btn-green btn-sm" style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999 }}
              onClick={() => navigate(`/study?lesson=${successMsg.lessonId}`)}>
              Study now
            </button>
          </div>
        </div>
      )}

      {/* ── Upload Section ── */}
      <div className="upload-zone anim-fadeInUp">
        <div className="upload-zone-header">
          <Icon name="upload" size={20} color="var(--blue)" />
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--heading)' }}>Upload a CSV lesson</h3>
        </div>

        <div className="upload-zone-body">
          {/* Level Select */}
          <div className="level-select-group">
            <label className="level-select-label">JLPT Level</label>
            <div className="level-select-row">
              {LEVEL_ORDER.map((lvl) => (
                <button
                  key={lvl}
                  className={`level-select-btn ${selectedLevel === lvl ? 'level-select-btn-active' : ''}`}
                  style={{
                    '--level-color': LEVEL_COLORS[lvl],
                  } as React.CSSProperties}
                  onClick={() => setSelectedLevel(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* File Input */}
          <button
            className="btn btn-blue btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Icon name="upload" size={14} color="#fff" />
            {importing ? 'Importing…' : 'Choose CSV file'}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            CSV must have <strong>japanese</strong>, <strong>english</strong>, and optionally <strong>reading</strong> columns
          </p>
        </div>
      </div>

      {/* ── Lesson List ── */}
      {loading ? (
        <div className="loading-text">Loading lessons…</div>
      ) : lessons.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 24px' }}>
          <div style={{ color: 'var(--blue)', marginBottom: 8, animation: 'float 3s ease-in-out infinite' }}>
            <Icon name="upload" size={64} strokeWidth={1.2} color="var(--blue)" />
          </div>
          <h2 className="heading-md" style={{ marginBottom: 6 }}>No lessons yet</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 600 }}>
            Upload a CSV file to get started
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {LEVEL_ORDER.map((level) => {
            const items = groupedLessons[level];
            if (items.length === 0) return null;
            const color = LEVEL_COLORS[level];
            const levelDue = items.reduce((s, l) => s + l.stats.dueCards, 0);

            return (
              <div key={level} className="anim-fadeInUp">
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {items.map((lesson, i) => (
                    <div key={lesson.id} className="anim-fadeInUp" style={{ animationDelay: `${i * 50}ms`, position: 'relative' }}>
                      <LessonCard
                        name={lesson.name}
                        stats={lesson.stats}
                        onClick={() => navigate(`/lessons/${lesson.id}`)}
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleDelete(lesson); }}
                        style={{
                          position: 'absolute', top: 12, right: 12,
                          padding: '6px 10px', fontSize: 11, borderRadius: 'var(--radius-sm)',
                        }}
                        title="Delete lesson"
                      >
                        <Icon name="x" size={12} />
                      </button>
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

export default AdminDashboard;