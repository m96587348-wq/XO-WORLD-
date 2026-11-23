import React, { useEffect, useState } from 'react';
import {
  Users,
  Calendar,
  Activity,
  Bell,
  Megaphone,
  ArrowLeft,
  Check,
  Wallet,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatArabicDate, formatCurrencyEgp, ROLE_LABELS } from '../lib/labels';
import type {
  AcademyEvent,
  Announcement,
  AppNotification,
  AuditLog,
  UserProfile,
} from '../types/xo';

export type NavTab =
  | 'home'
  | 'academy'
  | 'players'
  | 'community'
  | 'media'
  | 'events'
  | 'control';

interface DashboardResponse {
  stats: {
    visiblePlayersCount: number;
    activeGroupsCount: number;
    attendanceRate: number;
    upcomingEventsCount: number;
    activeSubscriptionsCount: number;
    outstandingBalanceEgp: number | null;
  };
  announcements: Announcement[];
  upcomingEvents: AcademyEvent[];
  notifications: AppNotification[];
  recentActivity: AuditLog[];
}

interface HomePageProps {
  user: UserProfile;
  onNavigate: (tab: NavTab) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ user, onNavigate }) => {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = () => {
    setLoading(true);
    setError(null);
    apiFetch<DashboardResponse>('/api/dashboard')
      .then((res) => setData(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذر تحميل لوحة الرئيسية.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, [user.id]);

  const markNotificationRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setData((prev) =>
        prev
          ? {
              ...prev,
              notifications: prev.notifications.map((n) =>
                n.id === id ? { ...n, isRead: true } : n,
              ),
            }
          : prev,
      );
    } catch {
      // handled silently on read toggle
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-2xl bg-[#101827] border border-white/[0.08] animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-[#101827] border border-white/[0.08] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-[#101827] border border-rose-500/30 p-8 text-center space-y-3">
        <p className="text-rose-300 text-sm">{error ?? 'حدث خطأ غير متوقع.'}</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="px-4 py-2 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const unreadCount = data.notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-8">
      {/* Welcome & Role Scope Banner */}
      <section className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 md:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <span className="text-[#FF6B1A] font-semibold">{ROLE_LABELS[user.role]}</span>
            <span aria-hidden="true">·</span>
            <span>XO Sport Academy — رجّع له البطل اللي جواه</span>
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-white">
            أهلاً بك، {user.fullName}
          </h2>
          <p className="text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
            {user.role === 'OWNER' &&
              'تمتلك صلاحية إدارة كاملة على فرعي ميامي (جمال عبد الناصر وخليل حمادة) وجميع اللاعبين والتقارير.'}
            {user.role === 'DELEGATE' &&
              'تم تقييد حسابك تلقائياً على الفروع والصلاحيات المفوضة لك فقط مع تسجيل كافة العمليات.'}
            {user.role === 'COACH' &&
              'تظهر لك بيانات اللاعبين والحضور الخاصة بمجموعاتك التدريبية المسندة فقط.'}
            {user.role === 'PARENT' &&
              'تعرض هذه اللوحة بيانات أبنائك المسجلين فقط في عزل تام عن حسابات أولياء الأمور الآخرين.'}
            {user.role === 'PLAYER' &&
              'تابع جدول تدريباتك، نسبة حضورك، تقييم المدربين، والبطولات القادمة في الأكاديمية.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('players')}
            className="px-4 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10] transition-colors whitespace-nowrap min-h-[44px]"
          >
            {user.role === 'PARENT' ? 'ملفات الأبناء' : 'استعراض اللاعبين'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('academy')}
            className="px-4 py-2.5 rounded-xl bg-[#080D18] border border-white/[0.1] text-white text-sm font-medium hover:border-white/[0.25] transition-colors whitespace-nowrap min-h-[44px]"
          >
            جداول التدريب
          </button>
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>{user.role === 'PARENT' ? 'الأبناء المسجلون' : 'اللاعبون ضمن نطاقك'}</span>
            <Users className="w-4 h-4 text-[#FF6B1A]" />
          </div>
          <div className="font-mono-num text-2xl md:text-3xl font-bold text-white tabular-nums">
            {data.stats.visiblePlayersCount}
          </div>
          <div className="text-xs text-[#94A3B8]">ملف نشط ومصرح به</div>
        </div>

        <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>نسبة الحضور</span>
            <Activity className="w-4 h-4 text-[#FF6B1A]" />
          </div>
          <div className="font-mono-num text-2xl md:text-3xl font-bold text-white tabular-nums">
            {data.stats.attendanceRate}%
          </div>
          <div className="text-xs text-[#94A3B8]">من إجمالي الحصص المسجلة</div>
        </div>

        <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>الفعاليات القادمة</span>
            <Calendar className="w-4 h-4 text-[#FF6B1A]" />
          </div>
          <div className="font-mono-num text-2xl md:text-3xl font-bold text-white tabular-nums">
            {data.stats.upcomingEventsCount}
          </div>
          <div className="text-xs text-[#94A3B8]">بطولات وتحديات مفتوحة</div>
        </div>

        <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>{user.role === 'COACH' ? 'المجموعات المسندة' : 'رصيد متبقي'}</span>
            {user.role === 'COACH' ? (
              <ShieldCheck className="w-4 h-4 text-[#FF6B1A]" />
            ) : (
              <Wallet className="w-4 h-4 text-[#FF6B1A]" />
            )}
          </div>
          <div className="font-mono-num text-2xl md:text-3xl font-bold text-white tabular-nums">
            {user.role === 'COACH'
              ? data.stats.activeGroupsCount
              : formatCurrencyEgp(data.stats.outstandingBalanceEgp ?? 0)}
          </div>
          <div className="text-xs text-[#94A3B8]">
            {user.role === 'COACH'
              ? 'مجموعات تدريب نشطة'
              : `اشتراكات سارية: ${data.stats.activeSubscriptionsCount}`}
          </div>
        </div>
      </section>

      {/* Main Content Split: Announcements + Notifications + Events */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Announcements & Events */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-5 h-5 text-[#FF6B1A]" />
                <h3 className="font-display text-lg font-bold text-white">إعلانات الأكاديمية</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('community')}
                className="text-xs font-semibold text-[#FF6B1A] hover:underline flex items-center gap-1"
              >
                <span>المجتمع</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {data.announcements.length === 0 ? (
              <p className="text-sm text-[#94A3B8] py-4">لا توجد إعلانات حالياً.</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {data.announcements.map((ann) => (
                  <article key={ann.id} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#94A3B8]">
                      <span className={ann.priority === 'important' ? 'text-[#FF6B1A] font-semibold' : ''}>
                        {ann.priority === 'urgent'
                          ? 'تنبيه عاجل'
                          : ann.priority === 'important'
                            ? 'إعلان هام'
                            : 'تحديث عام'}
                        {' · '}
                        {ann.authorName}
                      </span>
                      <span className="font-mono-num">{formatArabicDate(ann.createdAt)}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">{ann.titleAr}</h4>
                    <p className="text-sm text-[#94A3B8] leading-relaxed">{ann.bodyAr}</p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-[#FF6B1A]" />
                <h3 className="font-display text-lg font-bold text-white">الفعاليات القادمة</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('events')}
                className="text-xs font-semibold text-[#FF6B1A] hover:underline flex items-center gap-1"
              >
                <span>كل الفعاليات</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {data.upcomingEvents.length === 0 ? (
              <p className="text-sm text-[#94A3B8] py-4">لا توجد فعاليات قادمة حالياً.</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {data.upcomingEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs text-[#FF6B1A] font-medium">
                        {ev.eventType} · {formatArabicDate(ev.eventDate)}
                      </div>
                      <h4 className="text-sm font-bold text-white truncate">{ev.titleAr}</h4>
                      <p className="text-xs text-[#94A3B8] truncate">{ev.locationAr}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('events')}
                      className="px-3.5 py-2 rounded-xl bg-[#080D18] border border-white/[0.1] text-xs font-semibold text-white hover:border-[#FF6B1A] transition-colors shrink-0 min-h-[40px]"
                    >
                      التفاصيل والتسجيل
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notifications + Recent Activity */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-[#FF6B1A]" />
                <h3 className="font-display text-lg font-bold text-white">الإشعارات</h3>
              </div>
              <span className="text-xs text-[#94A3B8] font-mono-num">
                غير مقروء: {unreadCount}
              </span>
            </div>

            {data.notifications.length === 0 ? (
              <p className="text-sm text-[#94A3B8] py-4">لا توجد إشعارات جديدة.</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {data.notifications.map((n) => (
                  <div key={n.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            n.isRead ? 'text-[#94A3B8]' : 'text-white'
                          }`}
                        >
                          {n.titleAr}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">{n.bodyAr}</p>
                    </div>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(n.id)}
                        className="p-2 rounded-lg text-[#FF6B1A] hover:bg-[#FF6B1A]/10 shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="تحديد كمقروء"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-[#101827] border border-white/[0.08] p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-white">أحدث نشاط الأكاديمية</h3>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">لا توجد أنشطة مسجلة في نطاق حسابك.</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {data.recentActivity.map((act) => (
                  <div key={act.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                      <span className="text-white font-medium">{act.actorName}</span>
                      <span className="font-mono-num">{formatArabicDate(act.createdAt)}</span>
                    </div>
                    <p className="text-xs text-[#94A3B8]">
                      {act.action} · {act.targetTable}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
