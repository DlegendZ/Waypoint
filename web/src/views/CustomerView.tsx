import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WaypointApi } from '../api/client';
import { ACTIVE_STAGES, type LatLng, type LocationUpdate, type Order, type OrderHistory, type User } from '../api/types';
import { LiveBadge } from '../components/LiveBadge';
import { MapView, type MapLine, type MapMarker } from '../components/MapView';
import { OrderList } from '../components/OrderList';
import { StageStrip } from '../components/StageStrip';
import { useToast } from '../components/Toasts';
import { formatDistance, formatEta, formatPosition, formatRelative, formatTime } from '../lib/format';
import { haversineKm } from '../lib/geo';
import { currentDevicePosition, errorMessage, useNow, usePolling } from '../lib/hooks';
import { useRealtime } from '../lib/useRealtime';

interface CustomerViewProps {
  api: WaypointApi;
  user: User;
}

export function CustomerView({ api }: CustomerViewProps) {
  const toast = useToast();
  const now = useNow(1000);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [placing, setPlacing] = useState<'pickup' | 'dropoff'>('pickup');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [live, setLive] = useState<LocationUpdate | null>(null);
  const [history, setHistory] = useState<OrderHistory | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setOrders(await api.listOrders());
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, [api]);
  usePolling(refresh, 4000);

  const selected = orders?.find((order) => order.id === selectedId) ?? null;
  const tracking = !!selected && ACTIVE_STAGES.includes(selected.currentStage);
  const { connection, state: liveState, detail: liveDetail } = useRealtime(api, tracking);

  useEffect(() => {
    setLive(null);
    setHistory(null);
    setConfirmCancel(false);
  }, [selectedId]);

  // The last known position from Redis, so the driver shows up before their next ping.
  useEffect(() => {
    if (selectedId == null || !tracking) return;
    let cancelled = false;
    api
      .getLatestLocation(selectedId)
      .then((latest) => {
        if (!cancelled && latest) setLive((current) => current ?? latest);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, selectedId, tracking]);

  useEffect(() => {
    if (!connection || selectedId == null || !tracking) return;
    return connection.subscribeOrder(selectedId, setLive);
  }, [connection, selectedId, tracking]);

  // Stage timeline + recorded route; refetched whenever the stage moves on.
  const stageKey = selected ? `${selected.id}:${selected.currentStage}` : null;
  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    api
      .getHistory(selectedId)
      .then((result) => {
        if (!cancelled) setHistory(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, stageKey]);

  const upsert = (order: Order) =>
    setOrders((current) => [order, ...(current ?? []).filter((o) => o.id !== order.id)].sort((a, b) => b.id - a.id));

  const submit = async () => {
    if (!pickup || !dropoff) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const order = await api.createOrder({
        pickUpLat: pickup.lat,
        pickUpLng: pickup.lng,
        dropOffLat: dropoff.lat,
        dropOffLng: dropoff.lng,
      });
      upsert(order);
      setPickup(null);
      setDropoff(null);
      setPlacing('pickup');
      setSelectedId(order.id);
      if (order.currentStage === 'ASSIGNED') {
        toast(`${order.driverName ?? 'A driver'} is heading to your pick-up.`, 'success');
      } else {
        toast('No drivers are free right now. Your order is waiting.', 'info');
      }
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOrder = async () => {
    if (!selected) return;
    setCancelling(true);
    try {
      upsert(await api.updateOrderStage(selected.id, 'CANCELLED'));
      toast(`Delivery #${selected.id} cancelled.`, 'info');
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  };

  const useMyLocation = async () => {
    setFormError(null);
    try {
      setPickup(await currentDevicePosition());
      setPlacing('dropoff');
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const onMapClick = (position: LatLng) => {
    setFormError(null);
    if (placing === 'pickup') {
      setPickup(position);
      if (!dropoff) setPlacing('dropoff');
    } else {
      setDropoff(position);
    }
  };

  const { markers, lines } = useMemo(() => {
    const m: MapMarker[] = [];
    const l: MapLine[] = [];
    if (!selected) {
      if (pickup) m.push({ id: 'draft-pickup', position: pickup, kind: 'pickup', label: 'Pick-up' });
      if (dropoff) m.push({ id: 'draft-dropoff', position: dropoff, kind: 'dropoff', label: 'Drop-off' });
      if (pickup && dropoff) l.push({ id: 'draft-plan', points: [pickup, dropoff], kind: 'planned' });
      return { markers: m, lines: l };
    }
    const from = { lat: selected.pickUpLat, lng: selected.pickUpLng };
    const to = { lat: selected.dropOffLat, lng: selected.dropOffLng };
    m.push({ id: `pickup-${selected.id}`, position: from, kind: 'pickup', label: 'Pick-up' });
    m.push({ id: `dropoff-${selected.id}`, position: to, kind: 'dropoff', label: 'Drop-off' });
    l.push({ id: `plan-${selected.id}`, points: [from, to], kind: 'planned' });
    if (history && history.route.length > 1) {
      l.push({ id: `route-${selected.id}`, points: history.route, kind: 'travelled' });
    }
    if (tracking && live) {
      const driverAt = { lat: live.lat, lng: live.lng };
      m.push({ id: `driver-${selected.id}`, position: driverAt, kind: 'driver', label: selected.driverName ?? 'Your driver', live: liveState === 'connected' });
      l.push({ id: `approach-${selected.id}`, points: [driverAt, selected.currentStage === 'ASSIGNED' ? from : to], kind: 'approach' });
    }
    return { markers: m, lines: l };
  }, [selected, pickup, dropoff, history, tracking, live, liveState]);

  const fitKey = selected ? `order-${selected.id}-${tracking && live ? 'live' : 'static'}-${history ? 'h' : ''}` : 'compose';
  const lastUpdate = live ? new Date(Number(live.timestamp) * 1000) : null;
  const draftDistance = pickup && dropoff ? haversineKm(pickup, dropoff) : null;

  return (
    <div className="workspace">
      <aside className="panel" aria-label="Deliveries">
        {!selected ? (
          <section className="panel__section">
            <h1 className="panel__title">Send something across town</h1>
            <p className="muted">Pick two points on the map. Waypoint matches you with the nearest free driver.</p>

            <div className="pointer-pick" role="group" aria-label="Choose which point the next map click sets">
              <button type="button" className={`point ${placing === 'pickup' ? 'is-placing' : ''}`} onClick={() => setPlacing('pickup')}>
                <span className="wp-pin wp-pin--pickup point__pin">P</span>
                <span className="point__text">
                  <span className="point__name">Pick-up</span>
                  <span className="point__value">{pickup ? formatPosition(pickup) : 'Click the map'}</span>
                </span>
              </button>
              <button type="button" className={`point ${placing === 'dropoff' ? 'is-placing' : ''}`} onClick={() => setPlacing('dropoff')}>
                <span className="wp-pin wp-pin--dropoff point__pin">D</span>
                <span className="point__text">
                  <span className="point__name">Drop-off</span>
                  <span className="point__value">{dropoff ? formatPosition(dropoff) : 'Click the map'}</span>
                </span>
              </button>
            </div>

            <div className="row">
              <button type="button" className="link-button" onClick={useMyLocation}>
                Use my location as the pick-up
              </button>
              {(pickup || dropoff) && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setPickup(null);
                    setDropoff(null);
                    setPlacing('pickup');
                  }}
                >
                  Clear points
                </button>
              )}
            </div>

            {draftDistance !== null && (
              <p className="muted">
                {formatDistance(draftDistance)} apart in a straight line.
              </p>
            )}
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button type="button" className="button button--primary button--wide" disabled={!pickup || !dropoff || submitting} onClick={submit}>
              {submitting ? 'Finding a driver…' : 'Request delivery'}
            </button>
          </section>
        ) : (
          <section className="panel__section">
            <div className="section-head">
              <h1 className="panel__title">Delivery #{selected.id}</h1>
              {tracking && <LiveBadge state={liveState} detail={liveDetail} />}
            </div>
            <p className="muted small">Placed {formatTime(selected.createdAt)}</p>

            <StageStrip stage={selected.currentStage} history={history?.stages} createdAt={selected.createdAt} />

            {selected.flagged && (
              <p className="banner banner--warn">
                Flagged for the dispatcher: {selected.flagReason ?? 'needs attention'}. They'll follow up.
              </p>
            )}

            {selected.currentStage === 'CREATED' && (
              <p className="status-copy">
                No driver was free when you ordered, and orders aren't re-matched automatically yet. Cancel this one and order
                again once drivers are online.
              </p>
            )}

            {tracking && (
              <div className="eta">
                {live ? (
                  <>
                    <span className="eta__value">{formatEta(live.eta)}</span>
                    <span className="eta__context">
                      {selected.currentStage === 'ASSIGNED'
                        ? `until ${selected.driverName ?? 'your driver'} reaches the pick-up`
                        : `until your delivery reaches the drop-off`}
                    </span>
                    <span className="eta__meta">
                      {formatDistance(live.distance)} away in a straight line, updated {formatRelative(lastUpdate, now)}
                    </span>
                  </>
                ) : (
                  <span className="eta__context">Waiting for {selected.driverName ?? 'your driver'}'s first location update…</span>
                )}
              </div>
            )}

            {selected.currentStage === 'DELIVERED' && (
              <p className="status-copy">
                Delivered by {selected.driverName ?? 'your driver'}.
                {history && history.route.length > 1 ? ' The blue line on the map is the route they took.' : ''}
              </p>
            )}
            {selected.currentStage === 'CANCELLED' && <p className="status-copy">This delivery was cancelled.</p>}

            {(selected.currentStage === 'CREATED' || selected.currentStage === 'ASSIGNED') &&
              (confirmCancel ? (
                <div className="confirm">
                  <span>Cancel delivery #{selected.id}?</span>
                  <button type="button" className="button button--danger" onClick={cancelOrder} disabled={cancelling}>
                    {cancelling ? 'Cancelling…' : 'Yes, cancel it'}
                  </button>
                  <button type="button" className="button" onClick={() => setConfirmCancel(false)}>
                    Keep it
                  </button>
                </div>
              ) : (
                <button type="button" className="button" onClick={() => setConfirmCancel(true)}>
                  Cancel delivery
                </button>
              ))}

            <button type="button" className="link-button back" onClick={() => setSelectedId(null)}>
              Start a new delivery
            </button>
          </section>
        )}

        <section className="panel__section">
          <h2 className="section-title">Your deliveries</h2>
          {loadError && <p className="form-error">{loadError}</p>}
          {orders === null && !loadError ? (
            <p className="empty">Loading…</p>
          ) : (
            <OrderList
              orders={orders ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
              describe={(order) => (order.driverName ? `Driver: ${order.driverName}` : null)}
              empty="No deliveries yet. Your first one will show up here."
            />
          )}
        </section>
      </aside>

      <div className="workspace__map">
        <MapView markers={markers} lines={lines} fitKey={fitKey} onMapClick={selected ? undefined : onMapClick} ariaLabel="Delivery map" />
        {!selected && (
          <p className="map-hint" aria-live="polite">
            Click the map to set the <strong>{placing === 'pickup' ? 'pick-up' : 'drop-off'}</strong> point
          </p>
        )}
      </div>
    </div>
  );
}
