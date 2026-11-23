import type {
  AppRole,
  AttendanceStatus,
  DelegatePermissionKey,
  MediaVisibility,
  PaymentStatus,
  SubscriptionStatus,
} from '../types/xo';

export const ROLE_LABELS: Record<AppRole, string> = {
  OWNER: 'مالك الأكاديمية',
  DELEGATE: 'مفوض فرع',
  COACH: 'مدرب',
  PARENT: 'ولي أمر',
  PLAYER: 'لاعب',
};

export const PERMISSION_LABELS: Record<DelegatePermissionKey, string> = {
  manage_players: 'إدارة اللاعبين',
  manage_attendance: 'تسجيل الحضور والغياب',
  manage_payments: 'الاشتراكات والمدفوعات',
  manage_media: 'رفع وإدارة الوسائط',
  manage_events: 'إدارة الفعاليات والبطولات',
  manage_community: 'الإشراف على المجتمع والإعلانات',
  view_reports: 'عرض التقارير المالية والتشغيلية',
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: 'حاضر',
  absent: 'غائب',
  excused: 'معتذر',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'ساري',
  expiring_soon: 'قارب على الانتهاء',
  expired: 'منتهي',
  frozen: 'مجمد',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'مدفوع',
  pending: 'قيد التحصيل',
  overdue: 'متأخر',
  refunded: 'مسترد',
};

export const MEDIA_VISIBILITY_LABELS: Record<MediaVisibility, string> = {
  academy: 'عام للأكاديمية',
  branch: 'خاص بالفرع',
  group: 'أعضاء المجموعة فقط',
  private_player: 'خاص باللاعب وولي الأمر',
};

export function formatArabicDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatCurrencyEgp(amount: number): string {
  return `${amount.toLocaleString('en-US')} ج.م`;
}
