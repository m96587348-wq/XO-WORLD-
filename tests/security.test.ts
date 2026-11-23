import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createApp } from '../server';
import { resetStoreForTests } from '../server/store';

let server: http.Server;
let baseUrl = '';

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = {};
  }
  return { status: res.status, json, res };
}

async function sandboxSignIn(userId: string): Promise<string> {
  const { status, json } = await api('/api/auth/sandbox-signin', {
    method: 'POST',
    body: { userId },
  });
  assert.equal(status, 200);
  assert.equal(typeof json.token, 'string');
  return json.token as string;
}

describe('XO WORLD Security, Isolation & API Verification Suite', () => {
  before(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    resetStoreForTests();
  });

  it('1. Authentication & Privilege Escalation Prevention', async () => {
    // Unauthenticated access must fail with 401
    const unauthPlayers = await api('/api/players');
    assert.equal(unauthPlayers.status, 401);

    const unauthFinance = await api('/api/finance');
    assert.equal(unauthFinance.status, 401);

    // Public self-registration as OWNER / DELEGATE / COACH must be rejected with 403
    for (const attemptedRole of ['OWNER', 'DELEGATE', 'COACH']) {
      const esc = await api('/api/auth/register', {
        method: 'POST',
        body: {
          fullName: 'حساب محاولة تصعيد',
          email: `esc_${attemptedRole.toLowerCase()}@example.com`,
          phone: '01009991111',
          password: 'Password123!',
          requestedRole: attemptedRole,
        },
      });
      assert.equal(esc.status, 403);
    }

    // Public registration as PARENT succeeds
    const reg = await api('/api/auth/register', {
      method: 'POST',
      body: {
        fullName: 'ولي أمر جديد',
        email: 'new.parent@example.com',
        phone: '01009992222',
        password: 'StrongPassword123',
        requestedRole: 'PARENT',
      },
    });
    assert.equal(reg.status, 201);
    assert.equal((reg.json.user as { role: string }).role, 'PARENT');

    // Wrong password rejected with 401
    const badLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'new.parent@example.com', password: 'WrongPassword' },
    });
    assert.equal(badLogin.status, 401);

    // Valid login succeeds
    const goodLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'new.parent@example.com', password: 'StrongPassword123' },
    });
    assert.equal(goodLogin.status, 200);

    // Password recovery flow works end-to-end
    const forgot = await api('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: 'new.parent@example.com' },
    });
    assert.equal(forgot.status, 200);
    const code = forgot.json.previewResetCode as string;
    assert.equal(typeof code, 'string');

    const reset = await api('/api/auth/reset-password', {
      method: 'POST',
      body: {
        email: 'new.parent@example.com',
        code,
        newPassword: 'UpdatedPassword999',
      },
    });
    assert.equal(reset.status, 200);

    const loginAfterReset = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'new.parent@example.com', password: 'UpdatedPassword999' },
    });
    assert.equal(loginAfterReset.status, 200);
  });

  it('2. Role Authorization & Owner-Only Controls', async () => {
    const ownerToken = await sandboxSignIn('user_owner_1');
    const delegateToken = await sandboxSignIn('user_delegate_1');
    const coachToken = await sandboxSignIn('user_coach_1');
    const parentToken = await sandboxSignIn('user_parent_1');
    const playerToken = await sandboxSignIn('user_player_1');

    // Only OWNER can view audit logs or assign roles
    for (const token of [delegateToken, coachToken, parentToken, playerToken]) {
      const auditRes = await api('/api/control/audit-logs', { token });
      assert.equal(auditRes.status, 403);

      const assignRes = await api('/api/control/assign-role', {
        method: 'POST',
        token,
        body: { userId: 'user_parent_1', role: 'OWNER' },
      });
      assert.equal(assignRes.status, 403);
    }

    const ownerAudit = await api('/api/control/audit-logs', { token: ownerToken });
    assert.equal(ownerAudit.status, 200);

    // COACH cannot access financial endpoints
    const coachFinance = await api('/api/finance', { token: coachToken });
    assert.equal(coachFinance.status, 403);

    // PLAYER cannot create top-level community posts
    const playerPost = await api('/api/community/posts', {
      method: 'POST',
      token: playerToken,
      body: { titleAr: 'منشور', bodyAr: 'محاولة نشر من حساب لاعب' },
    });
    assert.equal(playerPost.status, 403);
  });

  it('3. Strict Parent Isolation (Parent A cannot access Parent B child)', async () => {
    const parent1Token = await sandboxSignIn('user_parent_1'); // Mona: plr_101, plr_102
    const parent2Token = await sandboxSignIn('user_parent_2'); // Tarek: plr_103

    const p1List = await api('/api/players', { token: parent1Token });
    assert.equal(p1List.status, 200);
    const p1Ids = (p1List.json.players as Array<{ id: string }>).map((p) => p.id);
    assert.deepEqual(p1Ids.sort(), ['plr_101', 'plr_102']);

    // Parent 1 reading Parent 2's child directly must fail with 403
    const p1ReadHamza = await api('/api/players/plr_103', { token: parent1Token });
    assert.equal(p1ReadHamza.status, 403);

    // Parent 2 reading Parent 1's child directly must fail with 403
    const p2ReadYoussef = await api('/api/players/plr_101', { token: parent2Token });
    assert.equal(p2ReadYoussef.status, 403);

    // Parent 1 trying to register Parent 2's child for an event must fail with 403
    const crossEventReg = await api('/api/events/evt_1/register', {
      method: 'POST',
      token: parent1Token,
      body: { playerId: 'plr_103' },
    });
    assert.equal(crossEventReg.status, 403);
  });

  it('4. Strict Coach Group Isolation', async () => {
    const coach1Token = await sandboxSignIn('user_coach_1'); // Karim: grp_parkour_gamal ONLY

    const listRes = await api('/api/players', { token: coach1Token });
    assert.equal(listRes.status, 200);
    const ids = (listRes.json.players as Array<{ id: string }>).map((p) => p.id);
    assert.deepEqual(ids, ['plr_101']);

    // Even in same branch (branch_gamal), Coach 1 cannot read Kickboxing player plr_103
    const otherGroupPlayer = await api('/api/players/plr_103', { token: coach1Token });
    assert.equal(otherGroupPlayer.status, 403);

    // Coach 1 cannot update notes for plr_103
    const notesDenied = await api('/api/players/plr_103/notes', {
      method: 'PATCH',
      token: coach1Token,
      body: { coachNotes: 'غير مصرح', performanceScore: 90 },
    });
    assert.equal(notesDenied.status, 403);

    // Coach 1 cannot mark attendance for grp_kickboxing_gamal
    const attDenied = await api('/api/attendance/mark', {
      method: 'POST',
      token: coach1Token,
      body: {
        groupId: 'grp_kickboxing_gamal',
        sessionDate: '2026-11-23',
        entries: [{ playerId: 'plr_103', status: 'present' }],
      },
    });
    assert.equal(attDenied.status, 403);

    // Coach 1 CAN mark attendance for their assigned group grp_parkour_gamal
    const attAllowed = await api('/api/attendance/mark', {
      method: 'POST',
      token: coach1Token,
      body: {
        groupId: 'grp_parkour_gamal',
        sessionDate: '2026-11-23',
        entries: [{ playerId: 'plr_101', status: 'present', note: 'ممتاز' }],
      },
    });
    assert.equal(attAllowed.status, 201);
  });

  it('5. Strict Delegate Branch & Permission Isolation', async () => {
    const delegateToken = await sandboxSignIn('user_delegate_1'); // Salma: branch_gamal only, no manage_media

    const listRes = await api('/api/players', { token: delegateToken });
    assert.equal(listRes.status, 200);
    const branches = new Set(
      (listRes.json.players as Array<{ branchId: string }>).map((p) => p.branchId),
    );
    assert.deepEqual(Array.from(branches), ['branch_gamal']);

    // Cannot read Khalil Hamada branch player plr_102
    const otherBranchRead = await api('/api/players/plr_102', { token: delegateToken });
    assert.equal(otherBranchRead.status, 403);

    // Cannot create player in Khalil Hamada branch
    const otherBranchCreate = await api('/api/players', {
      method: 'POST',
      token: delegateToken,
      body: {
        fullName: 'لاعب خارج النطاق',
        birthDate: '2015-05-05',
        branchId: 'branch_khalil',
        sportId: 'sport_taekwondo',
        groupId: 'grp_tkd_khalil',
      },
    });
    assert.equal(otherBranchCreate.status, 403);

    // Cannot record payment for Khalil Hamada branch player
    const otherBranchPay = await api('/api/finance/payments', {
      method: 'POST',
      token: delegateToken,
      body: {
        playerId: 'plr_102',
        amountEgp: 900,
        outstandingBalanceEgp: 0,
        billingMonth: '2026-11',
        paymentMethod: 'نقدي بالفرع',
        status: 'paid',
      },
    });
    assert.equal(otherBranchPay.status, 403);

    // Can record payment for Gamal Abdel Nasser branch player
    const ownBranchPay = await api('/api/finance/payments', {
      method: 'POST',
      token: delegateToken,
      body: {
        playerId: 'plr_101',
        amountEgp: 850,
        outstandingBalanceEgp: 0,
        billingMonth: '2026-12',
        paymentMethod: 'نقدي بالفرع',
        status: 'paid',
      },
    });
    assert.equal(ownBranchPay.status, 201);

    // Lacks manage_media permission even in assigned branch
    const mediaDenied = await api('/api/media', {
      method: 'POST',
      token: delegateToken,
      body: {
        titleAr: 'صورة اختبار',
        albumAr: 'عام',
        kind: 'image',
        visibility: 'branch',
        branchId: 'branch_gamal',
        dataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      },
    });
    assert.equal(mediaDenied.status, 403);
  });

  it('6. Validation, Private Upload Protection & Config Secret Safety', async () => {
    const ownerToken = await sandboxSignIn('user_owner_1');
    const parent1Token = await sandboxSignIn('user_parent_1');
    const parent2Token = await sandboxSignIn('user_parent_2');

    // Invalid negative payment rejected with 400
    const badPay = await api('/api/finance/payments', {
      method: 'POST',
      token: ownerToken,
      body: {
        playerId: 'plr_101',
        amountEgp: -50,
        billingMonth: 'invalid',
        status: 'paid',
      },
    });
    assert.equal(badPay.status, 400);

    // Owner uploads private_player photo for plr_101 (Mona's child)
    const upload = await api('/api/media', {
      method: 'POST',
      token: ownerToken,
      body: {
        titleAr: 'ملف خاص باللاعب يوسف',
        albumAr: 'خاص',
        kind: 'image',
        visibility: 'private_player',
        branchId: 'branch_gamal',
        groupId: 'grp_parkour_gamal',
        playerId: 'plr_101',
        dataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      },
    });
    assert.equal(upload.status, 201);
    const fileUrl = (upload.json.mediaItem as { fileUrl: string }).fileUrl;

    // Unauthenticated fetch to private file -> 401
    const unauthFile = await api(fileUrl);
    assert.equal(unauthFile.status, 401);

    // Parent 2 (Tarek) fetching Mona's child private file -> 403
    const p2File = await api(fileUrl, { token: parent2Token });
    assert.equal(p2File.status, 403);

    // Parent 1 (Mona) fetching her child's private file -> 200
    const p1File = await api(fileUrl, { token: parent1Token });
    assert.equal(p1File.status, 200);

    // Config status must not expose secret keys
    const cfg = await api('/api/system/config-status');
    assert.equal(cfg.status, 200);
    assert.equal('SUPABASE_SERVICE_ROLE_KEY' in cfg.json, false);
  });
});
