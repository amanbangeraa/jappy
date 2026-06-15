import { type FC } from 'react';

interface FlashCardProps {
  japanese: string;
  reading?: string;
  english: string;
  flipped: boolean;
  onFlip: () => void;
}

const FlashCard: FC<FlashCardProps> = ({ japanese, reading, english, flipped, onFlip }) => {
  const truncate = (text: string, maxLen: number) =>
    text.length > maxLen ? text.slice(0, maxLen) + '…' : text;

  return (
    <div className="flip-container" onClick={onFlip} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <div className={`flip-inner${flipped ? ' flipped' : ''}`}>

        {/* FRONT — Japanese */}
        <div className="flip-face">
          <span className="tap-hint">Tap to reveal</span>
          <span className="font-jp" style={{
            fontSize: 'clamp(40px, 10vw, 64px)',
            fontWeight: 700,
            color: 'var(--heading)',
            lineHeight: 1.2,
            textAlign: 'center',
          }}>
            {truncate(japanese, 12)}
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
          }}>
            {truncate(english, 30)}
          </span>
          {reading && (
            <span className="font-jp" style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 600 }}>
              {reading}
            </span>
          )}
        </div>

      </div>
    </div>
  );
};

export default FlashCard;