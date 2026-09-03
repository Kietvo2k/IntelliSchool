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
    sm: { icon: 30, width: 30, height: 30, fontSize: '1.05rem', subSize: '0.65rem' },
    md: { icon: 38, width: 38, height: 38, fontSize: '1.25rem', subSize: '0.72rem' },
    lg: { icon: 52, width: 52, height: 52, fontSize: '1.65rem', subSize: '0.82rem' },
    xl: { icon: 72, width: 72, height: 72, fontSize: '2.1rem', subSize: '0.95rem' },
  }[size];

  const logoSrc = customLogoUrl ?? '/brand/intellischool-emblem.jpg';

  return (
    <div className={`brand-logo-container size-${size} ${className}`.trim()} aria-label="IntelliSchool Logo">
      <div
        className="brand-logo-emblem-wrap"
        style={{
          width: pixelSizes.width,
          height: pixelSizes.height,
          borderRadius: size === 'sm' ? 8 : 10,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(15, 118, 110, 0.16)',
          border: '1px solid rgba(15, 118, 110, 0.15)',
          background: '#FFFFFF',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <img
          src={logoSrc}
          alt="IntelliSchool Emblem"
          className="brand-logo-img"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scale(1.05)',
          }}
          onError={(e) => {
            // Fallback to SVG representation if image file fails to load
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      {showText && (
        <div className="brand-logo-text-group">
          <span className="brand-logo-title" style={{ fontSize: pixelSizes.fontSize }}>
            IntelliSchool
          </span>
          <span className="brand-logo-subtitle" style={{ fontSize: pixelSizes.subSize }}>
            {subtitle ?? 'Nền tảng trường số'}
          </span>
        </div>
      )}
    </div>
  );
}
