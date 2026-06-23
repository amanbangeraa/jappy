import { type FC } from 'react';

interface BrandLogoProps {
  title?: string;
  size?: 'nav' | 'login';
  subtitle?: string;
  admin?: boolean;
}

const BrandLogo: FC<BrandLogoProps> = ({ title = 'Jappy', size = 'nav', subtitle, admin = false }) => (
  <div className={`brand-logo brand-logo-${size}${admin ? ' brand-logo-admin' : ''}`}>
    <div className="brand-mark" aria-hidden="true">
      <span className="brand-mark-kana">あ</span>
    </div>
    <div className="brand-logo-copy">
      <div className="brand-logo-title">{title}</div>
      {subtitle && <p className="brand-logo-subtitle">{subtitle}</p>}
    </div>
  </div>
);

export default BrandLogo;
