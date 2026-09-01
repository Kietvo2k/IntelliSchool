export function CbtBackdrop({ stage }: { stage: 'gate' | 'lobby' | 'taking' }) {
  const paper = stage !== 'gate';
  return (
    <svg className="cbt-backdrop" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="1440" height="900" fill={paper ? '#e8eef6' : '#08366a'} />
      <polygon points="0,900 420,520 0,420" fill={paper ? '#d5e3f4' : '#0b4a8c'} />
      <polygon points="1440,0 980,0 1440,280" fill={paper ? '#c5d8ef' : '#0d5cad'} />
      {stage === 'taking' && <polygon points="720,900 1440,640 1440,900" fill="#dce7f4" />}
    </svg>
  );
}
