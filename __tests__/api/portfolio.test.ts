/**
 * API Integration Tests for /api/portfolio/*
 *
 * Covers all 8 portfolio routes:
 * - teams: POST, GET, PATCH
 * - alerts: GET, POST, PUT, DELETE
 * - comp-sets: GET, POST, PUT, DELETE
 * - members: GET, PUT, DELETE
 * - dashboard: GET
 * - health-scores: GET
 * - concentration: GET
 * - pipeline: GET, POST, PUT, DELETE
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Chain-aware Supabase mock ───────────────────────────────────────────────

let fromCallIndex: number;
let fromChains: Record<string, unknown>[];

/**
 * Create a fluent Supabase chain mock. Each method returns `chain` by default
 * (fluent chaining). Override a method to set its return value.
 *
 * For chains that end without `.single()`, add `data` / `error` / `count`
 * properties directly on the chain -- when the chain object is awaited,
 * the destructured result reads these properties.
 */
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
    rpc: jest.fn().mockResolvedValue({ error: null }),
    // Default "resolved" values when the chain itself is awaited (non-single terminal)
    data: null,
    error: null,
    count: null,
    ...overrides,
  };
  // Only re-wire fluent returns for methods NOT explicitly overridden
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
  rpc: jest.fn().mockResolvedValue({ error: null }),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

// ─── Auth mocks ──────────────────────────────────────────────────────────────

const mockGetAuthenticatedUser = jest.fn();
jest.mock('@/lib/auth-helpers', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}));

const mockRequireTeamMember = jest.fn();
const mockRequireTeamAdmin = jest.fn();
jest.mock('@/lib/portfolio/auth', () => ({
  requireTeamMember: (...args: unknown[]) => mockRequireTeamMember(...args),
  requireTeamAdmin: (...args: unknown[]) => mockRequireTeamAdmin(...args),
  getUserTeamId: jest.fn(),
}));

jest.mock('@/lib/audit-log', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  getAuditContext: jest.fn().mockReturnValue({ ip_address: '127.0.0.1', user_agent: 'test' }),
}));

jest.mock('@/lib/sentry-api', () => ({
  captureApiError: jest.fn(),
}));

// ─── Import route handlers AFTER mocks ───────────────────────────────────────

import {
  POST as teamsPOST,
  GET as teamsGET,
  PATCH as teamsPATCH,
} from '@/app/api/portfolio/teams/route';

import {
  GET as alertsGET,
  POST as alertsPOST,
  PUT as alertsPUT,
  DELETE as alertsDELETE,
} from '@/app/api/portfolio/alerts/route';

import {
  GET as compSetsGET,
  POST as compSetsPOST,
  PUT as compSetsPUT,
  DELETE as compSetsDELETE,
} from '@/app/api/portfolio/comp-sets/route';

import {
  GET as membersGET,
  PUT as membersPUT,
  DELETE as membersDELETE,
} from '@/app/api/portfolio/members/route';

import { GET as dashboardGET } from '@/app/api/portfolio/dashboard/route';
import { GET as healthScoresGET } from '@/app/api/portfolio/health-scores/route';
import { GET as concentrationGET } from '@/app/api/portfolio/concentration/route';

import {
  GET as pipelineGET,
  POST as pipelinePOST,
  PUT as pipelinePUT,
  DELETE as pipelineDELETE,
} from '@/app/api/portfolio/pipeline/route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE = 'http://localhost';
const mockUser = { id: 'user-1', email: 'admin@test.co' };
const mockUser2 = { id: 'user-2', email: 'analyst@test.co' };

function makeReq(path: string, opts?: RequestInit) {
  return new NextRequest(`${BASE}${path}`, opts);
}

