import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, Plus, Trophy, Users, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatArabicDate } from '../lib/labels';
import { ProtectedImage } from '../components/ProtectedImage';
import { useToast } from '../components/ToastProvider';
import type { AcademyEvent, Player, UserProfile } from '../types/xo';

interface EventWithCount extends AcademyEvent {
  registrationsCount: number;
}

export const EventsPage: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { showToast } = useToast();
  const [events, setEvents] = useState<EventWithCount[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  // Registration modal
  const [regEvent, setRegEvent] = useState<EventWithCount | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [registering, setRegistering] = useState(false);

  // Create event modal
  const [showCreate, setShowCreate] = useState(false);
  const [titleAr, setTitleAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [eventDate, setEventDate] = useState('2026-12-20');
  const [locationAr, setLocationAr] = useState('فرع ميامي — جمال عبد الناصر');
  const [branchId, setBranchId] = useState<'branch_gamal' | 'branch_khalil'>('branch_gamal');
  const [maxParticipants, setMaxParticipants] = useState(40);
  const [creating, setCreating] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const [evRes, pRes] = await Promise.all([
        apiFetch<{ events: EventWithCount[] }>('/api/events'),
        apiFetch<{ players: Player[] }>('/api/players'),
      ]);
      setEvents(evRes.events);
      setPlayers(pRes.players);
      if (pRes.players.length > 0 && !selectedPlayerId) {
        setSelectedPlayerId(pRes.players[0].id);
      }
    } catch {
      showToast('تعذر تحميل الفعاليات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [user.id]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEvent || !selectedPlayerId) return;
    setRegistering(true);
    try {
      await apiFetch(`/api/events/${regEvent.id}/register`, {
        method: 'POST',
        body: JSON.stringify({ playerId: selectedPlayerId }),
      });
      showToast('تم تسجيل اللاعب في الفعالية بنجاح.', 'success');
      setRegEvent(null);
      loadEvents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر التسجيل.', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          titleAr,
          descriptionAr,
          eventType: 'بطولة',
          branchId,
          sportId: null,
          eventDate: `${eventDate}T16:00:00Z`,
          locationAr,
          maxParticipants: Number(maxParticipants),
        }),
      });
      showToast('تم نشر الفعالية بنجاح.', 'success');
      setShowCreate(false);
      setTitleAr('');
      setDescriptionAr('');
      loadEvents();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'تعذر إنشاء الفعالية.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const canCreate =
    user.role === 'OWNER' ||
    (user.role === 'DELEGATE' &&
      user.delegatePermissions.some((p) => p.permission === 'manage_events'));

  const canRegisterAny = user.role !== 'COACH' && players.length > 0;

  const filtered = events.filter((ev) => statusFilter === 'all' || ev.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-white">
            XO EVENTS — البطولات والفعاليات
          </h2>
          <p className="text-sm text-[#94A3B8] mt-1">
            متابعة البطولات الرسمية، التسجيل، وقوائم المشاركين والنتائج
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10] min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة فعالية</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[#101827] border border-white/[0.08] w-fit">
        {[
          { id: 'all', label: 'الكل' },
          { id: 'upcoming', label: 'القادمة' },
          { id: 'completed', label: 'المكتملة' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id as 'all' | 'upcoming' | 'completed')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === tab.id ? 'bg-[#FF6B1A] text-white' : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 rounded-2xl bg-[#101827] border border-white/[0.08] animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((ev) => (
            <article
              key={ev.id}
              className="rounded-2xl bg-[#101827] border border-white/[0.08] overflow-hidden flex flex-col"
            >
              <div className="aspect-[16/9] bg-[#080D18] relative overflow-hidden">
                <ProtectedImage
                  src={ev.imageUrl}
                  alt={ev.titleAr}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#101827] via-transparent to-transparent" />
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
                    <span className="text-[#FF6B1A] font-semibold">{ev.eventType}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ev.status === 'upcoming' ? 'قادمة' : 'منتهية'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">{formatArabicDate(ev.eventDate)}</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">{ev.titleAr}</h3>
                  <p className="text-sm text-[#94A3B8] leading-relaxed">{ev.descriptionAr}</p>
                </div>

                <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#CBD5E1]">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#FF6B1A]" />
                      <span>{ev.locationAr}</span>
                    </span>
                    <span className="flex items-center gap-1.5 font-mono-num">
                      <Users className="w-3.5 h-3.5 text-[#FF6B1A]" />
                      <span>
                        {ev.registrationsCount} / {ev.maxParticipants} مشارك
                      </span>
                    </span>
                  </div>

                  {ev.resultsSummaryAr && (
                    <div className="flex items-start gap-2 text-xs text-[#94A3B8]">
                      <Trophy className="w-4 h-4 text-[#FF6B1A] shrink-0 mt-0.5" />
                      <span>{ev.resultsSummaryAr}</span>
                    </div>
                  )}

                  {ev.registrations.length > 0 && (
                    <div className="pt-2 border-t border-white/[0.06] space-y-1">
                      <div className="text-xs font-semibold text-white">المشاركون المصرح بعرضهم:</div>
                      {ev.registrations.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between text-xs text-[#94A3B8]"
                        >
                          <span>
                            {r.playerName} (<span className="font-mono-num">{r.playerCode}</span>)
                          </span>
                          <span className="text-[#FF6B1A]">
                            {r.achievementAr || 'مسجل'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {ev.status === 'upcoming' && canRegisterAny && (
                    <button
                      type="button"
                      onClick={() => setRegEvent(ev)}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10] transition-colors min-h-[44px]"
                    >
                      تسجيل في الفعالية
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Register Modal */}
      {regEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#101827] border border-white/[0.1] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">التسجيل في الفعالية</h3>
              <button
                type="button"
                onClick={() => setRegEvent(null)}
                className="p-2 text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#94A3B8]">{regEvent.titleAr}</p>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">اختر اللاعب</label>
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.playerCode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRegEvent(null)}
                  className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-sm text-[#94A3B8]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10]"
                >
                  {registering ? 'جاري التسجيل...' : 'تأكيد التسجيل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#101827] border border-white/[0.1] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">إنشاء فعالية جديدة</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-2 text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">اسم الفعالية</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94A3B8] mb-1">الوصف</label>
                <textarea
                  rows={3}
                  required
                  minLength={5}
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                  className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">الفرع</label>
                  <select
                    value={branchId}
                    onChange={(e) =>
                      setBranchId(e.target.value as 'branch_gamal' | 'branch_khalil')
                    }
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                  >
                    <option value="branch_gamal">ميامي — جمال عبد الناصر</option>
                    <option value="branch_khalil">ميامي — خليل حمادة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">التاريخ</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white font-mono-num"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">الموقع</label>
                  <input
                    type="text"
                    required
                    value={locationAr}
                    onChange={(e) => setLocationAr(e.target.value)}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#94A3B8] mb-1">الحد الأقصى للمشاركين</label>
                  <input
                    type="number"
                    min={5}
                    max={500}
                    required
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-3 py-2.5 text-sm text-white font-mono-num"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/[0.1] text-sm text-[#94A3B8]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10]"
                >
                  {creating ? 'جاري النشر...' : 'نشر الفعالية'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
