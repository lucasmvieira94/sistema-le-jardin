import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { headers: {}, rest: { headers: {} }, rpc: vi.fn() } }));
import { lerPasse, PORTAL_TOKEN_KEY } from '../portalSessao';

function memoria(inicial?: string) {
  const m = new Map<string, string>();
  if (inicial) m.set(PORTAL_TOKEN_KEY, inicial);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe('passe do portal', () => {
  it('aceita passe dentro das 2 horas', () => {
    const s = memoria(JSON.stringify({ token: 'a'.repeat(64), expiraEm: 2000 }));
    expect(lerPasse(s, 1000)?.token).toBe('a'.repeat(64));
  });
  it('descarta passe vencido', () => {
    const s = memoria(JSON.stringify({ token: 'a'.repeat(64), expiraEm: 1000 }));
    expect(lerPasse(s, 1000)).toBeNull();
    expect(s.m.has(PORTAL_TOKEN_KEY)).toBe(false);
  });
  it('descarta passe corrompido', () => {
    expect(lerPasse(memoria('{x'), 0)).toBeNull();
  });
});
