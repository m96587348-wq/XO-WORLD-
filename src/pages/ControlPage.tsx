import React, { useEffect, useState } from 'react';
import {
  CalendarCheck,
  Wallet,
  Shield,
  FileText,
  Settings,
  Megaphone,
  Database,
  Check,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  ATTENDANCE_LABELS,
  PAYMENT_STATUS_LABELS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  formatArabicDate,
  formatCurrencyEgp,
} from '../lib/labels';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SupabaseSetupModal } from '../components/SupabaseSetupModal';
import { useToast } from '../components/ToastProvider';
import type {
  AppRole,
  AttendanceRecord,
  AttendanceStatus,
  AuditLog,
  Branch,
  DelegatePermissionKey,
  DelegateRecord,
  PaymentRecord,
  Player,
  SubscriptionRecord,
  SystemConfigStatus,
  TrainingGroup,
  UserProfile,
} from '../types/xo';

type ControlTab =
  | 'attendance'
  | 'finance'
  | 'delegates'
  | 'announcements'
  | 'audit'
  | 'settings';

interface FinanceResponse {
  subscriptions: SubscriptionRecord[];
  payments: PaymentRecord[];
  branchReports: Array<{
    branchId: string;
    branchName: string;
    collectedEgp: number;
    outstandingEgp: number;
    transactionsCount: number;
  }>;
  monthlyReports: Array<{
    month: string;
    collectedEgp: number;
    outstandingEgp: number;
  }>;
  onlinePaymentGatewayConnected: boolean;
}

interface ControlOverview {
  delegates: DelegateRecord[];
  auditLogs: AuditLog[];
  users: UserProfile[];
}

const ALL_PERMISSIONS: DelegatePermissionKey[] = [
  'manage_players',
  'manage_attendance',
  'manage_payments',
  'manage_media',
  'manage_events',
  'manage_community',
  'view_reports',
];

