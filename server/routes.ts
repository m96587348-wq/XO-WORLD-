import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import {
  generateResetCode,
  hashPassword,
  signSessionToken,
  verifyPassword,
} from './auth';
import {
  canAccessMediaItem,
  canEditPlayerProfile,
  canManageAttendance,
  canManageFinance,
  canReadFinanceForPlayer,
  canReadPlayer,
  canUpdateCoachNotes,
  delegateHasPermission,
  parentOwnsPlayer,
  requireAuth,
  toPublicUserProfile,
  writeAuditLog,
  type AuthenticatedRequest,
} from './rbac';
import { getStore } from './store';
import { getSystemConfigStatus } from './supabaseAdmin';
import type { AppRole, DelegatePermissionKey } from '../src/types/xo';

const UPLOAD_DIR = path.resolve('/tmp', 'xo_world_uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);

function parseDataUriUpload(dataUri: string, maxBytes = 4 * 1024 * 1024) {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri.trim());
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIMES.has(mimeType) && !ALLOWED_VIDEO_MIMES.has(mimeType)) {
    return null;
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > maxBytes) {
    return null;
  }
  return { mimeType, buffer };
}

export function createApiRouter() {
  const router = express.Router();

  // ---------------------------------------------------------------------------
  // SYSTEM CONFIG STATUS (Safe booleans only — zero keys or secrets exposed)
  // ---------------------------------------------------------------------------
  router.get('/system/config-status', (_req, res) => {
    res.json(getSystemConfigStatus());
  });

  // ---------------------------------------------------------------------------
  // AUTHENTICATION & ACCOUNT MANAGEMENT
  // ---------------------------------------------------------------------------
  router.get('/auth/sandbox-accounts', (_req, res) => {
    const status = getSystemConfigStatus();
    if (status.isSupabaseConnected) {
      res.status(403).json({ error: 'حسابات المعاينة معطلة عند الاتصال بـ Supabase.' });
      return;
    }
    const store = getStore();
    res.json({
      accounts: store.users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        scopeLabel:
          u.role === 'OWNER'
            ? 'صلاحية كاملة على جميع الفروع'
            : u.role === 'DELEGATE'
              ? 'مفوض فرع ميامي — جمال عبد الناصر'
              : u.role === 'COACH'
                ? `مدرب (${u.assignedGroupIds.length} مجموعة)`
                : u.role === 'PARENT'
                  ? `ولي أمر (${u.linkedPlayerIds.length} لاعب)`
                  : 'لاعب مسجل',
      })),
    });
  });

  router.post('/auth/sandbox-signin', (req, res) => {
    const status = getSystemConfigStatus();
    if (status.isSupabaseConnected) {
      res.status(403).json({ error: 'الدخول السريع للمعاينة غير متاح في بيئة الإنتاج.' });
      return;
    }
    const schema = z.object({ userId: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'معرف الحساب غير صالح.' });
      return;
    }
    const store = getStore();
    const user = store.users.find((u) => u.id === parsed.data.userId && u.isActive);
    if (!user) {
      res.status(404).json({ error: 'الحساب غير موجود.' });
      return;
    }
    const token = signSessionToken(user.id);
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'SANDBOX_SIGNIN',
      targetTable: 'profiles',
      targetId: user.id,
    });
    res.json({ token, user: toPublicUserProfile(user) });
  });

  router.post('/auth/login', (req, res) => {
    const schema = z.object({
      email: z.string().email('يرجى إدخال بريد إلكتروني صحيح.'),
      password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'بيانات الدخول غير صالحة.' });
      return;
    }
    const store = getStore();
    const user = store.users.find(
      (u) => u.email.toLowerCase() === parsed.data.email.toLowerCase(),
    );
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: 'هذا الحساب موقوف حالياً. تواصل مع إدارة الأكاديمية.' });
      return;
    }
    const token = signSessionToken(user.id);
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'LOGIN',
      targetTable: 'profiles',
      targetId: user.id,
    });
    res.json({ token, user: toPublicUserProfile(user) });
  });

  // Public self-registration: STRICTLY blocks OWNER, DELEGATE, and COACH privilege escalation
  router.post('/auth/register', (req, res) => {
    const schema = z.object({
      fullName: z.string().trim().min(3, 'الاسم الكامل مطلوب (3 أحرف على الأقل).'),
      email: z.string().email('البريد الإلكتروني غير صحيح.'),
      phone: z.string().trim().min(8, 'رقم الهاتف غير صحيح.'),
      password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.'),
      requestedRole: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'بيانات التسجيل غير صالحة.' });
      return;
    }

    const requested = (parsed.data.requestedRole || 'PARENT').toUpperCase();
    if (requested !== 'PARENT' && requested !== 'PLAYER') {
      writeAuditLog({
        actorUserId: null,
        actorName: parsed.data.email,
        actorRole: null,
        action: 'BLOCKED_PRIVILEGED_SELF_REGISTRATION',
        targetTable: 'user_roles',
        targetId: null,
        details: { attemptedRole: requested },
      });
      res.status(403).json({
        error: 'غير مسموح بالتسجيل الذاتي كمالك أو مفوض أو مدرب. يتم تعيين هذه الأدوار من المالك فقط.',
      });
      return;
    }

    const store = getStore();
    if (store.users.some((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase())) {
      res.status(409).json({ error: 'البريد الإلكتروني مسجل بالفعل.' });
      return;
    }

    const newUserId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const role: AppRole = requested === 'PLAYER' ? 'PLAYER' : 'PARENT';
    const newUser = {
      id: newUserId,
      fullName: parsed.data.fullName,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone,
      role,
      passwordHash: hashPassword(parsed.data.password),
      isActive: true,
      assignedBranchIds: [],
      delegatePermissions: [],
      assignedGroupIds: [],
      linkedPlayerIds: [],
    };
    store.users.push(newUser);

    if (role === 'PARENT') {
      store.parents.push({
        id: `par_${Date.now()}`,
        userId: newUserId,
        fullName: newUser.fullName,
        phone: newUser.phone,
        email: newUser.email,
        emergencyContact: '',
        playerIds: [],
      });
    }

    writeAuditLog({
      actorUserId: newUserId,
      actorName: newUser.fullName,
      actorRole: role,
      action: 'REGISTER_PUBLIC_ACCOUNT',
      targetTable: 'profiles',
      targetId: newUserId,
    });

    const token = signSessionToken(newUserId);
    res.status(201).json({ token, user: toPublicUserProfile(newUser) });
  });

  router.post('/auth/forgot-password', (req, res) => {
    const schema = z.object({ email: z.string().email('أدخل بريداً إلكترونياً صحيحاً.') });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message });
      return;
    }
    const store = getStore();
    const user = store.users.find(
      (u) => u.email.toLowerCase() === parsed.data.email.toLowerCase(),
    );
    const code = generateResetCode();
    if (user) {
      store.resetTokens = store.resetTokens.filter((t) => t.email !== user.email);
      store.resetTokens.push({
        email: user.email,
        code,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
      writeAuditLog({
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'PASSWORD_RESET_REQUESTED',
        targetTable: 'profiles',
        targetId: user.id,
      });
    }
    const status = getSystemConfigStatus();
    // In local preview without SMTP/Supabase email, return previewCode only when user exists and Supabase is not connected
    res.json({
      message: 'إذا كان البريد مسجلاً لدينا، تم إنشاء رمز استعادة كلمة المرور.',
      previewResetCode: !status.isSupabaseConnected && user ? code : undefined,
    });
  });

  router.post('/auth/reset-password', (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      code: z.string().min(6),
      newPassword: z.string().min(8, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة.' });
      return;
    }
    const store = getStore();
    const email = parsed.data.email.toLowerCase();
    const tokenEntry = store.resetTokens.find(
      (t) => t.email === email && t.code === parsed.data.code && t.expiresAt > Date.now(),
    );
    if (!tokenEntry) {
      res.status(400).json({ error: 'رمز التحقق غير صحيح أو منتهي الصلاحية.' });
      return;
    }
    const user = store.users.find((u) => u.email === email);
    if (!user) {
      res.status(404).json({ error: 'المستخدم غير موجود.' });
      return;
    }
    user.passwordHash = hashPassword(parsed.data.newPassword);
    store.resetTokens = store.resetTokens.filter((t) => t.email !== email);
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      targetTable: 'profiles',
      targetId: user.id,
    });
    res.json({ message: 'تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.' });
  });

  router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: toPublicUserProfile(req.authUser!) });
  });

  router.patch('/auth/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      fullName: z.string().trim().min(3, 'الاسم يجب أن يكون 3 أحرف على الأقل.'),
      phone: z.string().trim().min(8, 'رقم الهاتف غير صالح.'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message });
      return;
    }
    const user = req.authUser!;
    user.fullName = parsed.data.fullName;
    user.phone = parsed.data.phone;
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'UPDATE_OWN_PROFILE',
      targetTable: 'profiles',
      targetId: user.id,
    });
    res.json({ user: toPublicUserProfile(user) });
  });

  // ---------------------------------------------------------------------------
  // 1. XO HOME DASHBOARD
  // ---------------------------------------------------------------------------
  router.get('/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const visiblePlayers = store.players.filter((p) => canReadPlayer(user, p));
    const visiblePlayerIds = new Set(visiblePlayers.map((p) => p.id));

    const visibleAttendance = store.attendance.filter((a) => visiblePlayerIds.has(a.playerId));
    const presentCount = visibleAttendance.filter((a) => a.status === 'present').length;
    const attendanceRate =
      visibleAttendance.length > 0
        ? Math.round((presentCount / visibleAttendance.length) * 100)
        : 0;

    const visibleSubs = store.subscriptions.filter((s) => visiblePlayerIds.has(s.playerId));
    const visiblePayments = store.payments.filter((pay) => {
      const player = store.players.find((p) => p.id === pay.playerId);
      return player ? canReadFinanceForPlayer(user, player) : false;
    });

    const outstandingTotal = visiblePayments.reduce(
      (sum, p) => sum + p.outstandingBalanceEgp,
      0,
    );

    const announcements = store.announcements.filter(
      (a) => !a.branchId || user.role === 'OWNER' || user.assignedBranchIds.includes(a.branchId) || visiblePlayers.some((p) => p.branchId === a.branchId),
    );

    const upcomingEvents = store.events.filter((e) => e.status === 'upcoming' || e.status === 'ongoing');
    const notifications = store.notifications.filter((n) => n.userId === user.id);

    const recentActivity =
      user.role === 'OWNER'
        ? store.auditLogs.slice(0, 5)
        : store.auditLogs
            .filter((l) => l.actorUserId === user.id || (l.branchId && user.assignedBranchIds.includes(l.branchId)))
            .slice(0, 5);

    res.json({
      stats: {
        visiblePlayersCount: visiblePlayers.length,
        activeGroupsCount:
          user.role === 'COACH'
            ? user.assignedGroupIds.length
            : user.role === 'DELEGATE'
              ? store.groups.filter((g) => user.assignedBranchIds.includes(g.branchId)).length
              : store.groups.length,
        attendanceRate,
        upcomingEventsCount: upcomingEvents.length,
        activeSubscriptionsCount: visibleSubs.filter((s) => s.status === 'active').length,
        outstandingBalanceEgp: user.role === 'COACH' ? null : outstandingTotal,
      },
      announcements,
      upcomingEvents: upcomingEvents.map((e) => ({
        ...e,
        registrations: e.registrations.filter(
          (r) => user.role === 'OWNER' || visiblePlayerIds.has(r.playerId),
        ),
      })),
      notifications,
      recentActivity,
    });
  });

  // ---------------------------------------------------------------------------
  // 2. XO ACADEMY (Branches, Sports, Coaches, Training Groups)
  // ---------------------------------------------------------------------------
  router.get('/academy', requireAuth, (req: AuthenticatedRequest, res) => {
    const store = getStore();
    res.json({
      branches: store.branches,
      sports: store.sports,
      coaches: store.coaches,
      groups: store.groups.map((g) => ({
        ...g,
        enrolledCount: store.players.filter((p) => p.groupId === g.id && p.isActive).length,
      })),
    });
  });

  router.post('/academy/groups', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'OWNER') {
      res.status(403).json({ error: 'إنشاء المجموعات التدريبية متاح للمالك فقط.' });
      return;
    }
    const schema = z.object({
      nameAr: z.string().trim().min(3),
      branchId: z.enum(['branch_gamal', 'branch_khalil']),
      sportId: z.string().min(1),
      ageRange: z.string().trim().min(2),
      scheduleDays: z.string().trim().min(3),
      scheduleTime: z.string().trim().min(3),
      maxCapacity: z.number().int().min(1).max(100),
      coachIds: z.array(z.string()).default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات المجموعة غير مكتملة أو غير صالحة.' });
      return;
    }
    const store = getStore();
    const newGroup = {
      id: `grp_${Date.now()}`,
      ...parsed.data,
      isActive: true,
    };
    store.groups.push(newGroup);
    for (const cId of parsed.data.coachIds) {
      const coach = store.coaches.find((c) => c.id === cId);
      if (coach && !coach.assignedGroupIds.includes(newGroup.id)) {
        coach.assignedGroupIds.push(newGroup.id);
        const coachUser = store.users.find((u) => u.id === coach.userId);
        if (coachUser && !coachUser.assignedGroupIds.includes(newGroup.id)) {
          coachUser.assignedGroupIds.push(newGroup.id);
        }
      }
    }
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'CREATE_TRAINING_GROUP',
      targetTable: 'training_groups',
      targetId: newGroup.id,
      branchId: newGroup.branchId,
    });
    res.status(201).json({ group: newGroup });
  });

  // ---------------------------------------------------------------------------
  // 3. XO PLAYERS (Strict Isolation Enforced)
  // ---------------------------------------------------------------------------
  router.get('/players', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const scoped = store.players.filter((p) => canReadPlayer(user, p));

    const enriched = scoped.map((player) => {
      const att = store.attendance.filter((a) => a.playerId === player.id);
      const sub = store.subscriptions.find((s) => s.playerId === player.id) ?? null;
      const canSeeFinance = canReadFinanceForPlayer(user, player);
      const payments = canSeeFinance
        ? store.payments.filter((pay) => pay.playerId === player.id)
        : [];
      return {
        ...player,
        attendanceHistory: att,
        subscription: sub,
        payments,
      };
    });

    res.json({ players: enriched });
  });

  router.get('/players/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const player = store.players.find((p) => p.id === req.params.id);
    if (!player) {
      res.status(404).json({ error: 'اللاعب غير موجود.' });
      return;
    }
    if (!canReadPlayer(user, player)) {
      res.status(403).json({ error: 'غير مصرح لك بعرض ملف هذا اللاعب.' });
      return;
    }
    const att = store.attendance.filter((a) => a.playerId === player.id);
    const sub = store.subscriptions.find((s) => s.playerId === player.id) ?? null;
    const payments = canReadFinanceForPlayer(user, player)
      ? store.payments.filter((pay) => pay.playerId === player.id)
      : [];

    res.json({
      player: {
        ...player,
        attendanceHistory: att,
        subscription: sub,
        payments,
      },
    });
  });

  router.post('/players', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const schema = z.object({
      fullName: z.string().trim().min(3, 'اسم اللاعب مطلوب.'),
      birthDate: z.string().min(4),
      branchId: z.enum(['branch_gamal', 'branch_khalil']),
      sportId: z.string().min(1),
      groupId: z.string().min(1),
      beltOrLevel: z.string().trim().min(1).default('مبتدئ'),
      medicalNotes: z.string().default('لا توجد ملاحظات طبية.'),
      parentId: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'بيانات اللاعب غير صالحة.' });
      return;
    }
    if (!canEditPlayerProfile(user, parsed.data.branchId)) {
      res.status(403).json({ error: 'ليست لديك صلاحية إضافة لاعبين لهذا الفرع.' });
      return;
    }

    const store = getStore();
    const sport = store.sports.find((s) => s.id === parsed.data.sportId);
    const group = store.groups.find(
      (g) => g.id === parsed.data.groupId && g.branchId === parsed.data.branchId,
    );
    if (!sport || !group) {
      res.status(400).json({ error: 'الرياضة أو المجموعة التدريبية غير متوافقة مع الفرع المحدد.' });
      return;
    }

    const nextNum = 101 + store.players.length;
    const parent = parsed.data.parentId
      ? store.parents.find((p) => p.id === parsed.data.parentId)
      : undefined;

    const newPlayerId = `plr_${Date.now()}`;
    const newPlayer = {
      id: newPlayerId,
      playerCode: `XO-26-${nextNum}`,
      fullName: parsed.data.fullName,
      birthDate: parsed.data.birthDate,
      photoUrl: sport.imageUrl,
      branchId: parsed.data.branchId,
      sportId: parsed.data.sportId,
      groupId: parsed.data.groupId,
      beltOrLevel: parsed.data.beltOrLevel,
      performanceScore: 75,
      coachNotes: '',
      medicalNotes: parsed.data.medicalNotes,
      parentIds: parent ? [parent.id] : [],
      parentNames: parent ? [parent.fullName] : ['غير مرتبط بعد'],
      isActive: true,
    };
    store.players.push(newPlayer);

    if (parent) {
      parent.playerIds.push(newPlayerId);
      const pUser = store.users.find((u) => u.id === parent.userId);
      if (pUser) pUser.linkedPlayerIds.push(newPlayerId);
    }

    // Create initial subscription
    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    store.subscriptions.push({
      id: `sub_${Date.now()}`,
      playerId: newPlayerId,
      branchId: newPlayer.branchId,
      sportId: newPlayer.sportId,
      planNameAr: `اشتراك ${sport.nameAr} شهري`,
      monthlyAmountEgp: sport.monthlyFeeEgp,
      startDate,
      endDate,
      status: 'active',
    });

    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'CREATE_PLAYER',
      targetTable: 'players',
      targetId: newPlayerId,
      branchId: newPlayer.branchId,
      details: { playerCode: newPlayer.playerCode },
    });

    res.status(201).json({ player: newPlayer });
  });

  router.patch('/players/:id/notes', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const player = store.players.find((p) => p.id === req.params.id);
    if (!player) {
      res.status(404).json({ error: 'اللاعب غير موجود.' });
      return;
    }
    if (!canUpdateCoachNotes(user, player)) {
      res.status(403).json({ error: 'لا تملك صلاحية تحديث ملاحظات هذا اللاعب.' });
      return;
    }
    const schema = z.object({
      coachNotes: z.string().trim().max(1000),
      performanceScore: z.number().int().min(0).max(100),
      beltOrLevel: z.string().trim().min(1).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات التقييم غير صالحة.' });
      return;
    }
    player.coachNotes = parsed.data.coachNotes;
    player.performanceScore = parsed.data.performanceScore;
    if (parsed.data.beltOrLevel) player.beltOrLevel = parsed.data.beltOrLevel;

    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'UPDATE_PLAYER_COACH_NOTES',
      targetTable: 'players',
      targetId: player.id,
      branchId: player.branchId,
    });
    res.json({ player });
  });

  // ---------------------------------------------------------------------------
  // 4. ATTENDANCE
  // ---------------------------------------------------------------------------
  router.get('/attendance', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const visiblePlayers = store.players.filter((p) => canReadPlayer(user, p));
    const visibleIds = new Set(visiblePlayers.map((p) => p.id));
    const records = store.attendance.filter((a) => visibleIds.has(a.playerId));
    res.json({ attendance: records });
  });

  router.post('/attendance/mark', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const schema = z.object({
      groupId: z.string().min(1),
      sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ يجب أن تكون YYYY-MM-DD'),
      entries: z
        .array(
          z.object({
            playerId: z.string().min(1),
            status: z.enum(['present', 'absent', 'excused']),
            note: z.string().max(300).optional(),
          }),
        )
        .min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'بيانات الحضور غير صالحة.' });
      return;
    }

    const store = getStore();
    const group = store.groups.find((g) => g.id === parsed.data.groupId);
    if (!group) {
      res.status(404).json({ error: 'المجموعة التدريبية غير موجودة.' });
      return;
    }
    if (!canManageAttendance(user, group.branchId, group.id)) {
      res.status(403).json({ error: 'غير مصرح لك بتسجيل حضور هذه المجموعة.' });
      return;
    }

    const saved = [];
    for (const entry of parsed.data.entries) {
      const player = store.players.find(
        (p) => p.id === entry.playerId && p.groupId === group.id,
      );
      if (!player) {
        res.status(400).json({ error: 'أحد اللاعبين غير مسجل في هذه المجموعة.' });
        return;
      }
      const existing = store.attendance.find(
        (a) =>
          a.playerId === entry.playerId &&
          a.groupId === group.id &&
          a.sessionDate === parsed.data.sessionDate,
      );
      if (existing) {
        existing.status = entry.status;
        existing.note = entry.note ?? '';
        existing.recordedBy = user.id;
        existing.recordedByName = user.fullName;
        saved.push(existing);
      } else {
        const rec = {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          playerId: entry.playerId,
          groupId: group.id,
          branchId: group.branchId,
          sessionDate: parsed.data.sessionDate,
          status: entry.status,
          note: entry.note ?? '',
          recordedBy: user.id,
          recordedByName: user.fullName,
        };
        store.attendance.unshift(rec);
        saved.push(rec);
      }
    }

    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'MARK_GROUP_ATTENDANCE',
      targetTable: 'attendance',
      targetId: group.id,
      branchId: group.branchId,
      details: { sessionDate: parsed.data.sessionDate, count: saved.length },
    });

    res.status(201).json({ records: saved });
  });

  // ---------------------------------------------------------------------------
  // 5. FINANCE (Subscriptions, Payments, Branch & Monthly Reports)
  // ---------------------------------------------------------------------------
  router.get('/finance', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (user.role === 'COACH') {
      res.status(403).json({ error: 'السجلات المالية والاشتراكات غير متاحة لحساب المدرب.' });
      return;
    }
    const store = getStore();
    const visiblePlayers = store.players.filter((p) => canReadFinanceForPlayer(user, p));
    const visibleIds = new Set(visiblePlayers.map((p) => p.id));

    const subscriptions = store.subscriptions.filter((s) => visibleIds.has(s.playerId));
    const payments = store.payments.filter((pay) => visibleIds.has(pay.playerId));

    // Branch & Monthly reports only for OWNER or permitted DELEGATE
    const canSeeAggregateReports =
      user.role === 'OWNER' ||
      (user.role === 'DELEGATE' &&
        user.assignedBranchIds.some(
          (bId) =>
            delegateHasPermission(user, bId, 'manage_payments') ||
            delegateHasPermission(user, bId, 'view_reports'),
        ));

    const branchTotals = canSeeAggregateReports
      ? store.branches
          .filter(
            (b) => user.role === 'OWNER' || user.assignedBranchIds.includes(b.id),
          )
          .map((b) => {
            const branchPays = payments.filter((p) => p.branchId === b.id);
            return {
              branchId: b.id,
              branchName: b.nameAr,
              collectedEgp: branchPays
                .filter((p) => p.status === 'paid')
                .reduce((sum, p) => sum + p.amountEgp, 0),
              outstandingEgp: branchPays.reduce(
                (sum, p) => sum + p.outstandingBalanceEgp,
                0,
              ),
              transactionsCount: branchPays.length,
            };
          })
      : [];

    const monthlyMap = new Map<string, { month: string; collectedEgp: number; outstandingEgp: number }>();
    if (canSeeAggregateReports) {
      for (const p of payments) {
        const cur = monthlyMap.get(p.billingMonth) ?? {
          month: p.billingMonth,
          collectedEgp: 0,
          outstandingEgp: 0,
        };
        if (p.status === 'paid') cur.collectedEgp += p.amountEgp;
        cur.outstandingEgp += p.outstandingBalanceEgp;
        monthlyMap.set(p.billingMonth, cur);
      }
    }

    res.json({
      subscriptions,
      payments,
      branchReports: branchTotals,
      monthlyReports: Array.from(monthlyMap.values()),
      onlinePaymentGatewayConnected: getSystemConfigStatus().onlinePaymentsConfigured,
    });
  });

  router.post('/finance/payments', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const schema = z.object({
      playerId: z.string().min(1),
      amountEgp: z.number().positive('المبلغ يجب أن يكون أكبر من صفر.'),
      outstandingBalanceEgp: z.number().min(0).default(0),
      billingMonth: z.string().regex(/^\d{4}-\d{2}$/, 'صيغة الشهر YYYY-MM'),
      paymentMethod: z.enum(['نقدي بالفرع', 'تحويل بنكي يدوي']).default('نقدي بالفرع'),
      status: z.enum(['paid', 'pending', 'overdue']),
      notes: z.string().max(300).default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'بيانات الدفعة غير صالحة.' });
      return;
    }
    const store = getStore();
    const player = store.players.find((p) => p.id === parsed.data.playerId);
    if (!player) {
      res.status(404).json({ error: 'اللاعب غير موجود.' });
      return;
    }
    if (!canManageFinance(user, player.branchId)) {
      res.status(403).json({ error: 'غير مصرح لك بتسجيل مدفوعات لهذا الفرع.' });
      return;
    }

    const sub = store.subscriptions.find((s) => s.playerId === player.id);
    const payment = {
      id: `pay_${Date.now()}`,
      subscriptionId: sub?.id,
      playerId: player.id,
      branchId: player.branchId,
      amountEgp: parsed.data.amountEgp,
      outstandingBalanceEgp: parsed.data.outstandingBalanceEgp,
      billingMonth: parsed.data.billingMonth,
      paymentMethod: parsed.data.paymentMethod,
      status: parsed.data.status,
      paidAt: parsed.data.status === 'paid' ? new Date().toISOString() : undefined,
      notes: parsed.data.notes,
    };
    store.payments.unshift(payment);

    if (sub && parsed.data.status === 'paid' && parsed.data.outstandingBalanceEgp === 0) {
      sub.status = 'active';
    }

    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'RECORD_PAYMENT',
      targetTable: 'payments',
      targetId: payment.id,
      branchId: player.branchId,
      details: { amountEgp: payment.amountEgp, status: payment.status },
    });

    res.status(201).json({ payment });
  });

  // ---------------------------------------------------------------------------
  // 6. XO COMMUNITY
  // ---------------------------------------------------------------------------
  router.get('/community', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const visiblePosts = store.posts
      .filter((p) => p.isApproved || user.role === 'OWNER' || p.authorId === user.id)
      .map((p) => {
        const likes = store.postLikes[p.id] ?? [];
        return {
          ...p,
          likesCount: likes.length + (p.id === 'post_1' ? 13 : p.id === 'post_2' ? 9 : 0),
          likedByMe: likes.includes(user.id),
        };
      });
    res.json({ posts: visiblePosts, announcements: store.announcements });
  });

  router.post('/community/posts', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    // Role-based posting: PLAYER cannot publish top-level academy posts without moderation; PARENT posts require approval unless OWNER/COACH/DELEGATE
    if (user.role === 'PLAYER') {
      res.status(403).json({ error: 'النشر المباشر متاح لأولياء الأمور والمدربين والإدارة فقط.' });
      return;
    }
    const schema = z.object({
      titleAr: z.string().trim().min(3, 'العنوان مطلوب.'),
      bodyAr: z.string().trim().min(5, 'محتوى المنشور قصير جداً.'),
      category: z.string().trim().min(2).default('عام'),
      branchId: z.enum(['branch_gamal', 'branch_khalil']).nullable().default(null),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message });
      return;
    }

    const store = getStore();
    const isStaff = user.role === 'OWNER' || user.role === 'DELEGATE' || user.role === 'COACH';
    const post = {
      id: `post_${Date.now()}`,
      authorId: user.id,
      authorName: user.fullName,
      authorRole: user.role,
      branchId: parsed.data.branchId,
      titleAr: parsed.data.titleAr,
      bodyAr: parsed.data.bodyAr,
      category: parsed.data.category,
      isApproved: isStaff,
      isPinned: false,
      likesCount: 0,
      likedByMe: false,
      comments: [],
      createdAt: new Date().toISOString(),
    };
    store.posts.unshift(post);
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'CREATE_COMMUNITY_POST',
      targetTable: 'community_posts',
      targetId: post.id,
      branchId: post.branchId,
    });
    res.status(201).json({ post });
  });

  router.post('/community/posts/:id/like', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const post = store.posts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'المنشور غير موجود.' });
      return;
    }
    const likes = store.postLikes[post.id] ?? [];
    const idx = likes.indexOf(user.id);
    if (idx >= 0) {
      likes.splice(idx, 1);
    } else {
      likes.push(user.id);
    }
    store.postLikes[post.id] = likes;
    res.json({ likedByMe: idx < 0 });
  });

  router.post('/community/posts/:id/comments', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const schema = z.object({ bodyAr: z.string().trim().min(1, 'التعليق لا يمكن أن يكون فارغاً.').max(500) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message });
      return;
    }
    const store = getStore();
    const post = store.posts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'المنشور غير موجود.' });
      return;
    }
    const comment = {
      id: `cmt_${Date.now()}`,
      postId: post.id,
      authorId: user.id,
      authorName: user.fullName,
      authorRole: user.role,
      bodyAr: parsed.data.bodyAr,
      createdAt: new Date().toISOString(),
    };
    post.comments.push(comment);
    res.status(201).json({ comment });
  });

  router.patch('/community/posts/:id/moderate', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const post = store.posts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'المنشور غير موجود.' });
      return;
    }
    const canModerate =
      user.role === 'OWNER' ||
      (user.role === 'DELEGATE' &&
        post.branchId !== null &&
        delegateHasPermission(user, post.branchId, 'manage_community'));
    if (!canModerate) {
      res.status(403).json({ error: 'غير مصرح لك بإدارة هذا المنشور.' });
      return;
    }
    const schema = z.object({
      isApproved: z.boolean().optional(),
      isPinned: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات الإشراف غير صالحة.' });
      return;
    }
    if (typeof parsed.data.isApproved === 'boolean') post.isApproved = parsed.data.isApproved;
    if (typeof parsed.data.isPinned === 'boolean') post.isPinned = parsed.data.isPinned;
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'MODERATE_COMMUNITY_POST',
      targetTable: 'community_posts',
      targetId: post.id,
      branchId: post.branchId,
    });
    res.json({ post });
  });

  // ---------------------------------------------------------------------------
  // 7. XO MEDIA (Private RBAC-protected storage & galleries)
  // ---------------------------------------------------------------------------
  router.get('/media', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const visible = store.media.filter((item) => canAccessMediaItem(user, item));
    res.json({ media: visible });
  });

  router.post('/media', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (user.role === 'PARENT' || user.role === 'PLAYER') {
      res.status(403).json({ error: 'رفع الوسائط متاح للإدارة والمدربين والمفوضين فقط.' });
      return;
    }
    const schema = z.object({
      titleAr: z.string().trim().min(3),
      albumAr: z.string().trim().min(2).default('تدريبات الأكاديمية'),
      kind: z.enum(['image', 'video']),
      visibility: z.enum(['academy', 'group', 'branch', 'private_player']),
      branchId: z.enum(['branch_gamal', 'branch_khalil']).nullable().default(null),
      groupId: z.string().nullable().default(null),
      playerId: z.string().nullable().default(null),
      dataUri: z.string().min(10),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات الوسائط غير صالحة.' });
      return;
    }

    if (user.role === 'DELEGATE') {
      if (!parsed.data.branchId || !delegateHasPermission(user, parsed.data.branchId, 'manage_media')) {
        res.status(403).json({ error: 'لا تملك صلاحية رفع الوسائط لهذا الفرع.' });
        return;
      }
    }
    if (user.role === 'COACH') {
      if (!parsed.data.groupId || !user.assignedGroupIds.includes(parsed.data.groupId)) {
        res.status(403).json({ error: 'يمكن للمدرب رفع الوسائط لمجموعاته المسندة فقط.' });
        return;
      }
    }

    const fileParsed = parseDataUriUpload(parsed.data.dataUri);
    if (!fileParsed) {
      res.status(400).json({ error: 'نوع الملف غير مدعوم أو الحجم يتجاوز 4 ميجابايت.' });
      return;
    }

    const ext = fileParsed.mimeType.split('/')[1] || 'bin';
    const fileId = `med_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const safeName = `${fileId}.${ext}`;
    const targetPath = path.resolve(UPLOAD_DIR, safeName);
    if (!targetPath.startsWith(UPLOAD_DIR + path.sep)) {
      res.status(400).json({ error: 'مسار الملف غير صالح.' });
      return;
    }
    fs.writeFileSync(targetPath, fileParsed.buffer);

    const store = getStore();
    store.uploadedFiles.set(fileId, {
      buffer: fileParsed.buffer,
      mimeType: fileParsed.mimeType,
      fileName: safeName,
    });

    const item = {
      id: fileId,
      titleAr: parsed.data.titleAr,
      albumAr: parsed.data.albumAr,
      kind: parsed.data.kind,
      visibility: parsed.data.visibility,
      branchId: parsed.data.branchId,
      groupId: parsed.data.groupId,
      playerId: parsed.data.playerId,
      fileUrl: `/api/media/file/${fileId}`,
      isPrivateAsset: true,
      uploadedByName: user.fullName,
      createdAt: new Date().toISOString(),
    };
    store.media.unshift(item);

    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'UPLOAD_MEDIA',
      targetTable: 'media',
      targetId: fileId,
      branchId: item.branchId,
      details: { visibility: item.visibility },
    });

    res.status(201).json({ mediaItem: item });
  });

  // Protected private media serving (requires auth + RBAC check)
  router.get('/media/file/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const item = store.media.find((m) => m.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'الملف غير موجود.' });
      return;
    }
    if (!canAccessMediaItem(user, item)) {
      res.status(403).json({ error: 'غير مصرح لك بعرض هذا الملف الخاص.' });
      return;
    }
    const fileEntry = store.uploadedFiles.get(item.id);
    if (!fileEntry) {
      res.status(404).json({ error: 'محتوى الملف غير موجود.' });
      return;
    }
    const targetPath = path.resolve(UPLOAD_DIR, fileEntry.fileName);
    if (!targetPath.startsWith(UPLOAD_DIR + path.sep)) {
      res.status(403).json({ error: 'وصول مرفوض.' });
      return;
    }
    res.setHeader('Content-Type', fileEntry.mimeType);
    res.setHeader('Cache-Control', 'no-store, private');
    res.send(fileEntry.buffer);
  });

  // ---------------------------------------------------------------------------
  // 8. XO EVENTS
  // ---------------------------------------------------------------------------
  router.get('/events', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const store = getStore();
    const visiblePlayerIds = new Set(
      store.players.filter((p) => canReadPlayer(user, p)).map((p) => p.id),
    );
    const events = store.events.map((ev) => ({
      ...ev,
      registrationsCount: ev.registrations.length,
      registrations: ev.registrations.filter(
        (r) =>
          user.role === 'OWNER' ||
          (user.role === 'DELEGATE' &&
            ev.branchId &&
            delegateHasPermission(user, ev.branchId, 'manage_events')) ||
          visiblePlayerIds.has(r.playerId),
      ),
    }));
    res.json({ events });
  });

  router.post('/events', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const schema = z.object({
      titleAr: z.string().trim().min(3),
      descriptionAr: z.string().trim().min(5),
      eventType: z.string().trim().min(2).default('بطولة'),
      branchId: z.enum(['branch_gamal', 'branch_khalil']).nullable(),
      sportId: z.string().nullable(),
      eventDate: z.string().min(8),
      locationAr: z.string().trim().min(3),
      maxParticipants: z.number().int().min(5).max(500),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات الفعالية غير صالحة.' });
      return;
    }
    const canCreate =
      user.role === 'OWNER' ||
      (user.role === 'DELEGATE' &&
        parsed.data.branchId !== null &&
        delegateHasPermission(user, parsed.data.branchId, 'manage_events'));
    if (!canCreate) {
      res.status(403).json({ error: 'غير مصرح لك بإنشاء فعاليات.' });
      return;
    }
    const store = getStore();
    const newEvent = {
      id: `evt_${Date.now()}`,
      ...parsed.data,
      resultsSummaryAr: 'التسجيل مفتوح.',
      status: 'upcoming' as const,
      imageUrl: '/src/assets/images/academy_trophy_event_1795470266547.jpg',
      registrations: [],
    };
    store.events.unshift(newEvent);
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'CREATE_EVENT',
      targetTable: 'events',
      targetId: newEvent.id,
      branchId: newEvent.branchId,
    });
    res.status(201).json({ event: newEvent });
  });

  router.post('/events/:id/register', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const schema = z.object({ playerId: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'معرف اللاعب مطلوب.' });
      return;
    }
    const store = getStore();
    const event = store.events.find((e) => e.id === req.params.id);
    if (!event) {
      res.status(404).json({ error: 'الفعالية غير موجودة.' });
      return;
    }
    const player = store.players.find((p) => p.id === parsed.data.playerId);
    if (!player) {
      res.status(404).json({ error: 'اللاعب غير موجود.' });
      return;
    }

    const allowed =
      user.role === 'OWNER' ||
      (user.role === 'DELEGATE' && delegateHasPermission(user, player.branchId, 'manage_events')) ||
      (user.role === 'PARENT' && parentOwnsPlayer(user, player.id)) ||
      (user.role === 'PLAYER' && user.linkedPlayerIds.includes(player.id));
    if (!allowed) {
      res.status(403).json({ error: 'لا يمكنك تسجيل لاعب غير تابع لحسابك.' });
      return;
    }
    if (event.registrations.some((r) => r.playerId === player.id)) {
      res.status(409).json({ error: 'اللاعب مسجل بالفعل في هذه الفعالية.' });
      return;
    }
    const registration = {
      id: `evr_${Date.now()}`,
      eventId: event.id,
      playerId: player.id,
      playerName: player.fullName,
      playerCode: player.playerCode,
      status: 'registered' as const,
      achievementAr: '',
    };
    event.registrations.push(registration);
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'REGISTER_PLAYER_FOR_EVENT',
      targetTable: 'event_registrations',
      targetId: registration.id,
      branchId: player.branchId,
      details: { eventId: event.id, playerId: player.id },
    });
    res.status(201).json({ registration });
  });

  // ---------------------------------------------------------------------------
  // 9. NOTIFICATIONS
  // ---------------------------------------------------------------------------
  router.get('/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    const store = getStore();
    res.json({
      notifications: store.notifications.filter((n) => n.userId === req.authUser!.id),
    });
  });

  router.patch('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
    const store = getStore();
    const item = store.notifications.find(
      (n) => n.id === req.params.id && n.userId === req.authUser!.id,
    );
    if (!item) {
      res.status(404).json({ error: 'الإشعار غير موجود.' });
      return;
    }
    item.isRead = true;
    res.json({ notification: item });
  });

  // ---------------------------------------------------------------------------
  // 10. XO CONTROL (Owner & Scoped Delegate Administration)
  // ---------------------------------------------------------------------------
  router.get('/control/overview', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'OWNER' && user.role !== 'DELEGATE') {
      res.status(403).json({ error: 'لوحة التحكم متاحة للمالك والمفوضين المخولين فقط.' });
      return;
    }
    const store = getStore();
    if (user.role === 'OWNER') {
      res.json({
        delegates: store.delegates,
        parents: store.parents,
        coaches: store.coaches,
        auditLogs: store.auditLogs,
        users: store.users.map(toPublicUserProfile),
      });
      return;
    }

    // DELEGATE: strictly isolated to assigned branches
    const branchPlayers = new Set(
      store.players
        .filter((p) => user.assignedBranchIds.includes(p.branchId))
        .map((p) => p.id),
    );
    res.json({
      delegates: store.delegates.filter((d) => d.userId === user.id),
      parents: store.parents.filter((pa) => pa.playerIds.some((id) => branchPlayers.has(id))),
      coaches: store.coaches.filter((c) => user.assignedBranchIds.includes(c.primaryBranchId)),
      auditLogs: [], // Audit logs restricted strictly to OWNER
      users: [],
    });
  });

  router.get('/control/audit-logs', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'OWNER') {
      res.status(403).json({ error: 'سجل التدقيق متاح لمالك الأكاديمية فقط.' });
      return;
    }
    res.json({ auditLogs: getStore().auditLogs });
  });

  router.put('/control/delegates/:id/permissions', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'OWNER') {
      res.status(403).json({ error: 'تعديل صلاحيات المفوضين متاح للمالك فقط.' });
      return;
    }
    const schema = z.object({
      assignedBranchIds: z.array(z.enum(['branch_gamal', 'branch_khalil'])),
      permissions: z.array(
        z.object({
          branchId: z.enum(['branch_gamal', 'branch_khalil']),
          permission: z.enum([
            'manage_players',
            'manage_attendance',
            'manage_payments',
            'manage_media',
            'manage_events',
            'manage_community',
            'view_reports',
          ]),
        }),
      ),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات الصلاحيات غير صالحة.' });
      return;
    }
    const store = getStore();
    const delegate = store.delegates.find((d) => d.id === req.params.id);
    if (!delegate) {
      res.status(404).json({ error: 'المفوض غير موجود.' });
      return;
    }
    delegate.assignedBranchIds = parsed.data.assignedBranchIds;
    delegate.permissions = parsed.data.permissions as Array<{
      branchId: string;
      permission: DelegatePermissionKey;
    }>;
    const delUser = store.users.find((u) => u.id === delegate.userId);
    if (delUser) {
      delUser.assignedBranchIds = [...parsed.data.assignedBranchIds];
      delUser.delegatePermissions = [...delegate.permissions];
    }

    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'UPDATE_DELEGATE_PERMISSIONS',
      targetTable: 'delegate_permissions',
      targetId: delegate.id,
      details: {
        assignedBranchIds: delegate.assignedBranchIds,
        permissionsCount: delegate.permissions.length,
      },
    });
    res.json({ delegate });
  });

  router.post('/control/announcements', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const schema = z.object({
      titleAr: z.string().trim().min(3),
      bodyAr: z.string().trim().min(5),
      branchId: z.enum(['branch_gamal', 'branch_khalil']).nullable(),
      priority: z.enum(['normal', 'important', 'urgent']).default('normal'),
      isPinned: z.boolean().default(false),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات الإعلان غير صالحة.' });
      return;
    }
    const allowed =
      user.role === 'OWNER' ||
      (user.role === 'DELEGATE' &&
        parsed.data.branchId !== null &&
        delegateHasPermission(user, parsed.data.branchId, 'manage_community'));
    if (!allowed) {
      res.status(403).json({ error: 'غير مصرح لك بنشر إعلانات لهذا الفرع.' });
      return;
    }
    const store = getStore();
    const announcement = {
      id: `ann_${Date.now()}`,
      ...parsed.data,
      authorName: user.fullName,
      createdAt: new Date().toISOString(),
    };
    store.announcements.unshift(announcement);
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'PUBLISH_ANNOUNCEMENT',
      targetTable: 'announcements',
      targetId: announcement.id,
      branchId: announcement.branchId,
    });
    res.status(201).json({ announcement });
  });

  router.post('/control/assign-role', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'OWNER') {
      res.status(403).json({ error: 'تغيير أدوار المستخدمين متاح لمالك الأكاديمية فقط.' });
      return;
    }
    const schema = z.object({
      userId: z.string().min(1),
      role: z.enum(['OWNER', 'DELEGATE', 'COACH', 'PARENT', 'PLAYER']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات الدور غير صالحة.' });
      return;
    }
    const store = getStore();
    const target = store.users.find((u) => u.id === parsed.data.userId);
    if (!target) {
      res.status(404).json({ error: 'المستخدم غير موجود.' });
      return;
    }
    target.role = parsed.data.role;
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'ASSIGN_USER_ROLE',
      targetTable: 'user_roles',
      targetId: target.id,
      details: { newRole: parsed.data.role },
    });
    res.json({ user: toPublicUserProfile(target) });
  });

  return router;
}
