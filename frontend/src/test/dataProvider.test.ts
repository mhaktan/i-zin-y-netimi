import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dataProvider, loginWithCredentials, clearAuth, isAuthenticated } from '../dataProvider';

describe('dataProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAuth();
  });

  describe('list', () => {
    it('should fetch list data', async () => {
      const mockData = {
        result: { items: [{ id: 1, name: 'Test' }], totalCount: 1 },
        success: true,
      };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve(mockData),
      });

      const result = await dataProvider.list('test', {
        pagination: { page: 1, perPage: 10 },
      });

      expect(result).toBeDefined();
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should post new record', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ result: { id: 1, name: 'New' }, success: true }),
      });

      const result = await dataProvider.create('test', { name: 'New' });
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should put updated record', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ result: { id: 1, name: 'Updated' }, success: true }),
      });

      const result = await dataProvider.update('test', 1, { name: 'Updated' });
      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete record', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ result: null, success: true }),
      });

      await expect(dataProvider.delete('test', 1)).resolves.not.toThrow();
    });
  });

  describe('auth', () => {
    it('should not be authenticated initially', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('should authenticate with valid credentials', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({
          result: { result: { accessToken: 'test-token' } },
          success: true,
        }),
      });

      const success = await loginWithCredentials('admin', '123qwe');
      expect(success).toBe(true);
      expect(isAuthenticated()).toBe(true);
    });

    it('should reject invalid credentials', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: () => Promise.resolve({ success: false }),
      });

      const success = await loginWithCredentials('wrong', 'wrong');
      expect(success).toBe(false);
    });
  });
});
