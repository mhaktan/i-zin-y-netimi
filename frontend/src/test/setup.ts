import '@testing-library/jest-dom/vitest';

// Mock fetch globally
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({ result: { items: [], totalCount: 0 }, success: true }),
    text: () => Promise.resolve(''),
  } as Response)
);

// jsdom'da yok — Takeoff v2 Table/Popover olcum icin kullanir
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never;

// Mock localStorage
const store: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  },
  writable: true,
});
