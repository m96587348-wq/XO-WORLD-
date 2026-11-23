import React, { useEffect, useState } from 'react';
import { Search, UserPlus, Award, CalendarCheck, CreditCard, Save, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  ATTENDANCE_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  formatArabicDate,
  formatCurrencyEgp,
} from '../lib/labels';
import { ProtectedImage } from '../components/ProtectedImage';
import { useToast } from '../components/ToastProvider';
import type {
  AttendanceRecord,
  Branch,
  PaymentRecord,
  Player,
  Sport,
  SubscriptionRecord,
  TrainingGroup,
  UserProfile,
} from '../types/xo';

interface EnrichedPlayer extends Player {
  attendanceHistory: AttendanceRecord[];
  subscription: SubscriptionRecord | null;
  payments: PaymentRecord[];
}

export const PlayersPage: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { showToast } = useToast();
  const [players, setPlayers] = useState<EnrichedPlayer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [groups, setGroups] = useState<TrainingGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [selected, setSelected] = useState<EnrichedPlayer | null>(null);

  // Coach Notes Editor
  const [noteText, setNoteText] = useState('');
  const [scoreValue, setScoreValue] = useState(75);
  const [levelValue, setLevelValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Add Player Modal
  const [showAdd, setShowAdd] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newBirthDate, setNewBirthDate] = useState('2015-01-01');
  const [newBranchId, setNewBranchId] = useState<'branch_gamal' | 'branch_khalil'>('branch_gamal');
  const [newSportId, setNewSportId] = useState('sport_parkour');
  const [newGroupId, setNewGroupId] = useState('grp_parkour_gamal');
  const [newMedical, setNewMedical] = useState('لا توجد ملاحظات طبية.');
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([
        apiFetch<{ players: EnrichedPlayer[] }>('/api/players'),
        apiFetch<{ branches: Branch[]; sports: Sport[]; groups: TrainingGroup[] }>('/api/academy'),
      ]);
      setPlayers(pRes.players);
      setBranches(aRes.branches);
      setSports(aRes.sports);
      setGroups(aRes.groups);
      if (pRes.players.length > 0) {
        const nextSel = selected
          ? pRes.players.find((p) => p.id === selected.id) ?? pRes.players[0]
          : pRes.players[0];
        setSelected(nextSel);
        setNoteText(nextSel.coachNotes);
        setScoreValue(nextSel.performanceScore);
        setLevelValue(nextSel.beltOrLevel);
      } else {
        setSelected(null);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تحميل بيانات اللاعبين.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  const selectPlayer = (p: EnrichedPlayer) => {
    setSelected(p);
    setNoteText(p.coachNotes);
    setScoreValue(p.performanceScore);
    setLevelValue(p.beltOrLevel);
  };

  const canCreatePlayer =
    user.role === 'OWNER' ||
    (user.role === 'DELEGATE' &&
      user.delegatePermissions.some((p) => p.permission === 'manage_players'));

  const canEditNotesForSelected =
    selected &&
    (user.role === 'OWNER' ||
      (user.role === 'COACH' && user.assignedGroupIds.includes(selected.groupId)) ||
      (user.role === 'DELEGATE' &&
        user.delegatePermissions.some(
          (p) => p.branchId === selected.branchId && p.permission === 'manage_players',
        )));

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSavingNotes(true);
    try {
      await apiFetch(`/api/players/${selected.id}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({
          coachNotes: noteText,
          performanceScore: Number(scoreValue),
          beltOrLevel: levelValue,
        }),
      });
      showToast('تم حفظ تقييم وملاحظات المدرب بنجاح.', 'success');
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر حفظ الملاحظات.', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch('/api/players', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newFullName,
          birthDate: newBirthDate,
          branchId: newBranchId,
          sportId: newSportId,
          groupId: newGroupId,
          medicalNotes: newMedical,
        }),
      });
      showToast('تم تسجيل اللاعب الجديد وإصدار رقم تعريفي له.', 'success');
      setShowAdd(false);
      setNewFullName('');
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر تسجيل اللاعب.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const branchMap = new Map(branches.map((b) => [b.id, b.nameAr]));
  const sportMap = new Map(sports.map((s) => [s.id, s.nameAr]));
  const groupMap = new Map(groups.map((g) => [g.id, g.nameAr]));

  const filtered = players.filter((p) => {
    if (branchFilter !== 'all' && p.branchId !== branchFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.playerCode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const availableGroupsForForm = groups.filter(
    (g) => g.branchId === newBranchId && g.sportId === newSportId,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-white">
            XO PLAYERS — ملفات اللاعبين
          </h2>
          <p className="text-sm text-[#94A3B8] mt-1">
            عرض معزول ومؤمن حسب صلاحية الحساب والفرع والمجموعة
          </p>
        </div>

        {canCreatePlayer && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10] transition-colors whitespace-nowrap min-h-[44px]"
          >
            <UserPlus className="w-4 h-4" />
            <span>تسجيل لاعب جديد</span>
          </button>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#94A3B8] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث باسم اللاعب أو الرقم التعريفي (XO-26-...)..."
            className="w-full rounded-xl bg-[#101827] border border-white/[0.1] pr-10 pl-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B1A] min-h-[44px]"
          />
        </div>

        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          aria-label="تصفية بالفرع"
          className="rounded-xl bg-[#101827] border border-white/[0.1] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B1A] min-h-[44px]"
        >
          <option value="all">كل الفروع المصرح بها</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nameAr}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="h-72 rounded-2xl bg-[#101827] border border-white/[0.08] animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-10 text-center space-y-2">
          <p className="text-white font-semibold">لا يوجد لاعبون مطابقون ضمن نطاق صلاحياتك</p>
          <p className="text-xs text-[#94A3B8]">
            إذا كنت ولي أمر أو لاعباً جديداً، تواصل مع إدارة الفرع لربط ملف اللاعب بحسابك.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Player List */}
          <div className="lg:col-span-5 rounded-2xl bg-[#101827] border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden">
            {filtered.map((p) => {
              const active = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPlayer(p)}
                  className={`w-full p-4 flex items-center gap-3.5 text-right transition-colors ${
                    active ? 'bg-[#FF6B1A]/10' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/[0.1]">
                    <ProtectedImage
                      src={p.photoUrl}
                      alt={p.fullName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-white truncate">
                        {p.fullName}
                      </span>
                      <span className="font-mono-num text-xs text-[#FF6B1A] shrink-0">
                        {p.playerCode}
                      </span>
                    </div>
                    <div className="text-xs text-[#94A3B8] truncate mt-1">
                      {sportMap.get(p.sportId)} · {branchMap.get(p.branchId)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Player Full Profile */}
          {selected && (
            <div className="lg:col-span-7 rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-5 border-b border-white/[0.06]">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/[0.12] shrink-0">
                  <ProtectedImage
                    src={selected.photoUrl}
                    alt={selected.fullName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
                    <span className="font-mono-num text-[#FF6B1A] font-semibold">
                      {selected.playerCode}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{sportMap.get(selected.sportId)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{branchMap.get(selected.branchId)}</span>
                  </div>
                  <h3 className="font-display text-xl font-extrabold text-white">
                    {selected.fullName}
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    المجموعة: {groupMap.get(selected.groupId) ?? 'غير محدد'} · ولي الأمر:{' '}
                    {selected.parentNames.join('، ')}
                  </p>
                </div>
              </div>

              {/* Performance & Medical Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl bg-[#080D18] border border-white/[0.06] p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                    <Award className="w-3.5 h-3.5 text-[#FF6B1A]" />
                    <span>مؤشر الأداء</span>
                  </div>
                  <div className="font-mono-num text-xl font-bold text-white tabular-nums">
                    {selected.performanceScore}%
                  </div>
                  <div className="text-xs text-[#94A3B8]">{selected.beltOrLevel}</div>
                </div>

                <div className="rounded-xl bg-[#080D18] border border-white/[0.06] p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                    <CalendarCheck className="w-3.5 h-3.5 text-[#FF6B1A]" />
                    <span>سجل الحضور</span>
                  </div>
                  <div className="font-mono-num text-xl font-bold text-white tabular-nums">
                    {selected.attendanceHistory.filter((a) => a.status === 'present').length} /{' '}
                    {selected.attendanceHistory.length}
                  </div>
                  <div className="text-xs text-[#94A3B8]">حصص حضور مسجلة</div>
                </div>

                <div className="rounded-xl bg-[#080D18] border border-white/[0.06] p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                    <CreditCard className="w-3.5 h-3.5 text-[#FF6B1A]" />
                    <span>حالة الاشتراك</span>
                  </div>
                  <div className="text-base font-bold text-white">
                    {user.role === 'COACH'
                      ? 'محجوب عن المدرب'
                      : selected.subscription
                        ? SUBSCRIPTION_STATUS_LABELS[selected.subscription.status]
                        : 'لا يوجد اشتراك'}
                  </div>
                  <div className="text-xs text-[#94A3B8] font-mono-num">
                    {user.role !== 'COACH' && selected.subscription
                      ? `ينتهي ${selected.subscription.endDate}`
                      : 'عزل الصلاحيات مفعل'}
                  </div>
                </div>
              </div>

              {/* Attendance History */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white">سجل الحضور الأخير</h4>
                {selected.attendanceHistory.length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">لم يتم تسجيل حصص حضور لهذا اللاعب بعد.</p>
                ) : (
                  <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                    {selected.attendanceHistory.map((att) => (
                      <div
                        key={att.id}
                        className="py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-mono-num text-white">{att.sessionDate}</span>
                          {att.note && <p className="text-[#94A3B8]">{att.note}</p>}
                        </div>
                        <span
                          className={`font-semibold ${
                            att.status === 'present'
                              ? 'text-emerald-400'
                              : att.status === 'excused'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                          }`}
                        >
                          {ATTENDANCE_LABELS[att.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payments History (Only if authorized — never shown to COACH) */}
              {user.role !== 'COACH' && selected.payments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-white">سجل المدفوعات</h4>
                  <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                    {selected.payments.map((pay) => (
                      <div
                        key={pay.id}
                        className="py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-mono-num text-white">{pay.billingMonth}</span>
                          <span className="text-[#94A3B8] mr-2">· {pay.paymentMethod}</span>
                        </div>
                        <div className="font-mono-num text-white">
                          {formatCurrencyEgp(pay.amountEgp)}
                          {pay.outstandingBalanceEgp > 0 && (
                            <span className="text-rose-400 mr-2">
                              (متبقي {formatCurrencyEgp(pay.outstandingBalanceEgp)})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coach Notes & Performance Evaluation */}
              <div className="pt-4 border-t border-white/[0.06] space-y-3">
                <h4 className="text-sm font-bold text-white">ملاحظات المدرب وتقييم الأداء</h4>
                {canEditNotesForSelected ? (
                  <form onSubmit={handleSaveNotes} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#94A3B8] mb-1">
                          تقييم الأداء (0 - 100)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={scoreValue}
                          onChange={(e) => setScoreValue(Number(e.target.value))}
                          className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2 text-sm text-white font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#94A3B8] mb-1">الحزام / المستوى</label>
                        <input
                          type="text"
                          value={levelValue}
                          onChange={(e) => setLevelValue(e.target.value)}
                          className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2 text-sm text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-[#94A3B8] mb-1">ملاحظات فنية</label>
                      <textarea
                        rows={3}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FF6B1A]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingNotes}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-xs font-semibold hover:bg-[#e85d10] min-h-[40px]"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingNotes ? 'جاري الحفظ...' : 'حفظ تقييم المدرب'}</span>
                    </button>
                  </form>
                ) : (
                  <div className="rounded-xl bg-[#080D18] border border-white/[0.06] p-4 text-sm text-[#CBD5E1] space-y-2">
                    <p>{selected.coachNotes || 'لا توجد ملاحظات مسجلة حتى الآن.'}</p>
                    <p className="text-xs text-[#94A3B8]">
                      ملاحظات طبية: {selected.medicalNotes} · تاريخ الميلاد:{' '}
                      <span className="font-mono-num">{formatArabicDate(selected.birthDate)}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Player Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#101827] border border-white/[0.1] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">تسجيل لاعب جديد</h3>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="p-2 text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePlayer} className="space-y-4">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">اسم اللاعب الكامل</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">تاريخ الميلاد</label>
                  <input
                    type="date"
                    required
                    value={newBirthDate}
                    onChange={(e) => setNewBirthDate(e.target.value)}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">الفرع</label>
                  <select
                    value={newBranchId}
                    onChange={(e) => {
                      const b = e.target.value as 'branch_gamal' | 'branch_khalil';
                      setNewBranchId(b);
                      const match = groups.find((g) => g.branchId === b && g.sportId === newSportId);
                      if (match) setNewGroupId(match.id);
                    }}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">الرياضة</label>
                  <select
                    value={newSportId}
                    onChange={(e) => {
                      const s = e.target.value;
                      setNewSportId(s);
                      const match = groups.find((g) => g.branchId === newBranchId && g.sportId === s);
                      if (match) setNewGroupId(match.id);
                    }}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                  >
                    {sports.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">المجموعة التدريبية</label>
                  <select
                    value={newGroupId}
                    onChange={(e) => setNewGroupId(e.target.value)}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                  >
                    {(availableGroupsForForm.length > 0 ? availableGroupsForForm : groups).map(
                      (g) => (
                        <option key={g.id} value={g.id}>
                          {g.nameAr}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">ملاحظات طبية</label>
                <input
                  type="text"
                  value={newMedical}
                  onChange={(e) => setNewMedical(e.target.value)}
                  className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-sm text-[#94A3B8]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10]"
                >
                  {creating ? 'جاري التسجيل...' : 'تأكيد التسجيل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
