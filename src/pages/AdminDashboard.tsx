import { type FC, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLessons } from '../hooks/useLessons';
import { useAuth } from '../contexts/auth';
import { parseCSV } from '../utils/csvParser';
import { LEVEL_ORDER, LEVEL_COLORS, LEVEL_LABELS, type LessonLevel } from '../types';
import type { LessonWithStats } from '../api/client';
import LessonCard from '../components/LessonCard';
import Icon from '../components/Icon';
import BrandLogo from '../components/BrandLogo';

const AdminDashboard: FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { lessons, loading, importCSV, removeLesson } = useLessons();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<{ text: string; lessonId: number | null } | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<LessonLevel>('N5');
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  // Detect a JLPT level (N1-N5) from a filename, e.g. "n4-l26.csv" → "N4".
  function detectLevelFromName(name: string): LessonLevel | null {
    const match = name.match(/\b(n[1-5])\b/i);
    return match ? (match[1].toUpperCase() as LessonLevel) : null;
  }

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setBulkImporting(true);
    setBulkProgress({ done: 0, total: files.length });
    setError(null);
    setSuccessMsg(null);

    const succeeded: string[] = [];
    const failed: { name: string; reason: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lessonName = file.name.replace(/\.csv$/i, '');
      try {
        const existing = lessons.find((l) => l.name === lessonName);
        if (existing) {
          failed.push({ name: lessonName, reason: 'already exists' });
          continue;
        }

        const { rows, errors } = await parseCSV(file);
        if (errors.length > 0) {
          failed.push({ name: lessonName, reason: errors.join('; ') });
          continue;
        }
        if (rows.length === 0) {
          failed.push({ name: lessonName, reason: 'no valid rows' });
          continue;
        }

        const detectedLevel = detectLevelFromName(file.name) ?? selectedLevel;
        await importCSV(lessonName, detectedLevel, rows);
        succeeded.push(`"${lessonName}" (${detectedLevel}, ${rows.length} cards)`);
      } catch (err) {
        failed.push({ name: lessonName, reason: err instanceof Error ? err.message : 'import failed' });
      } finally {
        setBulkProgress({ done: i + 1, total: files.length });
      }
    }

    if (succeeded.length > 0 && failed.length === 0) {
      setSuccessMsg({ text: `Imported ${succeeded.length} lesson${succeeded.length !== 1 ? 's' : ''}.`, lessonId: null });
    } else if (succeeded.length > 0 && failed.length > 0) {
      setError(`Imported ${succeeded.length}, failed ${failed.length}:\n${failed.map((f) => `• ${f.name}: ${f.reason}`).join('\n')}`);
      setSuccessMsg({ text: `Imported ${succeeded.length} lesson${succeeded.length !== 1 ? 's' : ''}.`, lessonId: null });
    } else if (failed.length > 0) {
      setError(`Failed to import ${failed.length} file${failed.length !== 1 ? 's' : ''}:\n${failed.map((f) => `• ${f.name}: ${f.reason}`).join('\n')}`);
    }

    setBulkImporting(false);
    setBulkProgress(null);
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
  };

  const handleDelete = async (lesson: LessonWithStats) => {
    if (!lesson.id) return;
    if (deletingId !== null) return;
    const confirmed = window.confirm(`Delete "${lesson.name}" (${lesson.level}) and all its cards? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(lesson.id);
    setError(null);
    setSuccessMsg(null);
    try {
      await removeLesson(lesson.id);
      setSuccessMsg({ text: `Deleted "${lesson.name}" and all its cards.`, lessonId: lesson.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete lesson');
    } finally {
      setDeletingId(null);
    }
  };

  const totalDue = lessons.reduce((sum, l) => sum + l.stats.dueCards, 0);

  const groupedLessons: Record<LessonLevel, LessonWithStats[]> = {
    N5: [], N4: [], N3: [], N2: [], N1: [], Kanji: [],
  };
  for (const lesson of lessons) {
    const lvl = lesson.level as LessonLevel;
    if (groupedLessons[lvl]) groupedLessons[lvl].push(lesson);
  }

  return (
    <div className="page">
      {/* ── Nav Bar ── */}
      <div className="nav-bar">
        <div>
          <BrandLogo />
          <div className="app-tagline">Admin · Manage lessons</div>
        </div>
        <div className="nav-actions">
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
            {user?.username}
          </span>
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
          <button className="btn btn-ghost btn-sm" onClick={() => logout()}>
            <Icon name="log-out" size={14} /> Logout
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
          {successMsg.lessonId !== null && (
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
          )}
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
            <label className="level-select-label">Lesson Section</label>
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
            disabled={importing || bulkImporting}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Icon name="upload" size={14} color="#fff" />
            {importing ? 'Importing…' : 'Choose CSV file'}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Bulk File Input */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => bulkFileInputRef.current?.click()}
            disabled={importing || bulkImporting}
            style={{ width: '100%', justifyContent: 'center', border: '1px dashed var(--border)' }}
          >
            <Icon name="upload" size={14} color="var(--blue)" />
            {bulkImporting
              ? `Importing… ${bulkProgress?.done}/${bulkProgress?.total}`
              : 'Bulk upload multiple CSVs'}
          </button>
          <input
            ref={bulkFileInputRef}
            type="file"
            accept=".csv"
            multiple
            onChange={handleBulkImport}
            className="hidden"
          />
          {bulkImporting && bulkProgress && (
            <div style={{ marginTop: 10 }}>
              <div className="lesson-card-progress" style={{ height: 6, borderRadius: 999 }}>
                <div
                  className="lesson-card-progress-fill"
                  style={{
                    width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%`,
                    background: 'var(--blue)',
                    height: '100%',
                    borderRadius: 999,
                    transition: 'width 200ms ease',
                  }}
                />
              </div>
            </div>
          )}
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            CSV must have <strong>japanese</strong> or <strong>kanji</strong>, <strong>english</strong>, and optionally <strong>reading</strong> or <strong>romaji</strong> columns. Level is auto-detected from filenames containing <strong>n1–n5</strong>; otherwise the selected level is used.
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
                        disabled={deletingId === lesson.id}
                        style={{
                          position: 'absolute', top: 12, right: 12,
                          padding: '6px 10px', fontSize: 11, borderRadius: 'var(--radius-sm)',
                          color: deletingId === lesson.id ? 'var(--text-muted)' : '#DC2626',
                          opacity: deletingId === lesson.id ? 0.6 : 1,
                          cursor: deletingId === lesson.id ? 'wait' : 'pointer',
                        }}
                        title={deletingId === lesson.id ? 'Deleting…' : 'Delete lesson'}
                        aria-label={`Delete lesson ${lesson.name}`}
                      >
                        <Icon name="trash" size={14} />
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