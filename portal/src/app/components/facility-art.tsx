import { FACILITY_TYPES } from "@/lib/shared";

// Illustration for a facility type
export function FacilityArt({ typeCode, muted = false, className }: { typeCode: number; muted?: boolean; className?: string }) {
  const cls = `facility-art${muted ? " is-muted" : ""}${className ? " " + className : ""}`;
  if (typeCode === FACILITY_TYPES.SwimmingPool) return <PoolArt className={cls} />;
  if (typeCode === FACILITY_TYPES.IndoorCourt) return <CourtArt className={cls} />;
  return <PitchArt className={cls} />;
}

// Pitch drawing
function PitchArt({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="pitch-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f8f55" />
          <stop offset="1" stopColor="#0f5c36" />
        </linearGradient>
      </defs>
      <rect width="320" height="160" fill="url(#pitch-bg)" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={i * 40} width="20" height="160" fill="#ffffff" opacity="0.05" />
      ))}
      <g fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2">
        <rect x="20" y="16" width="280" height="128" rx="2" />
        <line x1="160" y1="16" x2="160" y2="144" />
        <circle cx="160" cy="80" r="22" />
        <rect x="20" y="48" width="36" height="64" />
        <rect x="264" y="48" width="36" height="64" />
      </g>
      <circle cx="160" cy="80" r="3" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}

// Court drawing
function CourtArt({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="court-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f5fd0" />
          <stop offset="1" stopColor="#1b3a8a" />
        </linearGradient>
      </defs>
      <rect width="320" height="160" fill="url(#court-bg)" />
      <rect x="40" y="20" width="240" height="120" fill="#f08a3c" opacity="0.9" />
      <g fill="none" stroke="#ffffff" strokeWidth="2.5">
        <rect x="40" y="20" width="240" height="120" />
        <line x1="160" y1="20" x2="160" y2="140" />
        <line x1="40" y1="80" x2="280" y2="80" strokeOpacity="0.6" />
        <line x1="100" y1="20" x2="100" y2="140" strokeOpacity="0.6" />
        <line x1="220" y1="20" x2="220" y2="140" strokeOpacity="0.6" />
      </g>
      <line x1="160" y1="14" x2="160" y2="146" stroke="#1b1f1a" strokeWidth="4" opacity="0.5" />
    </svg>
  );
}

// Pool drawing
function PoolArt({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="pool-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#35b6e8" />
          <stop offset="1" stopColor="#0e6ea8" />
        </linearGradient>
      </defs>
      <rect width="320" height="160" fill="url(#pool-bg)" />
      {[32, 64, 96, 128].map((y) => (
        <g key={y}>
          <line x1="0" y1={y} x2="320" y2={y} stroke="#ffffff" strokeWidth="3" strokeDasharray="10 8" opacity="0.75" />
          <line x1="0" y1={y} x2="320" y2={y} stroke="#e8453c" strokeWidth="3" strokeDasharray="10 44" opacity="0.8" />
        </g>
      ))}
      <g fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2">
        <path d="M0 48 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" />
        <path d="M0 112 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" />
      </g>
    </svg>
  );
}
