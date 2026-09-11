import type { RealtimeState } from '../api/client';

const TEXT: Record<RealtimeState, string> = {
  connecting: 'Connecting…',
  connected: 'Live',
  error: 'Live link lost',
  closed: 'Not connected',
};

export function LiveBadge({ state, detail }: { state: RealtimeState; detail?: string }) {
  return (
    <span className={`live live--${state}`} title={detail}>
      <span className="live__dot" aria-hidden />
      {TEXT[state]}
    </span>
  );
}