export const ControlPage: React.FC<{
  user: UserProfile;
  configStatus: SystemConfigStatus | null;
  onUserUpdated: (user: UserProfile) => void;
}> = ({ user, configStatus, onUserUpdated }) => {
  const { showToast } = useToast();

  const defaultTab: ControlTab =
    user.role === 'COACH'
      ? 'attendance'
      : user.role === 'PARENT' || user.role === 'PLAYER'
        ? 'finance'
        : 'attendance';

  const [tab, setTab] = useState<ControlTab>(defaultTab);
  const [setupOpen, setSetupOpen] = useState(false);

  // Shared datasets
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [finance, setFinance] = useState<FinanceResponse | null>(null);
  const [overview, setOverview] = useState<ControlOverview | null>(null);

  // Attendance marking state
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceDraft, setAttendanceDraft] = useState<
    Record<string, { status: AttendanceStatus; note: string }>
  >({});
  const [savingAtt, setSavingAtt] = useState(false);

  // Payment recording state
  const [payPlayerId, setPayPlayerId] = useState('');
  const [payAmount, setPayAmount] = useState(850);
  const [payOutstanding, setPayOutstanding] = useState(0);
  const [payMonth, setPayMonth] = useState('2026-11');
  const [payMethod, setPayMethod] = useState<'نقدي بالفرع' | 'تحويل بنكي يدوي'>('نقدي بالفرع');
  const [payStatus, setPayStatus] = useState<'paid' | 'pending' | 'overdue'>('paid');
  const [payNotes, setPayNotes] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  // Announcement state
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annBranch, setAnnBranch] = useState<string>('all');
  const [annPriority, setAnnPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [savingAnn, setSavingAnn] = useState(false);

  // Role assignment confirmation
  const [roleConfirm, setRoleConfirm] = useState<{ userId: string; newRole: AppRole } | null>(
    null,
  );

  // Personal Profile Editor
  const [profName, setProfName] = useState(user.fullName);
  const [profPhone, setProfPhone] = useState(user.phone);
  const [savingProfile, setSavingProfile] = useState(false);

  const loadAll = async () => {
    try {
      const [acadRes, plrRes, attRes] = await Promise.all([
        apiFetch<{ branches: Branch[]; groups: TrainingGroup[] }>('/api/academy'),
        apiFetch<{ players: Player[] }>('/api/players'),
        apiFetch<{ attendance: AttendanceRecord[] }>('/api/attendance'),
      ]);
      setBranches(acadRes.branches);
      setGroups(acadRes.groups);
      setPlayers(plrRes.players);
      setAttendance(attRes.attendance);

      const coachGroups =
        user.role === 'COACH'
          ? acadRes.groups.filter((g) => user.assignedGroupIds.includes(g.id))
          : user.role === 'DELEGATE'
            ? acadRes.groups.filter((g) => user.assignedBranchIds.includes(g.branchId))
            : acadRes.groups;
      if (coachGroups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(coachGroups[0].id);
      }
      if (plrRes.players.length > 0 && !payPlayerId) {
        setPayPlayerId(plrRes.players[0].id);
      }

      if (user.role !== 'COACH') {
        const finRes = await apiFetch<FinanceResponse>('/api/finance');
        setFinance(finRes);
      } else {
        setFinance(null);
      }

      if (user.role === 'OWNER' || user.role === 'DELEGATE') {
        const ctrlRes = await apiFetch<ControlOverview>('/api/control/overview');
        setOverview(ctrlRes);
      } else {
        setOverview(null);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تحميل بيانات الإدارة.', 'error');
    }
  };

  useEffect(() => {
    setProfName(user.fullName);
    setProfPhone(user.phone);
    setTab(defaultTab);
    loadAll();
  }, [user.id]);

  // Populate attendance draft when group changes
  useEffect(() => {
    const groupPlayers = players.filter((p) => p.groupId === selectedGroupId);
    const nextDraft: Record<string, { status: AttendanceStatus; note: string }> = {};
    for (const p of groupPlayers) {
      const existing = attendance.find(
        (a) =>
          a.playerId === p.id &&
          a.groupId === selectedGroupId &&
          a.sessionDate === sessionDate,
      );
      nextDraft[p.id] = {
        status: existing?.status ?? 'present',
        note: existing?.note ?? '',
      };
    }
    setAttendanceDraft(nextDraft);
  }, [selectedGroupId, sessionDate, players, attendance]);

  const handleSaveAttendance = async () => {
    const groupPlayers = players.filter((p) => p.groupId === selectedGroupId);
    if (groupPlayers.length === 0) {
      showToast('لا يوجد لاعبون في هذه المجموعة.', 'info');
      return;
    }
    setSavingAtt(true);
    try {
      await apiFetch('/api/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({
          groupId: selectedGroupId,
          sessionDate,
          entries: groupPlayers.map((p) => ({
            playerId: p.id,
            status: attendanceDraft[p.id]?.status ?? 'present',
            note: attendanceDraft[p.id]?.note ?? '',
          })),
        }),
      });
      showToast('تم حفظ الحضور اليومي للمجموعة بنجاح.', 'success');
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'غير مصرح بتسجيل الحضور.', 'error');
    } finally {
      setSavingAtt(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPay(true);
    try {
      await apiFetch('/api/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          playerId: payPlayerId,
          amountEgp: Number(payAmount),
          outstandingBalanceEgp: Number(payOutstanding),
          billingMonth: payMonth,
          paymentMethod: payMethod,
          status: payStatus,
          notes: payNotes,
        }),
      });
      showToast('تم تسجيل السجل المالي بنجاح.', 'success');
      setPayNotes('');
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تسجيل الدفعة.', 'error');
    } finally {
      setSavingPay(false);
    }
  };

  const handleToggleDelegatePerm = async (
    delegate: DelegateRecord,
    branchId: string,
    permission: DelegatePermissionKey,
  ) => {
    const exists = delegate.permissions.some(
      (p) => p.branchId === branchId && p.permission === permission,
    );
    const nextPermissions = exists
      ? delegate.permissions.filter(
          (p) => !(p.branchId === branchId && p.permission === permission),
        )
      : [...delegate.permissions, { branchId, permission }];

    const nextBranches = Array.from(new Set(nextPermissions.map((p) => p.branchId)));

    try {
      await apiFetch(`/api/control/delegates/${delegate.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({
          assignedBranchIds: nextBranches,
          permissions: nextPermissions,
        }),
      });
      showToast('تم تحديث مصفوفة صلاحيات المفوض.', 'success');
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تحديث الصلاحيات.', 'error');
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAnn(true);
    try {
      await apiFetch('/api/control/announcements', {
        method: 'POST',
        body: JSON.stringify({
          titleAr: annTitle,
          bodyAr: annBody,
          branchId: annBranch === 'all' ? null : annBranch,
          priority: annPriority,
          isPinned: annPriority !== 'normal',
        }),
      });
      showToast('تم نشر الإعلان الرسمي.', 'success');
      setAnnTitle('');
      setAnnBody('');
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر نشر الإعلان.', 'error');
    } finally {
      setSavingAnn(false);
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!roleConfirm) return;
    try {
      await apiFetch('/api/control/assign-role', {
        method: 'POST',
        body: JSON.stringify({
          userId: roleConfirm.userId,
          role: roleConfirm.newRole,
        }),
      });
      showToast('تم تحديث دور المستخدم وتسجيل العملية في سجل التدقيق.', 'success');
      setRoleConfirm(null);
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تغيير الدور.', 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await apiFetch<{ user: UserProfile }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName: profName, phone: profPhone }),
      });
      onUserUpdated(res.user);
      showToast('تم تحديث بيانات الحساب الشخصي.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر حفظ التعديلات.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const canMarkAttendance =
    user.role === 'OWNER' ||
    user.role === 'COACH' ||
    (user.role === 'DELEGATE' &&
      user.delegatePermissions.some((p) => p.permission === 'manage_attendance'));

  const canManagePayments =
    user.role === 'OWNER' ||
    (user.role === 'DELEGATE' &&
      user.delegatePermissions.some((p) => p.permission === 'manage_payments'));

  const availableTabs: Array<{ id: ControlTab; label: string; icon: React.ReactNode }> = [];
  if (canMarkAttendance) {
    availableTabs.push({
      id: 'attendance',
      label: 'الحضور اليومي',
      icon: <CalendarCheck className="w-4 h-4" />,
    });
  }
  if (user.role !== 'COACH') {
    availableTabs.push({
      id: 'finance',
      label: 'الاشتراكات والمالية',
      icon: <Wallet className="w-4 h-4" />,
    });
  }
  if (user.role === 'OWNER') {
    availableTabs.push({
      id: 'delegates',
      label: 'المفوضون والصلاحيات',
      icon: <Shield className="w-4 h-4" />,
    });
  }
  if (
    user.role === 'OWNER' ||
    (user.role === 'DELEGATE' &&
      user.delegatePermissions.some((p) => p.permission === 'manage_community'))
  ) {
    availableTabs.push({
      id: 'announcements',
      label: 'الإعلانات والأدوار',
      icon: <Megaphone className="w-4 h-4" />,
    });
  }
  if (user.role === 'OWNER') {
    availableTabs.push({
      id: 'audit',
      label: 'سجل التدقيق',
      icon: <FileText className="w-4 h-4" />,
    });
  }
  availableTabs.push({
    id: 'settings',
    label: 'الحساب و Supabase',
    icon: <Settings className="w-4 h-4" />,
  });

  const scopedGroups =
    user.role === 'COACH'
      ? groups.filter((g) => user.assignedGroupIds.includes(g.id))
      : user.role === 'DELEGATE'
        ? groups.filter((g) => user.assignedBranchIds.includes(g.branchId))
        : groups;

  const groupPlayers = players.filter((p) => p.groupId === selectedGroupId);
  const playerMap = new Map(players.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-white">
            XO CONTROL — مركز الإدارة والحوكمة
          </h2>
          <p className="text-sm text-[#94A3B8] mt-1">
            التحكم التشغيلي، الحضور اليومي، المالية، صلاحيات الفروع، وربط Supabase
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSetupOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#101827] border border-white/[0.1] text-xs font-semibold text-white hover:border-[#FF6B1A] min-h-[44px] w-fit"
        >
          <Database className="w-4 h-4 text-[#FF6B1A]" />
          <span>حالة Supabase والتصدير</span>
        </button>
      </div>

      {/* Segmented Control Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-[#101827] border border-white/[0.08]">
        {availableTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap min-h-[40px] ${
              tab === t.id ? 'bg-[#FF6B1A] text-white' : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: DAILY ATTENDANCE */}
      {tab === 'attendance' && canMarkAttendance && (
        <section className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">المجموعة التدريبية</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                >
                  {scopedGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">تاريخ الحصة</label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white font-mono-num"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={savingAtt}
              onClick={handleSaveAttendance}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10] min-h-[44px] whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              <span>{savingAtt ? 'جاري الحفظ...' : 'اعتماد حضور المجموعة'}</span>
            </button>
          </div>

          {groupPlayers.length === 0 ? (
            <p className="text-sm text-[#94A3B8] py-6 text-center">
              لا يوجد لاعبون مسجلون في هذه المجموعة حالياً.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
              {groupPlayers.map((p) => {
                const draft = attendanceDraft[p.id] ?? { status: 'present', note: '' };
                return (
                  <div
                    key={p.id}
                    className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{p.fullName}</div>
                      <div className="text-xs text-[#94A3B8] font-mono-num">{p.playerCode}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#080D18] border border-white/[0.06]">
                        {(['present', 'absent', 'excused'] as AttendanceStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              setAttendanceDraft((prev) => ({
                                ...prev,
                                [p.id]: { ...draft, status: st },
                              }))
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              draft.status === st
                                ? st === 'present'
                                  ? 'bg-emerald-600 text-white'
                                  : st === 'excused'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-rose-600 text-white'
                                : 'text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            {ATTENDANCE_LABELS[st]}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={draft.note}
                        onChange={(e) =>
                          setAttendanceDraft((prev) => ({
                            ...prev,
                            [p.id]: { ...draft, note: e.target.value },
                          }))
                        }
                        placeholder="ملاحظة الحصة (اختياري)..."
                        className="rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2 text-xs text-white min-w-[200px]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: FINANCE & SUBSCRIPTIONS */}
      {tab === 'finance' && finance && (
        <div className="space-y-6">
          {!finance.onlinePaymentGatewayConnected && (
            <div className="rounded-2xl bg-[#101827] border border-amber-500/30 p-4 flex items-start gap-3 text-xs text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                تنبيه مالي: بوابة الدفع الإلكتروني غير مفعلة حالياً؛ جميع المعاملات المسجلة هنا توثق التحصيل النقدي بالفرع أو التحويلات اليدوية المراجعة فقط.
              </span>
            </div>
          )}

          {/* Branch & Monthly Reports (Owner / Permitted Delegate) */}
          {finance.branchReports.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {finance.branchReports.map((rep) => (
                <div
                  key={rep.branchId}
                  className="rounded-2xl bg-[#101827] border border-white/[0.08] p-5 space-y-3"
                >
                  <div className="text-sm font-bold text-white">{rep.branchName}</div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/[0.06]">
                    <div>
                      <div className="text-xs text-[#94A3B8]">المحصل</div>
                      <div className="font-mono-num text-lg font-bold text-emerald-400 tabular-nums">
                        {formatCurrencyEgp(rep.collectedEgp)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[#94A3B8]">أرصدة متبقية</div>
                      <div className="font-mono-num text-lg font-bold text-rose-400 tabular-nums">
                        {formatCurrencyEgp(rep.outstandingEgp)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Record Payment Form */}
          {canManagePayments && players.length > 0 && (
            <form
              onSubmit={handleRecordPayment}
              className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4"
            >
              <h3 className="font-display text-base font-bold text-white">تسجيل دفعة اشتراك</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">اللاعب</label>
                  <select
                    value={payPlayerId}
                    onChange={(e) => setPayPlayerId(e.target.value)}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-xs text-white"
                  >
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} ({p.playerCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">المبلغ (ج.م)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-xs text-white font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">المتبقي (ج.م)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={payOutstanding}
                    onChange={(e) => setPayOutstanding(Number(e.target.value))}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-xs text-white font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">الشهر (YYYY-MM)</label>
                  <input
                    type="text"
                    required
                    pattern="\d{4}-\d{2}"
                    value={payMonth}
                    onChange={(e) => setPayMonth(e.target.value)}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-xs text-white font-mono-num"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={payMethod}
                  onChange={(e) =>
                    setPayMethod(e.target.value as 'نقدي بالفرع' | 'تحويل بنكي يدوي')
                  }
                  className="rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-xs text-white"
                >
                  <option value="نقدي بالفرع">نقدي بالفرع</option>
                  <option value="تحويل بنكي يدوي">تحويل بنكي يدوي</option>
                </select>
                <select
                  value={payStatus}
                  onChange={(e) => setPayStatus(e.target.value as 'paid' | 'pending' | 'overdue')}
                  className="rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-xs text-white"
                >
                  <option value="paid">مدفوع</option>
                  <option value="pending">قيد التحصيل</option>
                  <option value="overdue">متأخر</option>
                </select>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="ملاحظات الإيصال..."
                  className="rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={savingPay}
                className="px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-xs font-semibold hover:bg-[#e85d10] min-h-[40px]"
              >
                {savingPay ? 'جاري الحفظ...' : 'تسجيل الدفعة'}
              </button>
            </form>
          )}

          {/* Payments Table */}
          <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-white">
              سجل الاشتراكات والمدفوعات
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[#94A3B8]">
                    <th className="py-2.5 px-3">اللاعب</th>
                    <th className="py-2.5 px-3">الشهر</th>
                    <th className="py-2.5 px-3">الطريقة</th>
                    <th className="py-2.5 px-3">الحالة</th>
                    <th className="py-2.5 px-3 text-left">المبلغ / المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {finance.payments.map((pay) => {
                    const plr = playerMap.get(pay.playerId);
                    return (
                      <tr key={pay.id}>
                        <td className="py-3 px-3 text-white font-medium">
                          {plr?.fullName ?? pay.playerId}
                        </td>
                        <td className="py-3 px-3 font-mono-num text-[#94A3B8]">
                          {pay.billingMonth}
                        </td>
                        <td className="py-3 px-3 text-[#CBD5E1]">{pay.paymentMethod}</td>
                        <td className="py-3 px-3 font-semibold">
                          <span
                            className={
                              pay.status === 'paid'
                                ? 'text-emerald-400'
                                : pay.status === 'pending'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                            }
                          >
                            {PAYMENT_STATUS_LABELS[pay.status]}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-left font-mono-num text-white tabular-nums">
                          {formatCurrencyEgp(pay.amountEgp)}
                          {pay.outstandingBalanceEgp > 0 && (
                            <span className="text-rose-400 mr-2">
                              (متبقي {formatCurrencyEgp(pay.outstandingBalanceEgp)})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {finance.subscriptions.length > 0 && (
              <div className="pt-4 border-t border-white/[0.06] space-y-2">
                <h4 className="text-xs font-bold text-white">حالة الاشتراكات الجارية</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {finance.subscriptions.map((sub) => {
                    const plr = playerMap.get(sub.playerId);
                    return (
                      <div
                        key={sub.id}
                        className="rounded-xl bg-[#080D18] border border-white/[0.06] p-3 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="text-white font-semibold">{plr?.fullName}</div>
                          <div className="text-[#94A3B8]">
                            {sub.planNameAr} · ينتهي {sub.endDate}
                          </div>
                        </div>
                        <span
                          className={`font-semibold ${
                            sub.status === 'active'
                              ? 'text-emerald-400'
                              : sub.status === 'expiring_soon'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                          }`}
                        >
                          {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DELEGATE PERMISSIONS MATRIX (OWNER ONLY) */}
      {tab === 'delegates' && user.role === 'OWNER' && overview && (
        <section className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-6">
          <div>
            <h3 className="font-display text-lg font-bold text-white">
              مصفوفة صلاحيات المفوضين حسب الفرع
            </h3>
            <p className="text-xs text-[#94A3B8] mt-1">
              أي تعديل يُطبق فوراً على الخادم وقاعدة البيانات مع حظر أي فرع غير ممنوح
            </p>
          </div>

          {overview.delegates.map((del) => (
            <div key={del.id} className="space-y-4 pt-4 border-t border-white/[0.06] first:border-0 first:pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-white">{del.fullName}</div>
                  <div className="text-xs text-[#94A3B8]" dir="ltr">
                    {del.email}
                  </div>
                </div>
                <span className="text-xs text-[#FF6B1A] font-semibold">
                  الفروع المفعلة: {del.assignedBranchIds.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="rounded-xl bg-[#080D18] border border-white/[0.06] p-4 space-y-3"
                  >
                    <div className="text-sm font-bold text-white">{branch.nameAr}</div>
                    <div className="space-y-2">
                      {ALL_PERMISSIONS.map((perm) => {
                        const checked = del.permissions.some(
                          (p) => p.branchId === branch.id && p.permission === perm,
                        );
                        return (
                          <label
                            key={perm}
                            className="flex items-center justify-between gap-2 text-xs text-[#CBD5E1] cursor-pointer py-1"
                          >
                            <span>{PERMISSION_LABELS[perm]}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleDelegatePerm(del, branch.id, perm)}
                              className="w-4 h-4 accent-[#FF6B1A] rounded"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* TAB 4: ANNOUNCEMENTS & ROLE ASSIGNMENT */}
      {tab === 'announcements' && (
        <div className="space-y-6">
          <form
            onSubmit={handlePublishAnnouncement}
            className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4"
          >
            <h3 className="font-display text-base font-bold text-white">نشر إعلان رسمي</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                minLength={3}
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="عنوان الإعلان..."
                className="sm:col-span-2 rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
              />
              <select
                value={annPriority}
                onChange={(e) =>
                  setAnnPriority(e.target.value as 'normal' | 'important' | 'urgent')
                }
                className="rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
              >
                <option value="normal">أولوية عادية</option>
                <option value="important">هام</option>
                <option value="urgent">عاجل</option>
              </select>
            </div>
            <textarea
              rows={3}
              required
              minLength={5}
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="تفاصيل الإعلان..."
              className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <select
                value={annBranch}
                onChange={(e) => setAnnBranch(e.target.value)}
                className="rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2 text-xs text-white"
              >
                {user.role === 'OWNER' && <option value="all">جميع فروع الأكاديمية</option>}
                {branches
                  .filter(
                    (b) => user.role === 'OWNER' || user.assignedBranchIds.includes(b.id),
                  )
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nameAr}
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                disabled={savingAnn}
                className="px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-xs font-semibold hover:bg-[#e85d10] min-h-[40px]"
              >
                {savingAnn ? 'جاري النشر...' : 'نشر الإعلان'}
              </button>
            </div>
          </form>

          {user.role === 'OWNER' && overview && (
            <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-white">
                إدارة أدوار الحسابات (للمالك فقط)
              </h3>
              <div className="divide-y divide-white/[0.06]">
                {overview.users.map((u) => (
                  <div
                    key={u.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="text-white font-semibold text-sm">{u.fullName}</div>
                      <div className="text-[#94A3B8]" dir="ltr">
                        {u.email}
                      </div>
                    </div>
                    <select
                      value={u.role}
                      disabled={u.id === user.id}
                      onChange={(e) =>
                        setRoleConfirm({ userId: u.id, newRole: e.target.value as AppRole })
                      }
                      className="rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2 text-xs text-white disabled:opacity-50"
                    >
                      {(['OWNER', 'DELEGATE', 'COACH', 'PARENT', 'PLAYER'] as AppRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AUDIT LOGS (OWNER ONLY) */}
      {tab === 'audit' && user.role === 'OWNER' && overview && (
        <section className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4">
          <h3 className="font-display text-lg font-bold text-white">سجل التدقيق الأمني والعمليات</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-[#94A3B8]">
                  <th className="py-2.5 px-3">التاريخ</th>
                  <th className="py-2.5 px-3">المنفذ</th>
                  <th className="py-2.5 px-3">الدور</th>
                  <th className="py-2.5 px-3">الإجراء</th>
                  <th className="py-2.5 px-3">الجدول المستهدف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {overview.auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 px-3 font-mono-num text-[#94A3B8]">
                      {formatArabicDate(log.createdAt)}
                    </td>
                    <td className="py-3 px-3 text-white">{log.actorName}</td>
                    <td className="py-3 px-3 text-[#FF6B1A]">
                      {log.actorRole ? ROLE_LABELS[log.actorRole] : 'غير مسجل'}
                    </td>
                    <td className="py-3 px-3 font-mono-num text-[#CBD5E1]">{log.action}</td>
                    <td className="py-3 px-3 font-mono-num text-[#94A3B8]">{log.targetTable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 6: ACCOUNT & SUPABASE SETTINGS */}
      {tab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4"
          >
            <h3 className="font-display text-base font-bold text-white">إدارة الحساب الشخصي</h3>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">الاسم الكامل</label>
              <input
                type="text"
                required
                minLength={3}
                value={profName}
                onChange={(e) => setProfName(e.target.value)}
                className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">رقم الهاتف</label>
              <input
                type="tel"
                required
                minLength={8}
                value={profPhone}
                onChange={(e) => setProfPhone(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white text-left"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                disabled
                value={user.email}
                dir="ltr"
                className="w-full rounded-xl bg-[#080D18]/50 border border-white/[0.06] px-3 py-2.5 text-sm text-[#94A3B8] text-left"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-xs font-semibold hover:bg-[#e85d10] min-h-[40px]"
            >
              {savingProfile ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </form>

          <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-white">
              حالة البنية التحتية والتصدير
            </h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              تعمل المنصة حالياً بـ{' '}
              <span className="text-white font-semibold">
                {configStatus?.isSupabaseConnected
                  ? 'اتصال Supabase الفعلي'
                  : 'خادم المعاينة المحلية المحمي بصلاحيات الدور (بيانات وهمية)'}
              </span>
              . اضغط الزر أدناه لمراجعة متغيرات البيئة الناقصة، ملفات الهجرة SQL، وإرشادات تصدير ZIP و GitHub.
            </p>
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#080D18] border border-[#FF6B1A]/50 text-white text-xs font-semibold hover:bg-[#FF6B1A] transition-colors min-h-[40px]"
            >
              فتح دليل إعداد Supabase والتصدير
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(roleConfirm)}
        title="تأكيد تغيير صلاحية المستخدم"
        description={`هل أنت متأكد من تغيير دور هذا المستخدم إلى «${
          roleConfirm ? ROLE_LABELS[roleConfirm.newRole] : ''
        }»؟ سيتم تسجيل التغيير في سجل التدقيق الأمني.`}
        onConfirm={handleConfirmRoleChange}
        onCancel={() => setRoleConfirm(null)}
      />

      <SupabaseSetupModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        status={configStatus}
      />
    </div>
  );
};
