/**
 * Unit tests for lib/portfolio/auth.ts
 *
 * Tests the three shared portfolio auth helpers:
 * - getUserTeamId: returns team_id for valid user
 * - requireTeamMember: returns error for unauthenticated requests
 * - requireTeamAdmin: returns error for non-admin users
 */

import { NextRequest } from 'next/server';

// ─── Chain-aware Supabase mock ─────────────────────────────────────────────

let fromCallIndex: number;
let fromChains: Record<string, unknown>[];

function createChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  const chainMethods = ['select', 'insert', 'delete', 'update', 'eq', 'gte', 'is', 'in', 'order', 'limit'];
  for (const m of chainMethods) {
    if (!(m in overrides)) {
      (chain[m] as jest.Mock).mockReturnValue(chain);
    }
  }
  return chain;
}

const mockSupabase = {
  from: jest.fn(() => {
    const chain = fromChains[fromCallIndex] || createChain();
    fromCallIndex++;
    return chain;
  }),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

// ─── Auth mock ──────────────────────────────────────────────────────────────

const mockGetAuthenticatedUser = jest.fn();
jest.mock('@/lib/auth-helpers', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import { getUserTeamId, requireTeamMember, requireTeamAdmin } from '@/lib/portfolio/auth';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReq(path = '/api/portfolio/test') {
  return new NextRequest(`http://localhost${path}`);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('lib/portfolio/auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromCallIndex = 0;
    fromChains = [];
    mockGetAuthenticatedUser.mockResolvedValue(null);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // getUserTeamId
  // ═════════════════════════════════════════════════════════════════════════

  describe('getUserTeamId', () => {
    it('returns team_id for an active team member', async () => {
      fromChains[0] = createChain({
        single: jest.fn().mockResolvedValue({
          data: { team_id: 'team-abc' },
          error: null,
        }),
      });

      const result = await getUserTeamId('user-1');
      expect(result).toBe('team-abc');
      expect(mockSupabase.from).toHaveBeenCalledWith('team_members');
    });

    it('returns null when user has no active membership', async () => {
      fromChains[0] = createChain({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await getUserTeamId('user-unknown');
      expect(result).toBeNull();
    });

    it('returns null when data.team_id is falsy', async () => {
      fromChains[0] = createChain({
        single: jest.fn().mockResolvedValue({
          data: { team_id: '' },
          error: null,
        }),
      });

      const result = await getUserTeamId('user-empty');
      expect(result).toBeNull();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // requireTeamMember
  // ═════════════════════════════════════════════════════════════════════════

  describe('requireTeamMember', () => {
    it('returns error with 401 for unauthenticated requests', async () => {
      const result = await requireTeamMember(makeReq());
      expect('error' in result).toBe(true);

      if ('error' in result) {
        const body = await result.error.json();
        expect(result.error.status).toBe(401);
        expect(body.error).toMatch(/unauthorized/i);
      }
    });

    it('returns error with 403 when user is not a team member', async () => {
      mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1', email: 'test@co' });
      fromChains[0] = createChain({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await requireTeamMember(makeReq());
      expect('error' in result).toBe(true);

      if ('error' in result) {
        const body = await result.error.json();
        expect(result.error.status).toBe(403);
        expect(body.error).toMatch(/not a team member/i);
      }
    });

    it('returns user and teamId for valid team member', async () => {
      const user = { id: 'user-1', email: 'admin@co' };
      mockGetAuthenticatedUser.mockResolvedValue(user);
      fromChains[0] = createChain({
        single: jest.fn().mockResolvedValue({
          data: { team_id: 'team-1' },
          error: null,
        }),
      });

      const result = await requireTeamMember(makeReq());
      expect('error' in result).toBe(false);

      if (!('error' in result)) {
        expect(result.user).toBe(user);
        expect(result.teamId).toBe('team-1');
      }
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // requireTeamAdmin
  // ═════════════════════════════════════════════════════════════════════════

  describe('requireTeamAdmin', () => {
    it('returns error with 401 for unauthenticated requests', async () => {
      const result = await requireTeamAdmin(makeReq());
      expect('error' in result).toBe(true);

      if ('error' in result) {
        expect(result.error.status).toBe(401);
      }
    });

    it('returns error with 403 when user has no membership', async () => {
      mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1', email: 'test@co' });
      // Chain 0: team_members query -> no match
      fromChains[0] = createChain({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await requireTeamAdmin(makeReq());
      expect('error' in result).toBe(true);

      if ('error' in result) {
        const body = await result.error.json();
        expect(result.error.status).toBe(403);
        expect(body.error).toMatch(/not a team member/i);
      }
    });

    it('returns error with 403 when user is not admin role', async () => {
      mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1', email: 'test@co' });
      // Chain 0: team_members -> analyst role
      fromChains[0] = createChain({
        single: jest.fn().mockResolvedValue({
          data: { team_id: 'team-1', role: 'analyst' },
          error: null,
        }),
      });

      const result = await requireTeamAdmin(makeReq());
      expect('error' in result).toBe(true);

      if ('error' in result) {
        const body = await result.error.json();
        expect(result.error.status).toBe(403);
        expect(body.error).toMatch(/admin/i);
      }
    });

    it('returns error with 404 when team record not found', async () => {
      mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1', email: 'test@co' });
      // Chain 0: team_members -> admin
      fromChains[0] = createChain({
        single: jest.fn().mockResolvedValue({
          data: { team_id: 'team-orphan', role: 'admin' },
          error: null,
        }),
      });
      // Chain 1: teams -> not found
      fromChains[1] = createChain({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await requireTeamAdmin(makeReq());
      expect('error' in result).toBe(true);

      if ('error' in result) {
        expect(result.error.status).toBe(404);
      }
    });

    it('returns user, teamId, and team for valid admin', async () => {
      const user = { id: 'user-1', email: 'admin@co' };
      const team = { id: 'team-1', name: 'Alpha', portfolio_tier: 'scale' };

      mockGetAuthenticatedUser.mockResolvedValue(user);
      // Chain 0: team_members -> admin
      fromChains[0] = createChain({
        single: jest.fn().mockResolvedValue({
          data: { team_id: 'team-1', role: 'admin' },
          error: null,
        }),
      });
      // Chain 1: teams -> found
      fromChains[1] = createChain({
        single: jest.fn().mockResolvedValue({ data: team, error: null }),
      });

      const result = await requireTeamAdmin(makeReq());
      expect('error' in result).toBe(false);

      if (!('error' in result)) {
        expect(result.user).toBe(user);
        expect(result.teamId).toBe('team-1');
        expect(result.team.name).toBe('Alpha');
      }
    });
  });
});
