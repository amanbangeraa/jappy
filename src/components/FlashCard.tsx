import { type FC } from 'react';

interface FlashCardProps {
  japanese: string;
  reading?: string;
  english: string;
  flipped: boolean;
  onFlip: () => void;
  kanjiMode?: boolean;
}

const FlashCard: FC<FlashCardProps> = ({ japanese, reading, english, flipped, onFlip, kanjiMode = false }) => {
  // Dynamically scale Japanese font size based on text length so longer
  // words / phrases always fit comfortably inside the card.
  const jpFontSize = (() => {
    const len = japanese.length;
    if (len <= 3) return 'clamp(48px, 12vw, 72px)';
    if (len <= 6) return 'clamp(36px, 9vw, 56px)';
    if (len <= 9) return 'clamp(28px, 7vw, 44px)';
    return 'clamp(22px, 5.5vw, 36px)';
  })();

  return (
    <div className="flip-container" onClick={onFlip} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <div className={`flip-inner${flipped ? ' flipped' : ''}`}>

        {/* FRONT — Japanese */}
        <div className="flip-face">
          {!kanjiMode && <span className="tap-hint">Tap to reveal</span>}
          <span className="font-jp flash-card-text" style={{ fontSize: jpFontSize }}>
            {japanese}
          </span>
          {!kanjiMode && reading ? (
            <span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 600 }}>
              {reading}
            </span>
          ) : !kanjiMode ? (
            <span style={{ height: 4, width: 48, borderRadius: 999, background: 'var(--border)', display: 'block' }} />
          ) : null}
        </div>

        {/* BACK — English */}
        <div className="flip-face flip-face-back">
          {kanjiMode ? (
            <>
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
              }}>
                Kanji
              </span>
              <span className="font-jp flash-card-text" style={{ fontSize: 'clamp(34px, 8vw, 54px)' }}>
                {japanese}
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
              }}>
                Romaji
              </span>
              <span className="flash-card-meaning">
                {reading ?? '—'}
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
                marginTop: 10,
              }}>
                Translation
              </span>
              <span className="flash-card-meaning" style={{ fontSize: 'clamp(20px, 5vw, 34px)' }}>
                {english}
              </span>
            </>
          ) : (
            <>
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
              }}>
                Meaning
              </span>
              <span className="flash-card-meaning">
                {english}
              </span>
              {reading && (
                <span className="font-jp" style={{
                  fontSize: 18,
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}>
                  {reading}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlashCard;