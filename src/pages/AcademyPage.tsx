import React, { useEffect, useState } from 'react';
import { Building2, Clock, MapPin, Phone, Plus, Users, Dumbbell, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatCurrencyEgp } from '../lib/labels';
import { useToast } from '../components/ToastProvider';
import { ProtectedImage } from '../components/ProtectedImage';
import type { Branch, Coach, Sport, TrainingGroup, UserProfile } from '../types/xo';

interface GroupWithCount extends TrainingGroup {
  enrolledCount: number;
}

interface AcademyResponse {
  branches: Branch[];
  sports: Sport[];
  coaches: Coach[];
  groups: GroupWithCount[];
}

export const AcademyPage: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { showToast } = useToast();
  const [data, setData] = useState<AcademyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [sportFilter, setSportFilter] = useState<string>('all');

  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBranch, setNewBranch] = useState<'branch_gamal' | 'branch_khalil'>('branch_gamal');
  const [newSport, setNewSport] = useState('sport_parkour');
  const [newAgeRange, setNewAgeRange] = useState('8 - 14 سنة');
  const [newDays, setNewDays] = useState('الأحد · الثلاثاء · الخميس');
  const [newTime, setNewTime] = useState('06:00 م - 07:15 م');
  const [newCap, setNewCap] = useState(18);
  const [saving, setSaving] = useState(false);

  const loadAcademy = () => {
    setLoading(true);
    apiFetch<AcademyResponse>('/api/academy')
      .then(setData)
      .catch(() => showToast('تعذر تحميل بيانات الأكاديمية.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAcademy();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/academy/groups', {
        method: 'POST',
        body: JSON.stringify({
          nameAr: newName,
          branchId: newBranch,
          sportId: newSport,
          ageRange: newAgeRange,
          scheduleDays: newDays,
          scheduleTime: newTime,
          maxCapacity: Number(newCap),
          coachIds: [],
        }),
      });
      showToast('تمت إضافة المجموعة التدريبية بنجاح.', 'success');
      setShowAddGroup(false);
      setNewName('');
      loadAcademy();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر إضافة المجموعة.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-44 rounded-2xl bg-[#101827] border border-white/[0.08] animate-pulse" />
        <div className="h-64 rounded-2xl bg-[#101827] border border-white/[0.08] animate-pulse" />
      </div>
    );
  }

  const branchMap = new Map(data.branches.map((b) => [b.id, b.nameAr]));
  const sportMap = new Map(data.sports.map((s) => [s.id, s.nameAr]));
  const coachMap = new Map(data.coaches.map((c) => [c.id, c.fullName]));

  const filteredGroups = data.groups.filter((g) => {
    if (branchFilter !== 'all' && g.branchId !== branchFilter) return false;
    if (sportFilter !== 'all' && g.sportId !== sportFilter) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header & Branch Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-white">
            XO ACADEMY — الفروع والرياضات والمجموعات
          </h2>
          <p className="text-sm text-[#94A3B8] mt-1">
            فرعان رئيسيان في ميامي بالإسكندرية و 5 برامج رياضية معتمدة
          </p>
        </div>

        {user.role === 'OWNER' && (
          <button
            type="button"
            onClick={() => setShowAddGroup(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10] transition-colors whitespace-nowrap min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مجموعة تدريبية</span>
          </button>
        )}
      </div>

      {/* Strictly 2 Branches */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {data.branches.map((branch) => {
          const branchGroupsCount = data.groups.filter((g) => g.branchId === branch.id).length;
          return (
            <div
              key={branch.id}
              className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-[#FF6B1A]" />
                  <h3 className="font-display text-lg font-bold text-white">{branch.nameAr}</h3>
                </div>
                <span className="text-xs font-mono-num text-[#94A3B8]">
                  {branchGroupsCount} مجموعات
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{branch.addressAr}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#94A3B8] font-mono-num">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span dir="ltr">{branch.phone}</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* 5 Academy Sports */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Dumbbell className="w-5 h-5 text-[#FF6B1A]" />
          <h3 className="font-display text-lg font-bold text-white">الرياضات المعتمدة</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {data.sports.map((sport) => (
            <div
              key={sport.id}
              className="rounded-2xl bg-[#101827] border border-white/[0.08] overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-[#080D18]">
                <ProtectedImage
                  src={sport.imageUrl}
                  alt={sport.nameAr}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h4 className="font-display text-base font-bold text-white">{sport.nameAr}</h4>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    {sport.descriptionAr}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
                  <span className="text-[#94A3B8]">الاشتراك الشهري</span>
                  <span className="font-mono-num font-bold text-[#FF6B1A]">
                    {formatCurrencyEgp(sport.monthlyFeeEgp)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Training Groups & Schedules */}
      <section className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h3 className="font-display text-lg font-bold text-white">جداول المجموعات التدريبية</h3>

          <div className="flex flex-wrap items-center gap-3">
            {/* Branch segmented filter */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#080D18] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setBranchFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  branchFilter === 'all' ? 'bg-[#FF6B1A] text-white' : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                كل الفروع
              </button>
              {data.branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBranchFilter(b.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    branchFilter === b.id
                      ? 'bg-[#FF6B1A] text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {b.nameAr.replace('ميامي — ', '')}
                </button>
              ))}
            </div>

            <select
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
              aria-label="تصفية حسب الرياضة"
              className="rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF6B1A] min-h-[38px]"
            >
              <option value="all">جميع الرياضات</option>
              {data.sports.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameAr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredGroups.length === 0 ? (
          <p className="text-sm text-[#94A3B8] py-8 text-center">
            لا توجد مجموعات مطابقة للتصفية المحددة.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs text-[#94A3B8]">
                  <th className="py-3 px-3 font-medium">المجموعة</th>
                  <th className="py-3 px-3 font-medium">الفرع</th>
                  <th className="py-3 px-3 font-medium">الرياضة</th>
                  <th className="py-3 px-3 font-medium">الأيام والموعد</th>
                  <th className="py-3 px-3 font-medium">المدرب</th>
                  <th className="py-3 px-3 font-medium text-left">السعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredGroups.map((grp) => (
                  <tr key={grp.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-white">{grp.nameAr}</div>
                      <div className="text-xs text-[#94A3B8]">{grp.ageRange}</div>
                    </td>
                    <td className="py-3.5 px-3 text-xs text-[#CBD5E1]">
                      {branchMap.get(grp.branchId)}
                    </td>
                    <td className="py-3.5 px-3 text-xs text-[#FF6B1A] font-semibold">
                      {sportMap.get(grp.sportId)}
                    </td>
                    <td className="py-3.5 px-3 text-xs text-[#94A3B8]">
                      <div className="text-white">{grp.scheduleDays}</div>
                      <div className="flex items-center gap-1 mt-0.5 font-mono-num">
                        <Clock className="w-3 h-3" />
                        <span>{grp.scheduleTime}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-xs text-[#CBD5E1]">
                      {grp.coachIds.length > 0
                        ? grp.coachIds.map((id) => coachMap.get(id)).join('، ')
                        : 'قيد التعيين'}
                    </td>
                    <td className="py-3.5 px-3 text-left font-mono-num text-xs text-white tabular-nums">
                      {grp.enrolledCount} / {grp.maxCapacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Coaches Directory */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Users className="w-5 h-5 text-[#FF6B1A]" />
          <h3 className="font-display text-lg font-bold text-white">الجهاز الفني والمدربون</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.coaches.map((coach) => (
            <div
              key={coach.id}
              className="rounded-2xl bg-[#101827] border border-white/[0.08] p-5 space-y-2"
            >
              <div className="text-xs text-[#FF6B1A] font-semibold">
                {sportMap.get(coach.specialtySportId)} · {branchMap.get(coach.primaryBranchId)}
              </div>
              <h4 className="font-display text-base font-bold text-white">{coach.fullName}</h4>
              <p className="text-xs text-[#94A3B8] leading-relaxed">{coach.bioAr}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Add Group Modal (OWNER) */}
      {showAddGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#101827] border border-white/[0.1] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">إضافة مجموعة تدريبية</h3>
              <button
                type="button"
                onClick={() => setShowAddGroup(false)}
                className="p-2 text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">اسم المجموعة</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: أبطال التايكوندو — مستوى متقدم"
                  className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B1A]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">الفرع</label>
                  <select
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value as 'branch_gamal' | 'branch_khalil')}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                  >
                    {data.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">الرياضة</label>
                  <select
                    value={newSport}
                    onChange={(e) => setNewSport(e.target.value)}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                  >
                    {data.sports.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">الفئة العمرية</label>
                  <input
                    type="text"
                    required
                    value={newAgeRange}
                    onChange={(e) => setNewAgeRange(e.target.value)}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">السعة القصوى</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    required
                    value={newCap}
                    onChange={(e) => setNewCap(Number(e.target.value))}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white font-mono-num"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">أيام التدريب</label>
                  <input
                    type="text"
                    required
                    value={newDays}
                    onChange={(e) => setNewDays(e.target.value)}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">الموعد</label>
                  <input
                    type="text"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddGroup(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-sm text-[#94A3B8]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10]"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ المجموعة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
