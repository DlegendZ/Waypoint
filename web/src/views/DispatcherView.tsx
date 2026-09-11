import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WaypointApi } from '../api/client';
import {
  ACTIVE_STAGES,
  OPEN_STAGES,
  type DispatchOverview,
  type DriverProfile,
  type DriverStatus,
  type Order,
  type OrderHistory,
} from '../api/types';
import { MapView, type MapLine, type MapMarker } from '../components/MapView';
import { OrderList } from '../components/OrderList';
import { StageCounts, StageStrip } from '../components/StageStrip';
import { DRIVER_STATUS_LABEL, formatDistance, formatTime } from '../lib/format';
import { haversineKm } from '../lib/geo';
import { errorMessage, usePolling } from '../lib/hooks';

type Filter = 'open' | 'flagged' | 'finished' | 'all';

const FILTERS: { id: Filter; label: string; keep: (order: Order) => boolean }[] = [
  { id: 'open', label: 'Open', keep: (o) => OPEN_STAGES.includes(o.currentStage) },
  { id: 'flagged', label: 'Flagged', keep: (o) => o.flagged },
  { id: 'finished', label: 'Finished', keep: (o) => !OPEN_STAGES.includes(o.currentStage) },
  { id: 'all', label: 'All', keep: () => true },
];

const DRIVER_KIND: Record<DriverStatus, MapMarker['kind']> = {
  ONLINE_AVAILABLE: 'driver-available',
  ONLINE_BUSY: 'driver-busy',
  OFFLINE: 'driver-offline',
};

function routeLengthKm(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return total;
}

