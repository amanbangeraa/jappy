import { type FC, useEffect, useState } from 'react';
import Icon from './Icon';

interface XPBadgeProps {
  xp: number;
  delay?: number;
}

const XPBadge: FC<XPBadgeProps> = ({ xp, delay = 0 }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className="xp-badge"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.5)',
      }}
    >
      <Icon name="flame" size={28} strokeWidth={1.5} color="#fff"
        style={{ filter: 'drop-shadow(0 0 8px rgba(255,200,100,0.8))' }}
      />
      <span style={{ fontSize: 24, fontWeight: 900 }}>+{xp} XP</span>
    </div>
  );
};

export default XPBadge;