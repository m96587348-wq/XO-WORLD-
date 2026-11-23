import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Database,
  LogIn,
  UserPlus,
  KeyRound,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/api';
import { ROLE_LABELS } from '../lib/labels';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { SupabaseSetupModal } from '../components/SupabaseSetupModal';
import { useToast } from '../components/ToastProvider';
import type { AppRole, SystemConfigStatus, UserProfile } from '../types/xo';

interface SandboxAccount {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  scopeLabel: string;
}

interface AuthScreenProps {
  configStatus: SystemConfigStatus | null;
  onAuthenticated: (user: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  configStatus,
  onAuthenticated,
}) => {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'register' | 'recovery'>('login');
  const [setupOpen, setSetupOpen] = useState(false);

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register form (PARENT or PLAYER only)
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'PARENT' | 'PLAYER'>('PARENT');

  // Recovery form
  const [recEmail, setRecEmail] = useState('');
  const [recCode, setRecCode] = useState('');
  const [recNewPassword, setRecNewPassword] = useState('');
  const [recStep, setRecStep] = useState<'request' | 'confirm'>('request');
  const [previewCodeHint, setPreviewCodeHint] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sandboxAccounts, setSandboxAccounts] = useState<SandboxAccount[]>([]);

  useEffect(() => {
    if (configStatus && !configStatus.isSupabaseConnected) {
      apiFetch<{ accounts: SandboxAccount[] }>('/api/auth/sandbox-accounts')
        .then((res) => setSandboxAccounts(res.accounts))
        .catch(() => setSandboxAccounts([]));
    }
  }, [configStatus]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.token);
      showToast(`مرحباً ${res.user.fullName}`, 'success');
      onAuthenticated(res.user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تسجيل الدخول.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: regName,
          phone: regPhone,
          email: regEmail,
          password: regPassword,
          requestedRole: regRole,
        }),
      });
      setAuthToken(res.token);
      showToast('تم إنشاء الحساب بنجاح', 'success');
      onAuthenticated(res.user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إنشاء الحساب.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string; previewResetCode?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email: recEmail }),
        },
      );
      setPreviewCodeHint(res.previewResetCode ?? null);
      setRecStep('confirm');
      showToast(res.message, 'info');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إرسال رمز الاستعادة.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: recEmail,
          code: recCode,
          newPassword: recNewPassword,
        }),
      });
      showToast(res.message, 'success');
      setMode('login');
      setEmail(recEmail);
      setRecStep('request');
      setPreviewCodeHint(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تحديث كلمة المرور.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSandboxSignIn = async (userId: string) => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>(
        '/api/auth/sandbox-signin',
        {
          method: 'POST',
          body: JSON.stringify({ userId }),
        },
      );
      setAuthToken(res.token);
      showToast(`تم الدخول بحساب المعاينة: ${res.user.fullName}`, 'success');
      onAuthenticated(res.user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر الدخول.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080D18] text-white flex flex-col">
      {/* Compact Top Bar */}
      <header className="border-b border-white/[0.08] bg-[#080D18]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="XO WORLD" className="w-9 h-9 rounded-xl shrink-0" />
            <span className="font-display text-lg font-extrabold tracking-tight whitespace-nowrap">
              XO WORLD
            </span>
          </div>

          <div className="flex items-center gap-3">
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#101827] border border-white/[0.1] text-xs font-medium text-[#94A3B8] hover:text-white hover:border-white/[0.2] transition-colors whitespace-nowrap min-h-[40px]"
            >
              <Database className="w-4 h-4 text-[#FF6B1A]" />
              <span>حالة Supabase والإعداد</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Visual Editorial Brand Column */}
        <section className="lg:col-span-6 relative rounded-3xl overflow-hidden border border-white/[0.08] bg-[#101827] min-h-[320px] lg:min-h-[600px] flex flex-col justify-end">
          <img
            src="/src/assets/images/hero_academy_training_1795470266040.jpg"
            alt="صالة تدريب XO Sport Academy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080D18] via-[#080D18]/70 to-[#080D18]/25" />

          <div className="relative z-10 p-6 md:p-10 space-y-4">
            <p className="text-xs font-semibold text-[#FF6B1A]">
              XO Sport Academy · الإسكندرية
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-extrabold leading-tight text-white">
              رجّع له البطل اللي جواه
            </h1>
            <p className="text-sm md:text-base text-[#CBD5E1] max-w-xl leading-relaxed">
              المنصة التشغيلية المتكاملة لإدارة فروع الأكاديمية في ميامي (جمال عبد الناصر وخليل حمادة)، متابعة حضور وتطور اللاعبين، الاشتراكات، والفعاليات بأمان كامل وعزل تام لبيانات الأطفال.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#94A3B8]">
              <span>الباركور</span>
              <span aria-hidden="true">·</span>
              <span>الكيك بوكسينج</span>
              <span aria-hidden="true">·</span>
              <span>MMA</span>
              <span aria-hidden="true">·</span>
              <span>الجمباز</span>
              <span aria-hidden="true">·</span>
              <span>التايكوندو</span>
            </div>
          </div>
        </section>

        {/* Auth & Sandbox Column */}
        <section className="lg:col-span-6 flex flex-col justify-between gap-6">
          <div className="rounded-3xl bg-[#101827] border border-white/[0.08] p-6 md:p-8 space-y-6">
            {/* Mode Switcher */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#080D18] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className={`py-2.5 px-3 rounded-lg text-xs md:text-sm font-semibold transition-colors whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-[#FF6B1A] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                تسجيل الدخول
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                }}
                className={`py-2.5 px-3 rounded-lg text-xs md:text-sm font-semibold transition-colors whitespace-nowrap ${
                  mode === 'register'
                    ? 'bg-[#FF6B1A] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                حساب جديد
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('recovery');
                  setErrorMsg(null);
                }}
                className={`py-2.5 px-3 rounded-lg text-xs md:text-sm font-semibold transition-colors whitespace-nowrap ${
                  mode === 'recovery'
                    ? 'bg-[#FF6B1A] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                استعادة كلمة المرور
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-sm text-rose-300"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    dir="ltr"
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-3 text-sm text-white text-left focus:outline-none focus:border-[#FF6B1A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    كلمة المرور
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-3 text-sm text-white text-left focus:outline-none focus:border-[#FF6B1A]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#FF6B1A] text-white font-semibold text-sm hover:bg-[#e85d10] disabled:opacity-60 transition-colors min-h-[48px]"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{submitting ? 'جاري التحقق...' : 'دخول إلى المنصة'}</span>
                </button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="flex items-start gap-2 rounded-xl bg-[#080D18] border border-white/[0.08] p-3 text-xs text-[#94A3B8]">
                  <ShieldCheck className="w-4 h-4 text-[#FF6B1A] shrink-0 mt-0.5" />
                  <span>
                    التسجيل العام متاح لأولياء الأمور واللاعبين فقط. يتم تعيين حسابات المالك والمفوضين والمدربين من إدارة الأكاديمية حصراً.
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      الاسم الكامل
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="الاسم الثلاثي"
                      className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-3 text-sm text-white focus:outline-none focus:border-[#FF6B1A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      required
                      minLength={8}
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="01000000000"
                      dir="ltr"
                      className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-3 text-sm text-white text-left focus:outline-none focus:border-[#FF6B1A]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      نوع الحساب
                    </label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as 'PARENT' | 'PLAYER')}
                      className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-3 text-sm text-white focus:outline-none focus:border-[#FF6B1A]"
                    >
                      <option value="PARENT">ولي أمر</option>
                      <option value="PLAYER">لاعب</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                      البريد الإلكتروني
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="parent@example.com"
                      dir="ltr"
                      className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-3 text-sm text-white text-left focus:outline-none focus:border-[#FF6B1A]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    كلمة المرور (8 أحرف على الأقل)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-3 text-sm text-white text-left focus:outline-none focus:border-[#FF6B1A]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#FF6B1A] text-white font-semibold text-sm hover:bg-[#e85d10] disabled:opacity-60 transition-colors min-h-[48px]"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{submitting ? 'جاري الإنشاء...' : 'إنشاء الحساب'}</span>
                </button>
              </form>
            )}

            {mode === 'recovery' && (
              <div className="space-y-4">
                {recStep === 'request' ? (
                  <form onSubmit={handleRequestRecovery} className="space-y-4">
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      أدخل البريد الإلكتروني المسجل لاستلام رمز التحقق وإعادة تعيين كلمة المرور.
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                        البريد الإلكتروني
                      </label>
                      <input
                        type="email"
                        required
                        value={recEmail}
                        onChange={(e) => setRecEmail(e.target.value)}
                        dir="ltr"
                        className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-3 text-sm text-white text-left focus:outline-none focus:border-[#FF6B1A]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#FF6B1A] text-white font-semibold text-sm hover:bg-[#e85d10] min-h-[48px]"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>إرسال رمز الاستعادة</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleConfirmRecovery} className="space-y-4">
                    {previewCodeHint && (
                      <div className="rounded-xl bg-[#080D18] border border-[#FF6B1A]/40 p-3 text-xs text-white">
                        رمز الاستعادة في وضع المعاينة المحلية:{' '}
                        <span className="font-mono-num font-bold text-[#FF6B1A]">{previewCodeHint}</span>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                        رمز التحقق (6 أرقام)
                      </label>
                      <input
                        type="text"
                        required
                        value={recCode}
                        onChange={(e) => setRecCode(e.target.value)}
                        dir="ltr"
                        className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-3 text-sm text-white text-left font-mono-num focus:outline-none focus:border-[#FF6B1A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                        كلمة المرور الجديدة
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={recNewPassword}
                        onChange={(e) => setRecNewPassword(e.target.value)}
                        dir="ltr"
                        className="w-full rounded-xl bg-[#080D18] border border-white/[0.1] px-4 py-3 text-sm text-white text-left focus:outline-none focus:border-[#FF6B1A]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 px-4 rounded-xl bg-[#FF6B1A] text-white font-semibold text-sm hover:bg-[#e85d10] min-h-[48px]"
                    >
                      حفظ كلمة المرور الجديدة
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Fictional Preview Accounts Card (Shown ONLY when Supabase is not yet connected) */}
          {!configStatus?.isSupabaseConnected && sandboxAccounts.length > 0 && (
            <div className="rounded-3xl bg-[#101827] border border-white/[0.08] p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    حسابات المعاينة المحلية (بيانات تجريبية وهمية)
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    اختبر عزل الصلاحيات الفعلي عبر الدخول بكل دور قبل ربط Supabase
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSetupOpen(true)}
                  className="text-xs font-semibold text-[#FF6B1A] hover:underline whitespace-nowrap shrink-0"
                >
                  ربط Supabase
                </button>
              </div>

              <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                {sandboxAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSandboxSignIn(acc.id)}
                    className="w-full py-3 px-2 flex items-center justify-between gap-3 text-right hover:bg-white/[0.03] transition-colors rounded-lg min-h-[48px]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {acc.fullName}
                      </div>
                      <div className="text-xs text-[#94A3B8] flex items-center gap-2">
                        <span className="text-[#FF6B1A] font-medium">
                          {ROLE_LABELS[acc.role]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{acc.scopeLabel}</span>
                      </div>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-[#94A3B8] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <SupabaseSetupModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        status={configStatus}
      />
    </div>
  );
};