function jsonReq(path: string, method: string, body: unknown) {
  return makeReq(path, { method, body: JSON.stringify(body) });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('/api/portfolio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromCallIndex = 0;
    fromChains = [];
    mockGetAuthenticatedUser.mockResolvedValue(null);
    mockRequireTeamMember.mockResolvedValue({
      error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    });
    mockRequireTeamAdmin.mockResolvedValue({
      error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEAMS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('teams', () => {
    describe('POST', () => {
      it('returns 401 when not authenticated', async () => {
        const res = await teamsPOST(jsonReq('/api/portfolio/teams', 'POST', { name: 'T', slug: 's' }));
        expect(res.status).toBe(401);
      });

      it('returns 400 when name is missing', async () => {
        mockGetAuthenticatedUser.mockResolvedValue(mockUser);
        const res = await teamsPOST(jsonReq('/api/portfolio/teams', 'POST', { slug: 'my-team' }));
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toMatch(/name/i);
      });

      it('returns 400 when slug is missing', async () => {
        mockGetAuthenticatedUser.mockResolvedValue(mockUser);
        const res = await teamsPOST(jsonReq('/api/portfolio/teams', 'POST', { name: 'My Team' }));
        expect(res.status).toBe(400);
      });

      it('returns 409 when slug already exists', async () => {
        mockGetAuthenticatedUser.mockResolvedValue(mockUser);
        // Chain 0: teams slug check -> existing found
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: { id: 'existing-team' }, error: null }),
        });
        const res = await teamsPOST(jsonReq('/api/portfolio/teams', 'POST', { name: 'Team', slug: 'taken' }));
        const data = await res.json();
        expect(res.status).toBe(409);
        expect(data.error).toMatch(/slug/i);
      });

      it('creates team, membership, and updates profile on success', async () => {
        mockGetAuthenticatedUser.mockResolvedValue(mockUser);
        const team = { id: 'team-new', name: 'New', slug: 'new', max_seats: 5 };

        // Chain 0: slug uniqueness check -> not found
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        });
        // Chain 1: insert team -> success
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({ data: team, error: null }),
        });
        // Chain 2: insert team_members -> success
        fromChains[2] = createChain({
          insert: jest.fn().mockResolvedValue({ error: null }),
        });
        // Chain 3: update user_profiles
        fromChains[3] = createChain();
        // Chain 4: audit_log (via logAuditEvent mock - already no-op)

        const res = await teamsPOST(jsonReq('/api/portfolio/teams', 'POST', { name: 'New', slug: 'new' }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.team.id).toBe('team-new');
      });

      it('rolls back team if member insert fails', async () => {
        mockGetAuthenticatedUser.mockResolvedValue(mockUser);
        const team = { id: 'team-rollback', name: 'Rollback', slug: 'rollback' };

        // Chain 0: slug check -> not found
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        });
        // Chain 1: insert team -> success
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({ data: team, error: null }),
        });
        // Chain 2: insert member -> error (chain.error is read after await)
        fromChains[2] = createChain({ error: { message: 'DB error' } });
        // Chain 3: delete team (rollback)
        fromChains[3] = createChain();

        const res = await teamsPOST(jsonReq('/api/portfolio/teams', 'POST', { name: 'Rollback', slug: 'rollback' }));
        expect(res.status).toBe(500);
        expect(mockSupabase.from).toHaveBeenCalledTimes(4);
      });
    });

    describe('GET', () => {
      it('returns 401 when not authenticated', async () => {
        const res = await teamsGET(makeReq('/api/portfolio/teams'));
        expect(res.status).toBe(401);
      });

      it('returns null team for user with no membership', async () => {
        mockGetAuthenticatedUser.mockResolvedValue(mockUser);
        // Chain 0: team_members -> no match
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        const res = await teamsGET(makeReq('/api/portfolio/teams'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.team).toBeNull();
      });

      it('returns team and role for active member', async () => {
        mockGetAuthenticatedUser.mockResolvedValue(mockUser);
        const team = { id: 'team-1', name: 'Alpha', slug: 'alpha', max_seats: 10 };

        // Chain 0: team_members -> found
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: { team_id: 'team-1', role: 'admin' }, error: null }),
        });
        // Chain 1: teams -> found
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({ data: team, error: null }),
        });

        const res = await teamsGET(makeReq('/api/portfolio/teams'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.team.name).toBe('Alpha');
        expect(data.role).toBe('admin');
      });
    });

    describe('PATCH', () => {
      it('returns 401 when requireTeamAdmin rejects', async () => {
        // Default mock already returns error
        const res = await teamsPATCH(jsonReq('/api/portfolio/teams', 'PATCH', { primary_color: '#fff' }));
        expect(res.status).toBe(401);
      });

      it('accepts allowed fields and returns 200', async () => {
        mockRequireTeamAdmin.mockResolvedValue({ user: mockUser, teamId: 'team-1', team: {} });
        // Chain 0: update teams (terminal: .eq(), chain.error = null by default)
        fromChains[0] = createChain();

        const res = await teamsPATCH(
          jsonReq('/api/portfolio/teams', 'PATCH', { primary_color: '#112233', disclaimer_text: 'Test' })
        );
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.updated).toBe(true);
      });

      it('returns 400 when only blocked fields are sent', async () => {
        mockRequireTeamAdmin.mockResolvedValue({ user: mockUser, teamId: 'team-1', team: {} });

        const res = await teamsPATCH(
          jsonReq('/api/portfolio/teams', 'PATCH', { portfolio_tier: 'enterprise', max_seats: 50 })
        );
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toMatch(/no valid fields/i);
      });

      it('silently drops blocked fields alongside allowed fields', async () => {
        mockRequireTeamAdmin.mockResolvedValue({ user: mockUser, teamId: 'team-1', team: {} });
        // Chain 0: update teams (terminal: .eq(), chain.error = null default)
        fromChains[0] = createChain();

        const res = await teamsPATCH(
          jsonReq('/api/portfolio/teams', 'PATCH', { primary_color: '#000', portfolio_tier: 'enterprise' })
        );
        expect(res.status).toBe(200);
      });

      it('applies SSO fields only for enterprise tier', async () => {
        mockRequireTeamAdmin.mockResolvedValue({ user: mockUser, teamId: 'team-1', team: {} });
        // Chain 0: teams select for tier check (terminal: .single())
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: { portfolio_tier: 'enterprise' }, error: null }),
        });
        // Chain 1: teams update (terminal: .eq(), chain.error = null default)
        fromChains[1] = createChain();

        const res = await teamsPATCH(
          jsonReq('/api/portfolio/teams', 'PATCH', { sso_email_domain: 'test.co' })
        );
        expect(res.status).toBe(200);
      });

      it('rejects SSO fields for non-enterprise tier if no allowed fields', async () => {
        mockRequireTeamAdmin.mockResolvedValue({ user: mockUser, teamId: 'team-1', team: {} });
        // Chain 0: teams select for tier check
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: { portfolio_tier: 'growth' }, error: null }),
        });

        const res = await teamsPATCH(
          jsonReq('/api/portfolio/teams', 'PATCH', { sso_email_domain: 'test.co' })
        );
        expect(res.status).toBe(400);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ALERTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('alerts', () => {
    beforeEach(() => {
      mockRequireTeamMember.mockResolvedValue({ user: mockUser, teamId: 'team-1' });
    });

    describe('GET', () => {
      it('returns 401 when not a team member', async () => {
        mockRequireTeamMember.mockResolvedValue({
          error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
        });
        const res = await alertsGET(makeReq('/api/portfolio/alerts'));
        expect(res.status).toBe(401);
      });

      it('returns alerts array on success', async () => {
        const alerts = [{ id: 'a1', name: 'Daily Feed' }];
        fromChains[0] = createChain({ data: alerts });

        const res = await alertsGET(makeReq('/api/portfolio/alerts'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.alerts).toHaveLength(1);
        expect(data.alerts[0].name).toBe('Daily Feed');
      });
    });

    describe('POST', () => {
      it('returns 400 when name is missing', async () => {
        const res = await alertsPOST(jsonReq('/api/portfolio/alerts', 'POST', {}));
        expect(res.status).toBe(400);
      });

      it('creates alert with defaults on success', async () => {
        const alert = { id: 'alert-1', name: 'New Alert', alert_type: 'deal_feed' };
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: alert, error: null }),
        });

        const res = await alertsPOST(jsonReq('/api/portfolio/alerts', 'POST', { name: 'New Alert' }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.alert.name).toBe('New Alert');
      });
    });

    describe('PUT', () => {
      it('returns 400 when id is missing', async () => {
        const res = await alertsPUT(jsonReq('/api/portfolio/alerts', 'PUT', { name: 'Updated' }));
        expect(res.status).toBe(400);
      });

      it('updates alert on success', async () => {
        // Chain terminates with .eq() calls which return chain; chain.error = null = success
        fromChains[0] = createChain();

        const res = await alertsPUT(jsonReq('/api/portfolio/alerts', 'PUT', { id: 'a1', is_active: false }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.updated).toBe(true);
      });
    });

    describe('DELETE', () => {
      it('returns 400 when id is missing', async () => {
        const res = await alertsDELETE(makeReq('/api/portfolio/alerts'));
        expect(res.status).toBe(400);
      });

      it('deletes alert on success', async () => {
        // Chain terminates with .eq() calls; chain.error = null (default) = success
        fromChains[0] = createChain();

        const res = await alertsDELETE(makeReq('/api/portfolio/alerts?id=alert-1'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.deleted).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMP SETS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('comp-sets', () => {
    function setupCompSetAuth() {
      mockGetAuthenticatedUser.mockResolvedValue(mockUser);
      // Chain 0: inline getUserTeamId -> team_members query
      fromChains[0] = createChain({
        single: jest.fn().mockResolvedValue({ data: { team_id: 'team-1' }, error: null }),
      });
    }

    describe('GET', () => {
      it('returns 401 when not authenticated', async () => {
        const res = await compSetsGET(makeReq('/api/portfolio/comp-sets'));
        expect(res.status).toBe(401);
      });

      it('returns 403 when not a team member', async () => {
        mockGetAuthenticatedUser.mockResolvedValue(mockUser);
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        const res = await compSetsGET(makeReq('/api/portfolio/comp-sets'));
        expect(res.status).toBe(403);
      });

      it('returns comp sets on success', async () => {
        setupCompSetAuth();
        const compSets = [{ id: 'cs1', name: 'Onc Benchmarks' }];
        fromChains[1] = createChain({ data: compSets });

        const res = await compSetsGET(makeReq('/api/portfolio/comp-sets'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.compSets).toHaveLength(1);
      });
    });

    describe('POST', () => {
      it('returns 400 when name is missing', async () => {
        setupCompSetAuth();
        const res = await compSetsPOST(jsonReq('/api/portfolio/comp-sets', 'POST', { description: 'x' }));
        expect(res.status).toBe(400);
      });

      it('creates comp set on success', async () => {
        setupCompSetAuth();
        const compSet = { id: 'cs-new', name: 'New Set' };
        // Chain 1: second createServiceClient call -> insert
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({ data: compSet, error: null }),
        });

        const res = await compSetsPOST(jsonReq('/api/portfolio/comp-sets', 'POST', {
          name: 'New Set',
          dealIds: ['d1', 'd2'],
        }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.compSet.id).toBe('cs-new');
      });
    });

    describe('PUT', () => {
      it('returns 400 when id is missing', async () => {
        setupCompSetAuth();
        const res = await compSetsPUT(jsonReq('/api/portfolio/comp-sets', 'PUT', { name: 'Updated' }));
        expect(res.status).toBe(400);
      });

      it('updates comp set on success', async () => {
        setupCompSetAuth();
        // Chain terminates with .eq() calls; chain.error = null (default) = success
        fromChains[1] = createChain();

        const res = await compSetsPUT(jsonReq('/api/portfolio/comp-sets', 'PUT', {
          id: 'cs1',
          name: 'Updated Set',
          isPinned: true,
        }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.updated).toBe(true);
      });
    });

    describe('DELETE', () => {
      it('returns 400 when id is missing', async () => {
        setupCompSetAuth();
        const res = await compSetsDELETE(makeReq('/api/portfolio/comp-sets'));
        expect(res.status).toBe(400);
      });

      it('deletes comp set on success', async () => {
        setupCompSetAuth();
        fromChains[1] = createChain();

        const res = await compSetsDELETE(makeReq('/api/portfolio/comp-sets?id=cs1'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.deleted).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMBERS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('members', () => {
    /** Sets up auth + inline getUserTeam returning admin. Uses chain 0. */
    function setupMemberAuth(role = 'admin') {
      mockGetAuthenticatedUser.mockResolvedValue(mockUser);
      // Chain 0: inline getUserTeam -> team_members query
      fromChains[0] = createChain({
        single: jest.fn().mockResolvedValue({
          data: { team_id: 'team-1', role },
          error: null,
        }),
      });
    }

    describe('GET', () => {
      it('returns 401 when not authenticated', async () => {
        const res = await membersGET(makeReq('/api/portfolio/members'));
        expect(res.status).toBe(401);
      });

      it('returns 403 when not a team member', async () => {
        mockGetAuthenticatedUser.mockResolvedValue(mockUser);
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        const res = await membersGET(makeReq('/api/portfolio/members'));
        expect(res.status).toBe(403);
      });

      it('returns enriched members on success', async () => {
        setupMemberAuth('analyst');
        // Chain 1: team_members list (terminal: .order())
        fromChains[1] = createChain({
          data: [
            { id: 'm1', user_id: 'user-1', role: 'admin', status: 'active' },
            { id: 'm2', user_id: 'user-2', role: 'analyst', status: 'active' },
          ],
        });
        // Chain 2: user_profiles lookup (terminal: .in())
        fromChains[2] = createChain({
          data: [
            { id: 'user-1', email: 'admin@test.co', company_name: 'Acme' },
            { id: 'user-2', email: 'analyst@test.co', company_name: null },
          ],
        });

        const res = await membersGET(makeReq('/api/portfolio/members'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.members).toHaveLength(2);
        expect(data.members[0].email).toBe('admin@test.co');
        expect(data.members[0].companyName).toBe('Acme');
        expect(data.members[1].companyName).toBeNull();
      });
    });

    describe('PUT', () => {
      it('returns 403 when caller is not admin', async () => {
        setupMemberAuth('analyst');
        const res = await membersPUT(jsonReq('/api/portfolio/members', 'PUT', { memberId: 'm2', role: 'viewer' }));
        expect(res.status).toBe(403);
      });

      it('returns 400 when memberId or role is missing', async () => {
        setupMemberAuth('admin');
        const res = await membersPUT(jsonReq('/api/portfolio/members', 'PUT', { memberId: 'm2' }));
        expect(res.status).toBe(400);
      });

      it('returns 400 for invalid role', async () => {
        setupMemberAuth('admin');
        const res = await membersPUT(jsonReq('/api/portfolio/members', 'PUT', { memberId: 'm2', role: 'superadmin' }));
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toMatch(/invalid role/i);
      });

      it('returns 404 when target member not found', async () => {
        setupMemberAuth('admin');
        // Chain 1: select target member -> not found
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        const res = await membersPUT(jsonReq('/api/portfolio/members', 'PUT', { memberId: 'bogus', role: 'viewer' }));
        expect(res.status).toBe(404);
      });

      it('returns 400 when trying to change own role', async () => {
        setupMemberAuth('admin');
        // Chain 1: select target member -> self
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({
            data: { id: 'm1', user_id: 'user-1', team_id: 'team-1' },
            error: null,
          }),
        });

        const res = await membersPUT(jsonReq('/api/portfolio/members', 'PUT', { memberId: 'm1', role: 'viewer' }));
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toMatch(/own role/i);
      });

      it('updates role on success', async () => {
        setupMemberAuth('admin');
        // Chain 1: select target member -> different user
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({
            data: { id: 'm2', user_id: 'user-2', team_id: 'team-1' },
            error: null,
          }),
        });
        // Chain 2: update role
        fromChains[2] = createChain();

        const res = await membersPUT(jsonReq('/api/portfolio/members', 'PUT', { memberId: 'm2', role: 'viewer' }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.updated).toBe(true);
      });
    });

    describe('DELETE', () => {
      it('returns 403 when caller is not admin', async () => {
        setupMemberAuth('viewer');
        const res = await membersDELETE(makeReq('/api/portfolio/members?memberId=m2'));
        expect(res.status).toBe(403);
      });

      it('returns 400 when memberId is missing', async () => {
        setupMemberAuth('admin');
        const res = await membersDELETE(makeReq('/api/portfolio/members'));
        expect(res.status).toBe(400);
      });

      it('returns 404 when target member not found', async () => {
        setupMemberAuth('admin');
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        const res = await membersDELETE(makeReq('/api/portfolio/members?memberId=bogus'));
        expect(res.status).toBe(404);
      });

      it('returns 400 when trying to remove self', async () => {
        setupMemberAuth('admin');
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({
            data: { id: 'm1', user_id: 'user-1', team_id: 'team-1' },
            error: null,
          }),
        });

        const res = await membersDELETE(makeReq('/api/portfolio/members?memberId=m1'));
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toMatch(/yourself/i);
      });

      it('soft-deletes member and resets user profile', async () => {
        setupMemberAuth('admin');
        // Chain 1: select target -> different user
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({
            data: { id: 'm2', user_id: 'user-2', team_id: 'team-1' },
            error: null,
          }),
        });
        // Chain 2: update team_members status=deactivated
        fromChains[2] = createChain();
        // Chain 3: update user_profiles tier=free
        fromChains[3] = createChain();

        const res = await membersDELETE(makeReq('/api/portfolio/members?memberId=m2'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.removed).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  describe('dashboard', () => {
    describe('GET', () => {
      it('returns 401 when not authenticated', async () => {
        const res = await dashboardGET(makeReq('/api/portfolio/dashboard'));
        expect(res.status).toBe(401);
      });

      it('returns 403 when caller is not admin', async () => {
        mockGetAuthenticatedUser.mockResolvedValue(mockUser);
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({
            data: { team_id: 'team-1', role: 'analyst' },
            error: null,
          }),
        });

        const res = await dashboardGET(makeReq('/api/portfolio/dashboard'));
        expect(res.status).toBe(403);
      });

      it('returns 403 when no team membership', async () => {
        mockGetAuthenticatedUser.mockResolvedValue(mockUser);
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        const res = await dashboardGET(makeReq('/api/portfolio/dashboard'));
        expect(res.status).toBe(403);
      });

      it('returns full dashboard data on success', async () => {
        mockGetAuthenticatedUser.mockResolvedValue(mockUser);
        const team = {
          id: 'team-1', name: 'Alpha', max_seats: 10,
          analyst_hours_monthly: 5, portfolio_tier: 'scale',
          logo_url: null, slack_webhook_url: null,
        };

        // Chain 0: membership check
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({
            data: { team_id: 'team-1', role: 'admin' },
            error: null,
          }),
        });

        // Promise.all chains 1-6:
        // Chain 1: teams (terminal: .single())
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({ data: team, error: null }),
        });
        // Chain 2: team_members (terminal: .eq())
        fromChains[2] = createChain({
          data: [
            { id: 'm1', user_id: 'user-1', role: 'admin', status: 'active', accepted_at: '2026-01-01' },
            { id: 'm2', user_id: 'user-2', role: 'analyst', status: 'active', accepted_at: '2026-02-01' },
            { id: 'm3', user_id: 'user-3', role: 'viewer', status: 'pending', accepted_at: null },
          ],
        });
        // Chain 3: analyst_hour_entries (terminal: .gte())
        fromChains[3] = createChain({
          data: [{ hours: 1.5 }, { hours: 2 }],
        });
        // Chain 4: deal_alert_configs (terminal: .eq())
        fromChains[4] = createChain({
          data: [{ id: 'al1' }, { id: 'al2' }],
        });
        // Chain 5: audit_log recent (terminal: .limit())
        fromChains[5] = createChain({
          data: [{ id: 'ev1', action: 'team_created' }],
        });
        // Chain 6: audit_log calculation check (terminal: .limit())
        fromChains[6] = createChain({
          data: [{ id: 'calc1' }],
        });

        const res = await dashboardGET(makeReq('/api/portfolio/dashboard'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.seats.active).toBe(2);
        expect(data.seats.pending).toBe(1);
        expect(data.seats.max).toBe(10);
        expect(data.analystHours.used).toBe(3.5);
        expect(data.analystHours.allocated).toBe(5);
        expect(data.analystHours.remaining).toBe(1.5);
        expect(data.activeAlerts).toBe(2);
        expect(data.onboarding.hasCalculations).toBe(true);
        expect(data.onboarding.hasMembers).toBe(true);
        expect(data.onboarding.hasLogo).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH SCORES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('health-scores', () => {
    describe('GET', () => {
      it('returns 401 when requireTeamAdmin rejects', async () => {
        const res = await healthScoresGET(makeReq('/api/portfolio/health-scores'));
        expect(res.status).toBe(401);
      });

      it('returns empty scores when no members', async () => {
        mockRequireTeamAdmin.mockResolvedValue({ user: mockUser, teamId: 'team-1', team: {} });
        fromChains[0] = createChain({ data: [] });

        const res = await healthScoresGET(makeReq('/api/portfolio/health-scores'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.scores).toEqual([]);
      });

      it('returns health scores with correct classification', async () => {
        mockRequireTeamAdmin.mockResolvedValue({ user: mockUser, teamId: 'team-1', team: {} });

        // Chain 0: team_members list (terminal: .eq())
        fromChains[0] = createChain({
          data: [
            { user_id: 'user-1', role: 'admin' },
            { user_id: 'user-2', role: 'analyst' },
          ],
        });

        // Promise.all interleaves from() calls across members:
        // Both map callbacks execute synchronously up to their first await,
        // so from() calls alternate between members at each await boundary.
        //
        // Chain 1: user-1 profile (first map callback, first from call)
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({
            data: { email: 'admin@test.co', company_name: 'Acme' },
            error: null,
          }),
        });
        // Chain 2: user-2 profile (second map callback, first from call)
        fromChains[2] = createChain({
          single: jest.fn().mockResolvedValue({
            data: { email: 'analyst@test.co', company_name: null },
            error: null,
          }),
        });
        // Chain 3: user-1 audit_log 30d
        fromChains[3] = createChain({ count: 15 });
        // Chain 4: user-2 audit_log 30d
        fromChains[4] = createChain({ count: 3 });
        // Chain 5: user-1 audit_log 7d
        fromChains[5] = createChain({ count: 5 });
        // Chain 6: user-2 audit_log 7d
        fromChains[6] = createChain({ count: 0 });

        const res = await healthScoresGET(makeReq('/api/portfolio/health-scores'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.scores).toHaveLength(2);

        const admin = data.scores.find((s: { userId: string }) => s.userId === 'user-1');
        expect(admin.health).toBe('active');
        expect(admin.actions7d).toBe(5);

        const analyst = data.scores.find((s: { userId: string }) => s.userId === 'user-2');
        expect(analyst.health).toBe('moderate');
        expect(analyst.actions7d).toBe(0);
        expect(analyst.actions30d).toBe(3);
      });

      it('classifies user with zero actions as inactive', async () => {
        mockRequireTeamAdmin.mockResolvedValue({ user: mockUser, teamId: 'team-1', team: {} });

        // Chain 0: team_members (terminal: .eq())
        fromChains[0] = createChain({
          data: [{ user_id: 'user-3', role: 'viewer' }],
        });
        // Chain 1: user_profiles (terminal: .single())
        fromChains[1] = createChain({
          single: jest.fn().mockResolvedValue({
            data: { email: 'viewer@test.co', company_name: null },
            error: null,
          }),
        });
        // Chain 2: audit_log 30d count
        fromChains[2] = createChain({ count: 0 });
        // Chain 3: audit_log 7d count
        fromChains[3] = createChain({ count: 0 });

        const res = await healthScoresGET(makeReq('/api/portfolio/health-scores'));
        const data = await res.json();
        expect(data.scores[0].health).toBe('inactive');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONCENTRATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('concentration', () => {
    describe('GET', () => {
      it('returns 401 when requireTeamAdmin rejects', async () => {
        const res = await concentrationGET(makeReq('/api/portfolio/concentration'));
        expect(res.status).toBe(401);
      });

      it('returns empty distribution when no members', async () => {
        mockRequireTeamAdmin.mockResolvedValue({ user: mockUser, teamId: 'team-1', team: {} });
        fromChains[0] = createChain({ data: [] });

        const res = await concentrationGET(makeReq('/api/portfolio/concentration'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.distribution).toEqual([]);
        expect(data.alerts).toEqual([]);
        expect(data.total).toBe(0);
      });

      it('computes distribution and fires alerts for >40% concentration', async () => {
        mockRequireTeamAdmin.mockResolvedValue({ user: mockUser, teamId: 'team-1', team: {} });

        // Chain 0: team_members (terminal: .eq())
        fromChains[0] = createChain({
          data: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
        });
        // Chain 1: audit_log events (terminal: .limit())
        fromChains[1] = createChain({
          data: [
            { user_id: 'user-1', details: { therapeutic_area: 'oncology', company_name: 'CompA' } },
            { user_id: 'user-1', details: { therapeutic_area: 'oncology', company_name: 'CompB' } },
            { user_id: 'user-1', details: { therapeutic_area: 'oncology', company_name: 'CompA' } },
            { user_id: 'user-2', details: { therapeutic_area: 'neurology', company_name: 'CompC' } },
            { user_id: 'user-2', details: { therapeutic_area: 'cardiology', company_name: 'CompD' } },
          ],
        });

        const res = await concentrationGET(makeReq('/api/portfolio/concentration'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.total).toBe(5);

        // oncology = 3/5 = 60% > 40% -> should trigger alert
        expect(data.alerts.length).toBeGreaterThanOrEqual(1);
        expect(data.alerts[0].therapeuticArea).toBe('oncology');
        expect(data.alerts[0].percentage).toBe(60);

        // distribution sorted by count desc
        expect(data.distribution[0].therapeuticArea).toBe('oncology');
        expect(data.distribution[0].count).toBe(3);
        expect(data.distribution[0].companyCount).toBe(2);
      });

      it('fires no alerts when no TA exceeds 40%', async () => {
        mockRequireTeamAdmin.mockResolvedValue({ user: mockUser, teamId: 'team-1', team: {} });

        fromChains[0] = createChain({
          data: [{ user_id: 'user-1' }],
        });
        fromChains[1] = createChain({
          data: [
            { user_id: 'user-1', details: { therapeutic_area: 'oncology', company_name: 'A' } },
            { user_id: 'user-1', details: { therapeutic_area: 'neurology', company_name: 'B' } },
            { user_id: 'user-1', details: { therapeutic_area: 'immunology', company_name: 'C' } },
          ],
        });

        const res = await concentrationGET(makeReq('/api/portfolio/concentration'));
        const data = await res.json();
        expect(data.alerts).toEqual([]);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('pipeline', () => {
    beforeEach(() => {
      mockRequireTeamMember.mockResolvedValue({ user: mockUser, teamId: 'team-1' });
    });

    describe('GET', () => {
      it('returns 401 when not a team member', async () => {
        mockRequireTeamMember.mockResolvedValue({
          error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
        });
        const res = await pipelineGET(makeReq('/api/portfolio/pipeline'));
        expect(res.status).toBe(401);
      });

      it('returns deals with conflict detection', async () => {
        const deals = [
          { id: 'd1', company_name: 'CompA', partner_name: 'Pfizer', stage: 'evaluating' },
          { id: 'd2', company_name: 'CompB', partner_name: 'Pfizer', stage: 'active' },
          { id: 'd3', company_name: 'CompC', partner_name: 'Roche', stage: 'evaluating' },
        ];
        fromChains[0] = createChain({ data: deals });

        const res = await pipelineGET(makeReq('/api/portfolio/pipeline'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.deals).toHaveLength(3);
        // Pfizer is a partner for both CompA and CompB -> conflict
        expect(data.conflicts).toHaveLength(1);
        expect(data.conflicts[0].partner_name).toBe('Pfizer');
        expect(data.conflicts[0].companies).toContain('CompA');
        expect(data.conflicts[0].companies).toContain('CompB');
      });

      it('returns empty conflicts when no partner overlap', async () => {
        const deals = [
          { id: 'd1', company_name: 'CompA', partner_name: 'Pfizer', stage: 'evaluating' },
          { id: 'd2', company_name: 'CompB', partner_name: 'Roche', stage: 'active' },
        ];
        fromChains[0] = createChain({ data: deals });

        const res = await pipelineGET(makeReq('/api/portfolio/pipeline'));
        const data = await res.json();
        expect(data.conflicts).toHaveLength(0);
      });
    });

    describe('POST', () => {
      it('returns 400 when company_name is missing', async () => {
        const res = await pipelinePOST(jsonReq('/api/portfolio/pipeline', 'POST', { partner_name: 'Pfizer' }));
        expect(res.status).toBe(400);
      });

      it('creates deal and detects conflicts', async () => {
        const newDeal = {
          id: 'd-new', company_name: 'NewCo', partner_name: 'Pfizer',
          stage: 'evaluating', priority: 'medium',
        };
        // Chain 0: insert deal
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: newDeal, error: null }),
        });
        // Chain 1: select all deals for conflict check (terminal: .eq())
        fromChains[1] = createChain({
          data: [
            newDeal,
            { id: 'd1', company_name: 'OldCo', partner_name: 'Pfizer', stage: 'active' },
          ],
        });

        const res = await pipelinePOST(jsonReq('/api/portfolio/pipeline', 'POST', {
          company_name: 'NewCo',
          partner_name: 'Pfizer',
          therapeutic_area: 'oncology',
        }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.deal.id).toBe('d-new');
        expect(data.conflicts).toHaveLength(1);
      });

      it('creates deal with defaults when optional fields omitted', async () => {
        const newDeal = { id: 'd2', company_name: 'Solo', stage: 'evaluating', priority: 'medium' };
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: newDeal, error: null }),
        });
        fromChains[1] = createChain({ data: [newDeal] });

        const res = await pipelinePOST(jsonReq('/api/portfolio/pipeline', 'POST', { company_name: 'Solo' }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.deal.company_name).toBe('Solo');
        expect(data.conflicts).toHaveLength(0);
      });
    });

    describe('PUT', () => {
      it('returns 400 when id is missing', async () => {
        const res = await pipelinePUT(jsonReq('/api/portfolio/pipeline', 'PUT', { stage: 'active' }));
        expect(res.status).toBe(400);
      });

      it('updates deal on success', async () => {
        const updated = { id: 'd1', company_name: 'CompA', stage: 'due_diligence' };
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: updated, error: null }),
        });

        const res = await pipelinePUT(jsonReq('/api/portfolio/pipeline', 'PUT', {
          id: 'd1', stage: 'due_diligence', priority: 'high',
        }));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.deal.stage).toBe('due_diligence');
      });

      it('returns 500 when update fails', async () => {
        fromChains[0] = createChain({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        });

        const res = await pipelinePUT(jsonReq('/api/portfolio/pipeline', 'PUT', { id: 'd1', stage: 'active' }));
        expect(res.status).toBe(500);
      });
    });

    describe('DELETE', () => {
      it('returns 400 when id is missing', async () => {
        const res = await pipelineDELETE(makeReq('/api/portfolio/pipeline'));
        expect(res.status).toBe(400);
      });

      it('deletes deal on success', async () => {
        // Chain terminates with .eq() calls; chain.error = null (default) = success
        fromChains[0] = createChain();

        const res = await pipelineDELETE(makeReq('/api/portfolio/pipeline?id=d1'));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.deleted).toBe(true);
      });

      it('returns 500 when delete fails', async () => {
        fromChains[0] = createChain({ error: { message: 'constraint violation' } });

        const res = await pipelineDELETE(makeReq('/api/portfolio/pipeline?id=d1'));
        expect(res.status).toBe(500);
      });
    });
  });
});
