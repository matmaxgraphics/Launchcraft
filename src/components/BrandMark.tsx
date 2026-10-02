export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="23" height="23" rx="7" fill="#121215" stroke="#2a2a31" />
      <path d="M4.5 18.5 C 9 18.5, 10.5 17, 12 13.2 S 15.5 6.2, 19.5 5.5" stroke="url(#bm)" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="bm" x1="4" y1="19" x2="20" y2="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8f7cff" />
          <stop offset="1" stopColor="#4ade80" />
        </linearGradient>
      </defs>
    </svg>
  );
}