export function DispatcherView({ api }: { api: WaypointApi }) {
  const [overview, setOverview] = useState<DispatchOverview | null>(null);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [history, setHistory] = useState<OrderHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextOverview, nextDrivers, nextOrders] = await Promise.all([api.getOverview(), api.listDrivers(), api.listOrders()]);
      setOverview(nextOverview);
      setDrivers(nextDrivers);
      setOrders(nextOrders);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [api]);
  usePolling(refresh, 4000);

  const selected = orders?.find((o) => o.id === selectedId) ?? null;
  const selectedActive = !!selected && ACTIVE_STAGES.includes(selected.currentStage);

  useEffect(() => {
    setHistory(null);
    setHistoryError(null);
  }, [selectedId]);

  const loadHistory = useCallback(async () => {
    if (selectedId == null) return;
    try {
      setHistory(await api.getHistory(selectedId));
      setHistoryError(null);
    } catch (err) {
      setHistoryError(errorMessage(err));
    }
  }, [api, selectedId]);
  // Poll the route while the trip is in progress; a finished trip only needs loading once.
  usePolling(loadHistory, 4000, selectedId != null && selectedActive);
  useEffect(() => {
    if (selectedId != null && !selectedActive) void loadHistory();
  }, [selectedId, selectedActive, loadHistory]);

  const driverCounts = overview?.driverByStatus ?? {};
  const visibleOrders = (orders ?? []).filter(FILTERS.find((f) => f.id === filter)!.keep);

  const { markers, lines } = useMemo(() => {
    const m: MapMarker[] = drivers
      .filter((d) => d.currentLat != null && d.currentLng != null)
      .map((d) => ({
        id: `driver-${d.userId}`,
        position: { lat: d.currentLat as number, lng: d.currentLng as number },
        kind: DRIVER_KIND[d.status],
        label: `${d.name ?? `Driver ${d.userId}`}: ${DRIVER_STATUS_LABEL[d.status]}`,
      }));
    const l: MapLine[] = [];
    if (selected) {
      const from = { lat: selected.pickUpLat, lng: selected.pickUpLng };
      const to = { lat: selected.dropOffLat, lng: selected.dropOffLng };
      m.push({ id: `pickup-${selected.id}`, position: from, kind: 'pickup', label: `Pick-up #${selected.id}` });
      m.push({ id: `dropoff-${selected.id}`, position: to, kind: 'dropoff', label: `Drop-off #${selected.id}` });
      l.push({ id: `plan-${selected.id}`, points: [from, to], kind: 'planned' });
      if (history && history.order.id === selected.id && history.route.length > 1) {
        l.push({ id: `route-${selected.id}`, points: history.route, kind: 'travelled' });
      }
    }
    return { markers: m, lines: l };
  }, [drivers, selected, history]);

  const fitKey = selected ? `order-${selected.id}-${history ? 'h' : ''}` : `fleet-${drivers.length > 0 ? 'y' : 'n'}`;

  return (
    <div className="workspace">
      <aside className="panel" aria-label="Dispatch">
        {selected ? (
          <section className="panel__section">
            <div className="section-head">
              <h1 className="panel__title">Delivery #{selected.id}</h1>
              <button type="button" className="button button--quiet" onClick={() => setSelectedId(null)}>
                Back to board
              </button>
            </div>
            <StageStrip stage={selected.currentStage} history={history?.stages} createdAt={selected.createdAt} />
            {selected.flagged && <p className="banner banner--warn">Flagged: {selected.flagReason ?? 'needs attention'}.</p>}
            <dl className="facts">
              <div>
                <dt>Customer</dt>
                <dd>{selected.customerName ?? `#${selected.customerId}`}</dd>
              </div>
              <div>
                <dt>Driver</dt>
                <dd>{selected.driverName ?? (selected.driverId ? `#${selected.driverId}` : 'Not assigned')}</dd>
              </div>
              <div>
                <dt>Placed</dt>
                <dd>{formatTime(selected.createdAt)}</dd>
              </div>
              <div>
                <dt>Recorded route</dt>
                <dd>
                  {history
                    ? history.route.length > 1
                      ? `${history.route.length} points, ${formatDistance(routeLengthKm(history.route))}`
                      : 'No location pings yet'
                    : historyError ?? 'Loading…'}
                </dd>
              </div>
            </dl>
            {history && history.stages.length > 0 && (
              <ol className="timeline">
                {history.stages.map((change, index) => (
                  <li key={`${change.toStage}-${index}`}>
                    <span className="timeline__time">{formatTime(change.changedAt)}</span>
                    <span>
                      {change.fromStage.replace(/_/g, ' ').toLowerCase()} → {change.toStage.replace(/_/g, ' ').toLowerCase()}
                      <span className="muted">{change.actorId == null ? ' (automatic)' : ''}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : (
          <section className="panel__section">
            <h1 className="panel__title">Fleet board</h1>
            {error && <p className="form-error">{error}</p>}
            {overview ? (
              <>
                <h2 className="section-title">Orders at each stage</h2>
                <StageCounts counts={overview.orderByStage} />
                {!!overview.orderByStage.CANCELLED && (
                  <p className="muted small">{overview.orderByStage.CANCELLED} cancelled.</p>
                )}
                <h2 className="section-title">Drivers</h2>
                <ul className="driver-counts">
                  {(['ONLINE_AVAILABLE', 'ONLINE_BUSY', 'OFFLINE'] as DriverStatus[]).map((status) => (
                    <li key={status} className={`driver-count driver-count--${status.toLowerCase()}`}>
                      <span className="driver-count__value">{driverCounts[status] ?? 0}</span>
                      <span className="driver-count__label">{DRIVER_STATUS_LABEL[status]}</span>
                    </li>
                  ))}
                </ul>
                {api.mode === 'live' && <p className="muted small">Counts are cached on the server and can lag by up to 45 seconds.</p>}

                <h2 className="section-title">Needs attention</h2>
                {overview.flaggedOrders.length === 0 ? (
                  <p className="empty">Nothing flagged. Orders get flagged when a driver disconnects mid-delivery.</p>
                ) : (
                  <ul className="flags">
                    {overview.flaggedOrders.map((flag) => (
                      <li key={flag.orderId}>
                        <button type="button" className="flag-row" onClick={() => setSelectedId(flag.orderId)}>
                          <strong>Delivery #{flag.orderId}</strong>
                          <span>{flag.reason ?? 'Needs attention'}</span>
                          <span className="muted small">{formatTime(flag.flaggedAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              !error && <p className="empty">Loading the board…</p>
            )}
          </section>
        )}

        <section className="panel__section">
          <h2 className="section-title">Orders</h2>
          <div className="chips" role="group" aria-label="Filter orders">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={`chip ${filter === f.id ? 'is-on' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          {orders === null ? (
            !error && <p className="empty">Loading…</p>
          ) : (
            <OrderList
              orders={visibleOrders}
              selectedId={selectedId}
              onSelect={setSelectedId}
              describe={(order) => `${order.customerName ?? 'Customer'}${order.driverName ? ` with ${order.driverName}` : ''}`}
              empty="No orders match this filter."
            />
          )}
        </section>
      </aside>
      <div className="workspace__map">
        <MapView markers={markers} lines={lines} fitKey={fitKey} ariaLabel="Fleet map" />
        <ul className="map-legend" aria-label="Map legend">
          <li>
            <span className="wp-pin wp-pin--driver-available" /> Available
          </li>
          <li>
            <span className="wp-pin wp-pin--driver-busy" /> On a delivery
          </li>
          <li>
            <span className="wp-pin wp-pin--driver-offline" /> Offline
          </li>
        </ul>
      </div>
    </div>
  );
}
