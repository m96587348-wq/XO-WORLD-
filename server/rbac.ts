import type { NextFunction, Request, Response } from 'express';
import { verifySessionToken } from './auth';
import { getStore, type StoredUser } from './store';
import type {
  AppRole,
  DelegatePermissionKey,
  MediaItem,
  Player,
} from '../src/types/xo';

export interface AuthenticatedRequest extends Request {
  authUser?: StoredUser;
}

export function toPublicUserProfile(user: StoredUser) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    assignedBranchIds: user.assignedBranchIds,
    delegatePermissions: user.delegatePermissions,
    assignedGroupIds: user.assignedGroupIds,
    linkedPlayerIds: user.linkedPlayerIds,
  };
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'يجب تسجيل الدخول للوصول إلى هذا المورد.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'انتهت صلاحية الجلسة أو الرمز غير صالح.' });
    return;
  }
  const store = getStore();
  const user = store.users.find((u) => u.id === payload.sub && u.isActive);
  if (!user) {
    res.status(401).json({ error: 'الحساب غير موجود أو غير مفعل.' });
    return;
  }
  req.authUser = user;
  next();
}

export function delegateHasPermission(
  user: StoredUser,
  branchId: string,
  perm: DelegatePermissionKey,
): boolean {
  if (user.role !== 'DELEGATE') return false;
  if (!user.assignedBranchIds.includes(branchId)) return false;
  return user.delegatePermissions.some(
    (p) => p.branchId === branchId && p.permission === perm,
  );
}

export function coachTeachesGroup(user: StoredUser, groupId: string): boolean {
  if (user.role !== 'COACH') return false;
  return user.assignedGroupIds.includes(groupId);
}

export function parentOwnsPlayer(user: StoredUser, playerId: string): boolean {
  if (user.role !== 'PARENT') return false;
  const store = getStore();
  const parentRecord = store.parents.find((p) => p.userId === user.id);
  if (parentRecord) {
    return parentRecord.playerIds.includes(playerId);
  }
  return user.linkedPlayerIds.includes(playerId);
}

export function isSelfPlayer(user: StoredUser, playerId: string): boolean {
  if (user.role !== 'PLAYER') return false;
  const store = getStore();
  const player = store.players.find((p) => p.id === playerId);
  return Boolean(player && (player.userId === user.id || user.linkedPlayerIds.includes(playerId)));
}

export function canReadPlayer(user: StoredUser, player: Player): boolean {
  if (user.role === 'OWNER') return true;
  if (user.role === 'DELEGATE') {
    return (
      delegateHasPermission(user, player.branchId, 'manage_players') ||
      delegateHasPermission(user, player.branchId, 'manage_attendance') ||
      delegateHasPermission(user, player.branchId, 'manage_payments') ||
      delegateHasPermission(user, player.branchId, 'view_reports')
    );
  }
  if (user.role === 'COACH') {
    return coachTeachesGroup(user, player.groupId);
  }
  if (user.role === 'PARENT') {
    return parentOwnsPlayer(user, player.id);
  }
  if (user.role === 'PLAYER') {
    return isSelfPlayer(user, player.id);
  }
  return false;
}

export function canEditPlayerProfile(user: StoredUser, branchId: string): boolean {
  if (user.role === 'OWNER') return true;
  if (user.role === 'DELEGATE') {
    return delegateHasPermission(user, branchId, 'manage_players');
  }
  return false;
}

export function canUpdateCoachNotes(user: StoredUser, player: Player): boolean {
  if (user.role === 'OWNER') return true;
  if (user.role === 'DELEGATE') {
    return delegateHasPermission(user, player.branchId, 'manage_players');
  }
  if (user.role === 'COACH') {
    return coachTeachesGroup(user, player.groupId);
  }
  return false;
}

export function canManageAttendance(
  user: StoredUser,
  branchId: string,
  groupId: string,
): boolean {
  if (user.role === 'OWNER') return true;
  if (user.role === 'DELEGATE') {
    return delegateHasPermission(user, branchId, 'manage_attendance');
  }
  if (user.role === 'COACH') {
    return coachTeachesGroup(user, groupId);
  }
  return false;
}

export function canReadFinanceForPlayer(user: StoredUser, player: Player): boolean {
  if (user.role === 'OWNER') return true;
  if (user.role === 'DELEGATE') {
    return (
      delegateHasPermission(user, player.branchId, 'manage_payments') ||
      delegateHasPermission(user, player.branchId, 'view_reports')
    );
  }
  if (user.role === 'PARENT') {
    return parentOwnsPlayer(user, player.id);
  }
  if (user.role === 'PLAYER') {
    return isSelfPlayer(user, player.id);
  }
  // Coaches are strictly denied access to financial/payment records
  return false;
}

export function canManageFinance(user: StoredUser, branchId: string): boolean {
  if (user.role === 'OWNER') return true;
  if (user.role === 'DELEGATE') {
    return delegateHasPermission(user, branchId, 'manage_payments');
  }
  return false;
}

export function canAccessMediaItem(user: StoredUser, item: MediaItem): boolean {
  if (user.role === 'OWNER') return true;
  const store = getStore();
  if (item.visibility === 'academy') return true;
  if (item.visibility === 'branch' && item.branchId) {
    if (user.role === 'DELEGATE') {
      return user.assignedBranchIds.includes(item.branchId);
    }
    if (user.role === 'COACH') {
      return user.assignedBranchIds.includes(item.branchId);
    }
    if (user.role === 'PARENT') {
      return store.players.some(
        (pl) => parentOwnsPlayer(user, pl.id) && pl.branchId === item.branchId,
      );
    }
    if (user.role === 'PLAYER') {
      return store.players.some(
        (pl) => isSelfPlayer(user, pl.id) && pl.branchId === item.branchId,
      );
    }
  }
  if (item.visibility === 'group' && item.groupId) {
    if (user.role === 'DELEGATE' && item.branchId) {
      return delegateHasPermission(user, item.branchId, 'manage_media');
    }
    if (user.role === 'COACH') {
      return coachTeachesGroup(user, item.groupId);
    }
    if (user.role === 'PARENT') {
      return store.players.some(
        (pl) => parentOwnsPlayer(user, pl.id) && pl.groupId === item.groupId,
      );
    }
    if (user.role === 'PLAYER') {
      return store.players.some(
        (pl) => isSelfPlayer(user, pl.id) && pl.groupId === item.groupId,
      );
    }
  }
  if (item.visibility === 'private_player' && item.playerId) {
    const targetPlayer = store.players.find((p) => p.id === item.playerId);
    if (!targetPlayer) return false;
    if (user.role === 'PARENT') return parentOwnsPlayer(user, targetPlayer.id);
    if (user.role === 'PLAYER') return isSelfPlayer(user, targetPlayer.id);
    if (user.role === 'COACH') return coachTeachesGroup(user, targetPlayer.groupId);
    if (user.role === 'DELEGATE') {
      return delegateHasPermission(user, targetPlayer.branchId, 'manage_media');
    }
  }
  return false;
}

export function writeAuditLog(params: {
  actorUserId: string | null;
  actorName: string;
  actorRole: AppRole | null;
  action: string;
  targetTable: string;
  targetId: string | null;
  branchId?: string | null;
  details?: Record<string, unknown>;
}): void {
  const store = getStore();
  store.auditLogs.unshift({
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    actorUserId: params.actorUserId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: params.action,
    targetTable: params.targetTable,
    targetId: params.targetId,
    branchId: params.branchId ?? null,
    details: params.details ?? {},
    createdAt: new Date().toISOString(),
  });
}
