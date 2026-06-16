import { type FC } from 'react';

interface FlashCardProps {
  japanese: string;
  reading?: string;
  english: string;
  flipped: boolean;
  onFlip: () => void;
}

const FlashCard: FC<FlashCardProps> = ({ japanese, reading, english, flipped, onFlip }) => {
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
          <span className="tap-hint">Tap to reveal</span>
          <span className="font-jp" style={{
            fontSize: jpFontSize,
            fontWeight: 700,
            color: 'var(--heading)',
            lineHeight: 1.3,
            textAlign: 'center',
            wordBreak: 'keep-all',
            overflowWrap: 'anywhere',
            maxWidth: '100%',
            padding: '0 4px',
          }}>
            {japanese}
          </span>
          {reading ? (
            <span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 600 }}>
              {reading}
            </span>
          ) : (
            <span style={{ height: 4, width: 48, borderRadius: 999, background: 'var(--border)', display: 'block' }} />
          )}
        </div>

        {/* BACK — English */}
        <div className="flip-face flip-face-back">
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
          }}>
            Meaning
          </span>
          <span style={{
            fontSize: 'clamp(24px, 6vw, 36px)',
            fontWeight: 800,
            color: 'var(--heading)',
            lineHeight: 1.3,
            textAlign: 'center',
            wordBreak: 'keep-all',
            overflowWrap: 'anywhere',
            maxWidth: '100%',
            padding: '0 4px',
          }}>
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
        </div>
      </div>
    </div>
  );
};

export default FlashCard;