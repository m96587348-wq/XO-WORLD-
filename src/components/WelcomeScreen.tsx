import React from 'react';
import { LogIn, ArrowLeft } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface WelcomeScreenProps {
  onProceedToLogin: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onProceedToLogin }) => {
  return (
    <div className="min-h-screen bg-[#080D18] text-white flex flex-col">
      {/* Compact Header */}
      <header className="border-b border-white/[0.08] bg-[#080D18]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="شعار أكاديمية XO" className="w-9 h-9 rounded-xl shrink-0" />
            <span className="font-display text-lg font-extrabold tracking-tight whitespace-nowrap">
              XO WORLD
            </span>
          </div>
          <PWAInstallButton compact />
        </div>
      </header>

      {/* Main Welcome Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 md:py-16">
        <div className="max-w-5xl w-full rounded-3xl overflow-hidden bg-[#101827] border border-white/[0.08] grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Brand & Slogan Content */}
          <div className="lg:col-span-6 p-8 md:p-12 flex flex-col justify-between gap-8 text-right">
            <div className="space-y-6">
              <div className="flex items-center gap-3.5">
                <img
                  src="/icon.svg"
                  alt="شعار XO Sport Academy"
                  className="w-14 h-14 rounded-2xl border border-white/[0.1] shrink-0"
                />
                <div>
                  <div className="font-display text-xl font-extrabold text-white">XO WORLD</div>
                  <div className="text-xs text-[#94A3B8]">XO Sport Academy · الإسكندرية</div>
                </div>
              </div>

              <div className="space-y-3">
                <h1 className="font-display text-3xl md:text-4xl font-extrabold leading-tight text-white">
                  رجّع له البطل اللي جواه
                </h1>
                <p className="text-sm md:text-base text-[#94A3B8] leading-relaxed">
                  المنصة الرسمية لإدارة فروع أكاديمية XO في ميامي (جمال عبد الناصر وخليل حمادة)، متابعة تدريبات الباركور، الكيك بوكسينج، MMA، الجمباز، والتايكوندو.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={onProceedToLogin}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-[#FF6B1A] text-white font-semibold text-sm md:text-base hover:bg-[#e85d10] transition-colors min-h-[48px]"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span>تسجيل الدخول إلى المنصة</span>
                <ArrowLeft className="w-4 h-4 shrink-0" />
              </button>

              <p className="text-xs text-[#94A3B8] text-center">
                مخصصة لأولياء الأمور، اللاعبين، المدربين، وإدارة الأكاديمية
              </p>
            </div>
          </div>

          {/* Visual Arena Frame */}
          <div className="lg:col-span-6 relative min-h-[260px] lg:min-h-full bg-[#080D18]">
            <img
              src="/src/assets/images/hero_academy_training_1795470266040.jpg"
              alt="تدريبات أبطال XO Sport Academy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080D18]/85 via-[#080D18]/25 to-transparent" />
          </div>
        </div>
      </main>
    </div>
  );
};
