import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, describe, expect, it } from 'vitest';
import { MapView } from './MapView';

beforeAll(() => {
  // jsdom has no ResizeObserver; MapView only uses it to tell Leaflet about size changes.
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('MapView', () => {
  it("keeps Leaflet's classes when its props change (the customer map losing its clipping)", async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    // Picking points (click handler) -> tracking an order (no handler), as in CustomerView.
    await act(async () => root.render(<MapView markers={[]} onMapClick={() => {}} />));
    const canvas = host.querySelector('.map__canvas') as HTMLElement;
    expect(canvas.classList.contains('leaflet-container')).toBe(true);
    expect(host.querySelector('.map')?.classList.contains('map--pickable')).toBe(true);

    await act(async () => root.render(<MapView markers={[]} />));
    expect(canvas.classList.contains('leaflet-container')).toBe(true);
    expect(host.querySelector('.map')?.classList.contains('map--pickable')).toBe(false);

    await act(async () => root.unmount());
    host.remove();
  });
});
