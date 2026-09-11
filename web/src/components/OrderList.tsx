import { OPEN_STAGES, type Order } from '../api/types';
import { STAGE_LABEL, formatTime } from '../lib/format';

interface OrderListProps {
  orders: Order[];
  selectedId: number | null;
  onSelect: (orderId: number) => void;
  /** Extra line under the stage, e.g. the other party's name. */
  describe?: (order: Order) => string | null;
  empty: string;
}

export function OrderList({ orders, selectedId, onSelect, describe, empty }: OrderListProps) {
  if (orders.length === 0) {
    return <p className="empty">{empty}</p>;
  }
  return (
    <ul className="orders">
      {orders.map((order) => {
        const open = OPEN_STAGES.includes(order.currentStage);
        const extra = describe?.(order);
        return (
          <li key={order.id}>
            <button
              type="button"
              className={`order-row ${open ? 'is-open' : ''} ${order.id === selectedId ? 'is-selected' : ''} stage-${order.currentStage.toLowerCase()}`}
              onClick={() => onSelect(order.id)}
              aria-pressed={order.id === selectedId}
            >
              <span className="order-row__main">
                <span className="order-row__title">
                  Delivery #{order.id}
                  {order.flagged && <span className="flag-chip">Flagged</span>}
                </span>
                <span className="order-row__stage">{STAGE_LABEL[order.currentStage]}</span>
                {extra && <span className="order-row__extra">{extra}</span>}
              </span>
              <span className="order-row__time">{formatTime(order.createdAt)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
