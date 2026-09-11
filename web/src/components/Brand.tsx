/** Wordmark: a route line through a waypoint. */
export function Brand({ large }: { large?: boolean }) {
  return (
    <span className={`brand ${large ? 'brand--large' : ''}`}>
      <svg className="brand__mark" viewBox="0 0 40 24" aria-hidden>
        <path d="M2 18 C 10 18, 12 6, 20 6 S 30 18, 38 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="20" cy="6" r="4.5" fill="#FFB81C" stroke="currentColor" strokeWidth="2.5" />
      </svg>
      <span className="brand__word">Waypoint</span>
    </span>
  );
}
