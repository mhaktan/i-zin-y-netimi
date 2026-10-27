import { describe, it, expect } from 'vitest';
import { APP_CONFIG, API_BASE } from '../config';

describe('config', () => {
  it('should have app name', () => {
    expect(APP_CONFIG.name).toBeDefined();
    expect(typeof APP_CONFIG.name).toBe('string');
  });

  it('should have API base URL', () => {
    expect(API_BASE).toBeDefined();
    expect(typeof API_BASE).toBe('string');
  });
});
