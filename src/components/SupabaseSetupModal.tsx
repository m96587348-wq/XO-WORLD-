import React from 'react';
import { Database, KeyRound, ShieldAlert, X, Terminal } from 'lucide-react';
import type { SystemConfigStatus } from '../types/xo';

interface SupabaseSetupModalProps {
  open: boolean;
  onClose: () => void;
  status: SystemConfigStatus | null;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  open,
  onClose,
  status,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#101827] border border-white/[0.1] p-6 text-right my-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B1A]/15 flex items-center justify-center text-[#FF6B1A]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">إعداد ربط Supabase والبيئة الإنتاجية</h3>
              <p className="text-xs text-[#94A3B8]">
                حالة الاتصال الفعلية ومتطلبات التشغيل الكامل على PostgreSQL و RLS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06]"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-[#080D18] border border-white/[0.08] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white">حالة متغيرات البيئة الحالية</span>
              <span
                className={`text-xs font-semibold ${
                  status?.isSupabaseConnected ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {status?.isSupabaseConnected
                  ? 'متصل بـ Supabase'
                  : 'وضع المعاينة المحلية (بيانات وهمية)'}
              </span>
            </div>
            <ul className="space-y-2 text-xs font-mono-num">
              <li className="flex items-center justify-between text-[#94A3B8]">
                <span>VITE_SUPABASE_URL</span>
                <span className={status?.supabaseUrlConfigured ? 'text-emerald-400' : 'text-rose-400'}>
                  {status?.supabaseUrlConfigured ? 'مضبوط' : 'غير مضبوط'}
                </span>
              </li>
              <li className="flex items-center justify-between text-[#94A3B8]">
                <span>VITE_SUPABASE_ANON_KEY</span>
                <span className={status?.supabaseAnonKeyConfigured ? 'text-emerald-400' : 'text-rose-400'}>
                  {status?.supabaseAnonKeyConfigured ? 'مضبوط' : 'غير مضبوط'}
                </span>
              </li>
              <li className="flex items-center justify-between text-[#94A3B8]">
                <span>SUPABASE_SERVICE_ROLE_KEY (خادم فقط)</span>
                <span className={status?.supabaseServiceKeyConfigured ? 'text-emerald-400' : 'text-rose-400'}>
                  {status?.supabaseServiceKeyConfigured ? 'مضبوط' : 'غير مضبوط'}
                </span>
              </li>
              <li className="flex items-center justify-between text-[#94A3B8]">
                <span>بوابة الدفع الإلكتروني (اختياري)</span>
                <span className={status?.onlinePaymentsConfigured ? 'text-emerald-400' : 'text-amber-400'}>
                  {status?.onlinePaymentsConfigured ? 'مفعلة' : 'غير مفعلة — التحصيل يدوي بالفرع فقط'}
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl bg-[#080D18] border border-white/[0.08] p-4 space-y-2 text-xs text-[#94A3B8] leading-relaxed">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <KeyRound className="w-4 h-4 text-[#FF6B1A]" />
              <span>خطوات الربط قبل إدخال أي بيانات حقيقية للأطفال</span>
            </div>
            <p>1. أنشئ مشروعاً جديداً في Supabase وأضف المتغيرات الثلاثة في لوحة Secrets / البيئة (لا تضع SERVICE_ROLE في أي متغير يبدأ بـ VITE_).</p>
            <p>2. نفّذ ملفات الهجرة بالترتيب داخل Supabase SQL Editor:</p>
            <div className="bg-[#101827] border border-white/[0.06] rounded-lg p-2.5 font-mono text-[11px] text-white space-y-1 text-left" dir="ltr">
              <div>supabase/migrations/0001_xo_world_schema.sql</div>
              <div>supabase/migrations/0002_rls_and_storage.sql</div>
              <div>supabase/seed_fictional.sql</div>
            </div>
            <p>3. أنشئ حساب المالك الأول من لوحة Supabase Auth ثم امنحه دور <span className="font-mono text-white">OWNER</span> في جدول <span className="font-mono text-white">user_roles</span>.</p>
          </div>

          <div className="rounded-xl bg-[#080D18] border border-white/[0.08] p-4 space-y-2 text-xs text-[#94A3B8]">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Terminal className="w-4 h-4 text-[#FF6B1A]" />
              <span>تصدير المشروع إلى ZIP أو GitHub</span>
            </div>
            <p className="leading-relaxed">
              من قائمة المشروع في AI Studio يمكنك تنزيل حزمة ZIP كاملة أو ربط المستودع بـ GitHub ثم تنفيذ:
            </p>
            <pre className="bg-[#101827] border border-white/[0.06] rounded-lg p-3 font-mono text-[11px] text-white overflow-x-auto text-left" dir="ltr">{`git init && git add . && git commit -m "XO WORLD initial release"
npm install && npm run lint && npm test && npm run build`}</pre>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>
              تنبيه حماية الأطفال: جميع السجلات المعروضة في وضع المعاينة المحلية هي بيانات تجريبية وهمية بالكامل. لا تدخل بيانات حقيقية قبل ربط Supabase وتفعيل سياسات RLS.
            </span>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10] transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
