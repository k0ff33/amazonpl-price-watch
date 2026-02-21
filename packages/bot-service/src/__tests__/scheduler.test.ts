import { describe, it, expect } from 'vitest';
import { calculateNextCheckInterval } from '@liskobot/shared';
import { calculatePriority } from '../scheduler.js';

describe('calculateNextCheckInterval', () => {
  it('returns 24h for cheap items (<30 PLN)', () => {
    expect(calculateNextCheckInterval({ price: 25, subscriberCount: 50, volatilityScore: 0.5 }))
      .toBe(24 * 60);
  });

  it('returns 15min floor for hot items (>100 subs)', () => {
    expect(calculateNextCheckInterval({ price: 200, subscriberCount: 150, volatilityScore: 0.5 }))
      .toBe(15);
  });

  it('returns 30min for volatile items', () => {
    expect(calculateNextCheckInterval({ price: 200, subscriberCount: 10, volatilityScore: 0.9 }))
      .toBe(30);
  });

  it('returns 4h default for normal items', () => {
    expect(calculateNextCheckInterval({ price: 200, subscriberCount: 5, volatilityScore: 0.3 }))
      .toBe(240);
  });
});

describe('calculatePriority', () => {
  it('higher subscribers = higher priority', () => {
    const low = calculatePriority(5, 0.5);
    const high = calculatePriority(500, 0.5);
    expect(high).toBeGreaterThan(low);
  });
});
