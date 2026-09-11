import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WaypointApi } from '../api/client';
import { ACTIVE_STAGES, type DriverProfile, type LatLng, type Order, type Stage, type User } from '../api/types';
import { LiveBadge } from '../components/LiveBadge';
import { MapView, type MapLine, type MapMarker } from '../components/MapView';
import { OrderList } from '../components/OrderList';
import { StageStrip } from '../components/StageStrip';
import { useToast } from '../components/Toasts';
import { STAGE_LABEL, formatDistance, formatEta, formatPosition, formatRelative } from '../lib/format';
import { easedPoint, etaMinutes, haversineKm } from '../lib/geo';
import { currentDevicePosition, errorMessage, useNow, usePolling } from '../lib/hooks';
import { useRealtime } from '../lib/useRealtime';

interface DriverViewProps {
  api: WaypointApi;
  user: User;
}

/** Pings every 2 s while driving — the PRD asks for 3-5 s; a little faster reads better in a demo. */
const PING_INTERVAL_MS = 2000;

const NEXT_ACTION: Partial<Record<Stage, { to: Stage; label: string }>> = {
  ASSIGNED: { to: 'PICKED_UP', label: 'Confirm pick-up' },
  PICKED_UP: { to: 'ON_THE_WAY', label: 'Start the trip' },
  ON_THE_WAY: { to: 'DELIVERED', label: 'Confirm delivery' },
};

interface Drive {
  orderId: number;
  from: LatLng;
  to: LatLng;
  steps: number;
  step: number;
}

