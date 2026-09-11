import type { Stage, StageChange } from '../api/types';
import { formatTime } from '../lib/format';

const STOPS: { stage: Stage; label: string }[] = [
  { stage: 'CREATED', label: 'Placed' },
  { stage: 'ASSIGNED', label: 'Driver assigned' },
  { stage: 'PICKED_UP', label: 'Picked up' },
  { stage: 'ON_THE_WAY', label: 'On the way' },
  { stage: 'DELIVERED', label: 'Delivered' },
];

interface StageStripProps {
  stage: Stage;
  /** When known, cancellation is drawn at the stop it happened after, and stops show their times. */
  history?: StageChange[];
  createdAt?: string;
  compact?: boolean;
}

/**
 * The order's life drawn as a transit line: stops passed are filled, the current stop is ringed in
 * hi-vis amber, and a cancelled order leaves the line in red right after the last stop it reached.
 */
export function StageStrip({ stage, history, createdAt, compact }: StageStripProps) {
  const cancelled = stage === 'CANCELLED';
  const cancelledFrom = cancelled ? (history?.find((h) => h.toStage === 'CANCELLED')?.fromStage ?? 'CREATED') : null;
  const reachedIndex = STOPS.findIndex((s) => s.stage === (cancelled ? cancelledFrom : stage));
  const stops = cancelled ? STOPS.slice(0, reachedIndex + 1) : STOPS;

  const timeFor = (target: Stage) => (target === 'CREATED' ? createdAt : history?.find((h) => h.toStage === target)?.changedAt);

  return (
    <ol
      className={`strip ${compact ? 'strip--compact' : ''}`}
      style={{ ['--stops' as string]: cancelled ? stops.length + 1 : STOPS.length }}
      aria-label="Delivery progress"
    >
      {stops.map((stop, index) => {
        const state = index < reachedIndex || cancelled ? 'done' : index === reachedIndex ? 'current' : 'todo';
        const time = state !== 'todo' ? timeFor(stop.stage) : undefined;
        return (
          <li key={stop.stage} className={`strip__stop is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="strip__dot" aria-hidden />
            <span className="strip__label">{stop.label}</span>
            {!compact && time && <span className="strip__time">{formatTime(time)}</span>}
          </li>
        );
      })}
      {cancelled && (
        <li className="strip__stop is-cancel" aria-current="step">
          <span className="strip__dot" aria-hidden />
          <span className="strip__label">Cancelled</span>
          {!compact && timeFor('CANCELLED') && <span className="strip__time">{formatTime(timeFor('CANCELLED'))}</span>}
        </li>
      )}
    </ol>
  );
}

/** Dispatcher board: the same line, with how many orders currently sit at each stop. */
export function StageCounts({ counts }: { counts: Partial<Record<Stage, number>> }) {
  return (
    <ol className="strip strip--counts" style={{ ['--stops' as string]: STOPS.length }} aria-label="Orders by stage">
      {STOPS.map((stop) => (
        <li key={stop.stage} className={`strip__stop ${counts[stop.stage] ? 'has-count' : ''}`}>
          <span className="strip__dot" aria-hidden />
          <span className="strip__count">{counts[stop.stage] ?? 0}</span>
          <span className="strip__label">{stop.label}</span>
        </li>
      ))}
    </ol>
  );
}
