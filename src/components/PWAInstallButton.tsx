import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center justify-center gap-2 rounded-xl border border-[#FF6B1A]/40 bg-[#FF6B1A]/10 text-[#FF6B1A] hover:bg-[#FF6B1A] hover:text-white transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
          compact ? 'px-3 py-1.5 text-xs font-semibold' : 'w-full px-4 py-2.5 text-sm font-semibold'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{isInstallable ? 'تثبيت التطبيق' : 'تثبيت XO WORLD'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#101827] border border-white/[0.1] p-6 text-right">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-[#FF6B1A]" />
                <h3 id="pwa-guide-title" className="text-lg font-bold text-white">
                  تثبيت تطبيق XO WORLD
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/[0.06]"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-[#94A3B8] leading-relaxed">
              {isIOS ? (
                <div className="space-y-2">
                  <p className="text-white font-semibold">على أجهزة iPhone و iPad (Safari):</p>
                  <p>1. اضغط على أيقونة المشاركة (Share) في شريط المتصفح السفلي.</p>
                  <p>2. مرر للأسفل واختر «إضافة إلى الشاشة الرئيسية» (Add to Home Screen).</p>
                  <p>3. اضغط «إضافة» ليظهر التطبيق بأيقونة XO WORLD.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-white font-semibold">على أجهزة Android وسطح المكتب (Chrome / Edge):</p>
                  <p>1. افتح قائمة المتصفح (⋮) في الزاوية العلوية.</p>
                  <p>2. اختر «تثبيت التطبيق» (Install App) أو «إضافة إلى الشاشة الرئيسية».</p>
                  <p>3. ملاحظة أمان: لا يتم تخزين بيانات اللاعبين الخاصة داخل ذاكرة التخزين المؤقت العامة.</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-[#FF6B1A] text-white text-sm font-semibold hover:bg-[#e85d10] transition-colors"
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
};