export function DriverView({ api }: DriverViewProps) {
  const toast = useToast();
  const now = useNow(1000);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'status' | 'stage' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'offline' | 'cancel' | null>(null);
  const [drive, setDrive] = useState<Drive | null>(null);
  const [lastPing, setLastPing] = useState<{ at: number; sent: boolean } | null>(null);
  const [selectedPast, setSelectedPast] = useState<number | null>(null);
  const knownOrderIds = useRef<Set<number> | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextProfile, nextOrders] = await Promise.all([api.getDriverProfile(), api.listOrders()]);
      setProfile(nextProfile);
      setPosition((current) =>
        current ?? (nextProfile.currentLat != null && nextProfile.currentLng != null ? { lat: nextProfile.currentLat, lng: nextProfile.currentLng } : null),
      );
      if (knownOrderIds.current) {
        for (const order of nextOrders) {
          if (!knownOrderIds.current.has(order.id) && ACTIVE_STAGES.includes(order.currentStage)) {
            toast(`New delivery #${order.id} for ${order.customerName ?? 'a customer'}. Head to the pick-up.`, 'success');
          }
        }
      }
      knownOrderIds.current = new Set(nextOrders.map((o) => o.id));
      setOrders(nextOrders);
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, [api, toast]);
  usePolling(load, 4000);

  const online = !!profile && profile.status !== 'OFFLINE';
  const { connection, state: liveState, detail: liveDetail } = useRealtime(api, online);

  const active = orders?.find((order) => ACTIVE_STAGES.includes(order.currentStage)) ?? null;
  const pickup = active ? { lat: active.pickUpLat, lng: active.pickUpLng } : null;
  const dropoff = active ? { lat: active.dropOffLat, lng: active.dropOffLng } : null;
  const target = active ? (active.currentStage === 'ASSIGNED' ? pickup : dropoff) : null;
  const pastOrders = (orders ?? []).filter((order) => !ACTIVE_STAGES.includes(order.currentStage));

  /** Move to a new spot: over the live link while on an order, otherwise saved to the profile for matching. */
  const moveTo = useCallback(
    async (next: LatLng) => {
      setPosition(next);
      if (active && connection && liveState === 'connected') {
        const sent = connection.publishLocation(active.id, next);
        setLastPing({ at: Date.now(), sent });
        return;
      }
      if (active && online) {
        setLastPing({ at: Date.now(), sent: false });
      }
      if (profile) {
        try {
          setProfile(await api.updateDriverStatus(profile.status, next));
        } catch (error) {
          toast(errorMessage(error), 'error');
        }
      }
    },
    [active, connection, liveState, online, profile, api, toast],
  );

  // Simulated drive: step along an eased straight line, sending a ping at each step.
  const moveRef = useRef(moveTo);
  moveRef.current = moveTo;
  const driveRef = useRef(drive);
  driveRef.current = drive;
  const driving = drive !== null;
  useEffect(() => {
    if (!driving) return;
    const id = setInterval(() => {
      const current = driveRef.current;
      if (!current) return;
      const step = current.step + 1;
      void moveRef.current(easedPoint(current.from, current.to, step / current.steps));
      if (step >= current.steps) {
        setDrive(null);
        toast('You have arrived.', 'success');
      } else {
        setDrive({ ...current, step });
      }
    }, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [driving, toast]);

  // Stop driving if the order finished or its target changed underneath us.
  useEffect(() => {
    if (!drive) return;
    if (!active || active.id !== drive.orderId || !target || target.lat !== drive.to.lat || target.lng !== drive.to.lng || !online) {
      setDrive(null);
    }
  }, [drive, active, target, online]);

  const startDrive = () => {
    if (!active || !target || !position) return;
    const meters = haversineKm(position, target) * 1000;
    const steps = Math.min(40, Math.max(5, Math.round(meters / 150)));
    setDrive({ orderId: active.id, from: position, to: target, steps, step: 0 });
    // First ping right away so the customer sees the driver immediately.
    void moveTo(easedPoint(position, target, 0));
  };

  const setStatus = async (status: 'ONLINE_AVAILABLE' | 'OFFLINE') => {
    if (status === 'ONLINE_AVAILABLE' && !position) {
      setNotice('Set your position first: click the map or use your device location.');
      return;
    }
    setBusy('status');
    setNotice(null);
    setDrive(null);
    try {
      setProfile(await api.updateDriverStatus(status, position ?? undefined));
      toast(status === 'OFFLINE' ? "You're offline." : "You're online.", 'info');
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const changeStage = async (stage: Stage) => {
    if (!active) return;
    setBusy('stage');
    try {
      const updated = await api.updateOrderStage(active.id, stage);
      setOrders((current) => (current ?? []).map((o) => (o.id === updated.id ? updated : o)));
      toast(`Delivery #${updated.id}: ${STAGE_LABEL[updated.currentStage].toLowerCase()}.`, 'success');
      if (stage === 'DELIVERED' || stage === 'CANCELLED') {
        setProfile(await api.getDriverProfile());
      }
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const useDeviceLocation = async () => {
    setDrive(null);
    try {
      await moveTo(await currentDevicePosition());
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  };

  const selectedPastOrder = pastOrders.find((o) => o.id === selectedPast) ?? null;
  const shown = active ?? selectedPastOrder;

  const { markers, lines } = useMemo(() => {
    const m: MapMarker[] = [];
    const l: MapLine[] = [];
    if (shown) {
      const from = { lat: shown.pickUpLat, lng: shown.pickUpLng };
      const to = { lat: shown.dropOffLat, lng: shown.dropOffLng };
      m.push({ id: `pickup-${shown.id}`, position: from, kind: 'pickup', label: `Pick-up for ${shown.customerName ?? 'customer'}` });
      m.push({ id: `dropoff-${shown.id}`, position: to, kind: 'dropoff', label: 'Drop-off' });
      l.push({ id: `plan-${shown.id}`, points: [from, to], kind: 'planned' });
    }
    if (position) {
      m.push({ id: 'me', position, kind: 'driver', label: 'You', live: online && liveState === 'connected' });
      if (active && target) l.push({ id: 'approach', points: [position, target], kind: 'approach' });
    }
    return { markers: m, lines: l };
  }, [shown, position, online, liveState, active, target]);

  const fitKey = shown ? `order-${shown.id}` : `me-${position ? 'set' : 'unset'}`;
  const next = active ? NEXT_ACTION[active.currentStage] : undefined;
  const toTarget = position && target ? haversineKm(position, target) : null;

  let headline = 'Loading…';
  let subline = '';
  if (profile) {
    if (profile.status === 'OFFLINE') {
      headline = "You're offline";
      subline = active
        ? `Delivery #${active.id} is still yours. Go online to keep sharing your location.`
        : "Customers can't be matched with you until you go online.";
    } else if (active) {
      headline = `On delivery #${active.id}`;
      subline = `For ${active.customerName ?? 'a customer'}.`;
    } else {
      headline = "You're available";
      subline =
        api.mode === 'demo'
          ? 'Waiting for an order. Sign in as the customer in another tab and order near you to get matched.'
          : "Waiting for an order. You'll be matched when a customer near you orders.";
    }
  }

  return (
    <div className="workspace">
      <aside className="panel" aria-label="Driver console">
        <section className="panel__section">
          <div className="section-head">
            <h1 className={`panel__title status-${profile?.status.toLowerCase() ?? 'loading'}`}>{headline}</h1>
            {online && <LiveBadge state={liveState} detail={liveDetail} />}
          </div>
          <p className="muted">{subline}</p>
          {loadError && <p className="form-error">{loadError}</p>}
          {notice && <p className="banner banner--warn">{notice}</p>}

          {profile &&
            (profile.status === 'OFFLINE' ? (
              <button type="button" className="button button--primary button--wide" onClick={() => setStatus('ONLINE_AVAILABLE')} disabled={busy === 'status'}>
                {busy === 'status' ? 'Going online…' : 'Go online'}
              </button>
            ) : confirm === 'offline' ? (
              <div className="confirm">
                <span>Going offline mid-delivery flags #{active?.id} for the dispatcher.</span>
                <button type="button" className="button button--danger" onClick={() => setStatus('OFFLINE')} disabled={busy === 'status'}>
                  Go offline anyway
                </button>
                <button type="button" className="button" onClick={() => setConfirm(null)}>
                  Stay online
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button--wide"
                onClick={() => (active ? setConfirm('offline') : setStatus('OFFLINE'))}
                disabled={busy === 'status'}
              >
                Go offline
              </button>
            ))}
          {online && <p className="muted small">Keep this tab open while you're online. Closing it takes you offline.</p>}
        </section>

        <section className="panel__section">
          <h2 className="section-title">Your position</h2>
          <p className="coords">{formatPosition(position)}</p>
          <div className="row">
            <button type="button" className="link-button" onClick={useDeviceLocation}>
              Use device location
            </button>
          </div>
          <p className="muted small">Click anywhere on the map to move there{active ? ' — it is sent to your customer live.' : '.'}</p>
        </section>

        {active && (
          <section className="panel__section panel__section--active">
            <h2 className="section-title">Delivery #{active.id}</h2>
            <StageStrip stage={active.currentStage} createdAt={active.createdAt} compact />
            {active.flagged && <p className="banner banner--warn">Flagged for the dispatcher: {active.flagReason ?? 'needs attention'}.</p>}

            <dl className="facts">
              <div>
                <dt>Heading to</dt>
                <dd>{active.currentStage === 'ASSIGNED' ? 'The pick-up' : 'The drop-off'}</dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd>
                  {toTarget === null
                    ? '—'
                    : etaMinutes(toTarget) < 1
                      ? `${formatDistance(toTarget)}, less than a minute away`
                      : `${formatDistance(toTarget)}, about ${formatEta(etaMinutes(toTarget))} away`}
                </dd>
              </div>
              <div>
                <dt>Location sent</dt>
                <dd>{lastPing ? (lastPing.sent ? formatRelative(new Date(lastPing.at), now) : 'Not sent — live link is down') : 'Not yet'}</dd>
              </div>
            </dl>

            {drive ? (
              <button type="button" className="button button--wide" onClick={() => setDrive(null)}>
                Stop driving ({Math.round((drive.step / drive.steps) * 100)}%)
              </button>
            ) : (
              <button
                type="button"
                className="button button--wide"
                onClick={startDrive}
                disabled={!position || !online || liveState !== 'connected' || (toTarget !== null && toTarget < 0.005)}
                title={!online ? 'Go online first' : liveState !== 'connected' ? 'Waiting for the live link' : undefined}
              >
                Drive to the {active.currentStage === 'ASSIGNED' ? 'pick-up' : 'drop-off'} (simulated)
              </button>
            )}

            {next && (
              <button type="button" className="button button--primary button--wide" onClick={() => changeStage(next.to)} disabled={busy === 'stage'}>
                {busy === 'stage' ? 'Saving…' : next.label}
              </button>
            )}

            {active.currentStage === 'ASSIGNED' &&
              (confirm === 'cancel' ? (
                <div className="confirm">
                  <span>Cancel delivery #{active.id}? The customer will need to order again.</span>
                  <button type="button" className="button button--danger" onClick={() => changeStage('CANCELLED')} disabled={busy === 'stage'}>
                    Yes, cancel
                  </button>
                  <button type="button" className="button" onClick={() => setConfirm(null)}>
                    Keep it
                  </button>
                </div>
              ) : (
                <button type="button" className="link-button link-button--danger" onClick={() => setConfirm('cancel')}>
                  Can't take this delivery
                </button>
              ))}
          </section>
        )}

        <section className="panel__section">
          <h2 className="section-title">Past deliveries</h2>
          <OrderList
            orders={pastOrders}
            selectedId={active ? null : selectedPast}
            onSelect={(id) => setSelectedPast((current) => (current === id ? null : id))}
            describe={(order) => (order.customerName ? `For ${order.customerName}` : null)}
            empty="Finished deliveries will show up here."
          />
        </section>
      </aside>

      <div className="workspace__map">
        <MapView
          markers={markers}
          lines={lines}
          fitKey={fitKey}
          onMapClick={(next) => {
            setDrive(null);
            void moveTo(next);
          }}
          ariaLabel="Driver map"
        />
        {!position && <p className="map-hint">Click the map to set where you are</p>}
      </div>
    </div>
  );
}
