import { type FC, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLessons } from '../hooks/useLessons';
import { parseCSV } from '../utils/csvParser';
import LessonCard from '../components/LessonCard';
import Icon from '../components/Icon';

const HomePage: FC = () => {
  const navigate = useNavigate();
  const { lessons, loading, importCSV } = useLessons();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<{ text: string; lessonId: number } | null>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const lessonName = file.name.replace(/\.csv$/i, '');

      // Check for duplicate
      const existing = lessons.find((l) => l.name === lessonName);
      if (existing) {
        setError(`"${lessonName}" already exists. Delete it first to re-import.`);
        setImporting(false);
        return;
      }

      const { rows, errors } = await parseCSV(file);
      if (errors.length > 0) { setError(errors.join('\n')); setImporting(false); return; }
      if (rows.length === 0) { setError('CSV has no valid rows.'); setImporting(false); return; }

      const lesson = await importCSV(lessonName, rows);

      setSuccessMsg({ text: `Imported "${lessonName}" — ${rows.length} cards`, lessonId: lesson.id! });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const totalDue = lessons.reduce((sum, l) => sum + l.stats.dueCards, 0);

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
          <div className="app-tagline">Japanese vocabulary flashcards</div>
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
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Icon name="upload" size={15} />
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
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

      {/* ── Lesson list ── */}
      {loading ? (
        <div className="loading-text">Loading…</div>
      ) : lessons.length === 0 ? (
        <div className="empty-state">
          <div style={{ color: 'var(--green)', marginBottom: 8, animation: 'float 3s ease-in-out infinite' }}>
            <Icon name="book-open" size={72} strokeWidth={1.2} color="var(--green)" />
          </div>
          <h2 className="heading-md" style={{ marginBottom: 6 }}>No lessons yet</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 600 }}>
            Import a CSV file to get started
          </p>
          <button className="btn btn-green" style={{ marginTop: 20 }} onClick={() => fileInputRef.current?.click()}>
            <Icon name="upload" size={16} color="#fff" /> Import CSV
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lessons.map((lesson, i) => (
            <div key={lesson.id} className="anim-fadeInUp" style={{ animationDelay: `${i * 60}ms` }}>
              <LessonCard
                name={lesson.name}
                stats={lesson.stats}
                onClick={() => navigate(`/lessons/${lesson.id}`)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage;