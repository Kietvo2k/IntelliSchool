export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  customLogoUrl?: string;
  className?: string;
}

export function BrandLogo({
  size = 'md',
  showText = true,
  subtitle,
  customLogoUrl,
  className = '',
}: BrandLogoProps) {
  const pixelSizes = {
    sm: { icon: 26, width: 26, height: 26, fontSize: '1rem', subSize: '0.65rem' },
    md: { icon: 34, width: 34, height: 34, fontSize: '1.25rem', subSize: '0.72rem' },
    lg: { icon: 48, width: 48, height: 48, fontSize: '1.65rem', subSize: '0.82rem' },
    xl: { icon: 64, width: 64, height: 64, fontSize: '2.1rem', subSize: '0.95rem' },
  }[size];

  return (
    <div className={`brand-logo-container size-${size} ${className}`.trim()} aria-label="Smart Path Platform Logo">
      {customLogoUrl ? (
        <img
          src={customLogoUrl}
          alt="Brand Logo"
          className="custom-brand-logo"
          style={{ width: pixelSizes.width, height: pixelSizes.height, objectFit: 'contain' }}
        />
      ) : (
        <div className="brand-logo-emblem-wrap" style={{ width: pixelSizes.width, height: pixelSizes.height }}>
          <svg
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="brand-logo-svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="smartPathGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#256c4d" />
                <stop offset="100%" stopColor="#113525" />
              </linearGradient>
              <linearGradient id="smartPathLime" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#e2f58e" />
                <stop offset="100%" stopColor="#c5e656" />
              </linearGradient>
              <filter id="smartPathGlow" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1e543c" floodOpacity="0.25" />
              </filter>
            </defs>

            {/* Base Rounded Shield / Diamond Emblem */}
            <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#smartPathGrad)" filter="url(#smartPathGlow)" />

            {/* Inner Glowing Pathway */}
            <path
              d="M12 34C16 34 18 28 24 28C30 28 32 34 36 34"
              stroke="#87b68d"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="1 3"
            />

            {/* Graduation Cap Top */}
            <path
              d="M24 13L36 19L24 25L12 19L24 13Z"
              fill="url(#smartPathLime)"
            />

            {/* Cap Under-body */}
            <path
              d="M16 22.5V27C16 29.5 19.5 31.5 24 31.5C28.5 31.5 32 29.5 32 27V22.5L24 26.5L16 22.5Z"
              fill="#d7ed8a"
              fillOpacity="0.9"
            />

            {/* Tassel & Sparkle Star */}
            <circle cx="36" cy="22" r="2" fill="#ec7249" />
            <path d="M36 24V28" stroke="#ec7249" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="24" cy="19" r="1.5" fill="#1e543c" />
          </svg>
        </div>
      )}

      {showText && (
        <div className="brand-logo-text-group">
          <span className="brand-logo-title" style={{ fontSize: pixelSizes.fontSize }}>
            Smart Path Platform
          </span>
          <span className="brand-logo-subtitle" style={{ fontSize: pixelSizes.subSize }}>
            {subtitle ?? 'Nền tảng trường số'}
          </span>
        </div>
      )}
    </div>
  );
}
