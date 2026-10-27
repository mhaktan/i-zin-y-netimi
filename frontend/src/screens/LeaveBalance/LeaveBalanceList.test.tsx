import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LeaveBalanceList } from './LeaveBalanceList';

// Mock dataProvider
vi.mock('../../dataProvider', () => ({
  dataProvider: {
    list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  isAuthenticated: () => true,
  getAuthToken: () => 'test-token',
}));



const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </MemoryRouter>
);

describe('LeaveBalanceList', () => {
  it('should render without crashing', () => {
    const { container } = render(<LeaveBalanceList />, { wrapper });
    expect(container).toBeDefined();
  });

  it('should show title', () => {
    render(<LeaveBalanceList />, { wrapper });
    expect(screen.getByText('LeaveBalance')).toBeDefined();
  });

  it('should have create button', () => {
    render(<LeaveBalanceList />, { wrapper });
    expect(screen.getByText('+ Create LeaveBalance')).toBeDefined();
  });

});
