import React, { useEffect, useState } from 'react';
import {
  Home,
  Building2,
  Users,
  MessageSquare,
  Image,
  Trophy,
  SlidersHorizontal,
  LogOut,
  Database,
} from 'lucide-react';
import { apiFetch, setAuthToken } from './lib/api';
import { ROLE_LABELS } from './lib/labels';
import { ToastProvider, useToast } from './components/ToastProvider';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { AuthScreen } from './pages/AuthScreen';
import { HomePage, type NavTab } from './pages/HomePage';
import { AcademyPage } from './pages/AcademyPage';
import { PlayersPage } from './pages/PlayersPage';
import { CommunityPage } from './pages/CommunityPage';
import { MediaPage } from './pages/MediaPage';
import { EventsPage } from './pages/EventsPage';
import { ControlPage } from './pages/ControlPage';
import type { SystemConfigStatus, UserProfile } from './types/xo';

const NAV_ITEMS: Array<{
  id: NavTab;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'home', title: 'XO HOME', subtitle: 'الرئيسية', icon: Home },
  { id: 'academy', title: 'XO ACADEMY', subtitle: 'الأكاديمية', icon: Building2 },
  { id: 'players', title: 'XO PLAYERS', subtitle: 'اللاعبين', icon: Users },
  { id: 'community', title: 'XO COMMUNITY', subtitle: 'المجتمع', icon: MessageSquare },
  { id: 'media', title: 'XO MEDIA', subtitle: 'الوسائط', icon: Image },
  { id: 'events', title: 'XO EVENTS', subtitle: 'الفعاليات', icon: Trophy },
  { id: 'control', title: 'XO CONTROL', subtitle: 'لوحة التحكم', icon: SlidersHorizontal },
];

const AppContent: React.FC = () => {
  const { showToast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [configStatus, setConfigStatus] = useState<SystemConfigStatus | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [showAuthScreen, setShowAuthScreen] = useState(false);

  useEffect(() => {
    apiFetch<SystemConfigStatus>('/api/system/config-status')
      .then(setConfigStatus)
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setActiveTab('home');
    setShowAuthScreen(false);
    showToast('تم تسجيل الخروج بأمان.', 'info');
  };

  if (!user) {
    if (!showAuthScreen) {
      return <WelcomeScreen onProceedToLogin={() => setShowAuthScreen(true)} />;
    }
    return (
      <AuthScreen
        configStatus={configStatus}
        onAuthenticated={(authenticatedUser) => {
          setUser(authenticatedUser);
          setActiveTab('home');
        }}
      />
    );
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#080D18] text-white flex flex-col md:flex-row">
      {/* Desktop Sidebar (RTL Right Side) */}
      <aside className="hidden md:flex md:flex-col md:w-64 lg:w-72 shrink-0 bg-[#101827] border-l border-white/[0.08] sticky top-0 h-screen">
        <div className="p-6 border-b border-white/[0.06] space-y-2">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="XO WORLD" className="w-10 h-10 rounded-xl shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-lg font-extrabold tracking-tight text-white">
                XO WORLD
              </div>
              <div className="text-xs text-[#FF6B1A] truncate">رجّع له البطل اللي جواه</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="التنقل الرئيسي">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-colors min-h-[44px] ${
                  active
                    ? 'bg-[#FF6B1A] text-white font-semibold'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="text-sm truncate">{item.subtitle}</span>
                  <span
                    className={`text-[10px] font-mono-num tracking-wider ${
                      active ? 'text-white/90' : 'text-[#64748B]'
                    }`}
                  >
                    {item.title.replace('XO ', '')}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/[0.06] space-y-3">
          <PWAInstallButton />
          <div className="rounded-xl bg-[#080D18] border border-white/[0.06] p-3 space-y-2">
            <div className="text-xs font-bold text-white truncate">{user.fullName}</div>
            <div className="text-[11px] text-[#FF6B1A] font-medium">
              {ROLE_LABELS[user.role]}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-white/[0.08] text-xs text-[#94A3B8] hover:text-white hover:border-white/[0.2] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {/* Compact Sticky Top Bar (<= 56px on mobile) */}
        <header className="sticky top-0 z-30 h-14 md:h-16 bg-[#080D18]/90 backdrop-blur-md border-b border-white/[0.08] px-4 md:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/icon.svg" alt="XO" className="w-7 h-7 rounded-lg md:hidden shrink-0" />
            <h1 className="font-display text-sm md:text-base font-bold text-white truncate">
              {currentNav.title} · {currentNav.subtitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!configStatus?.isSupabaseConnected && (
              <button
                type="button"
                onClick={() => setSetupOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#101827] border border-amber-500/30 text-xs text-amber-300 hover:border-amber-400 whitespace-nowrap min-h-[36px]"
              >
                <Database className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">إعداد Supabase</span>
                <span className="sm:hidden">الإعداد</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="md:hidden p-2 rounded-lg text-[#94A3B8] hover:text-white min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-6 md:py-8">
          {activeTab === 'home' && <HomePage user={user} onNavigate={setActiveTab} />}
          {activeTab === 'academy' && <AcademyPage user={user} />}
          {activeTab === 'players' && <PlayersPage user={user} />}
          {activeTab === 'community' && <CommunityPage user={user} />}
          {activeTab === 'media' && <MediaPage user={user} />}
          {activeTab === 'events' && <EventsPage user={user} />}
          {activeTab === 'control' && (
            <ControlPage
              user={user}
              configStatus={configStatus}
              onUserUpdated={(updated) => setUser(updated)}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Compact 1-row, >=44px touch targets) */}
      <nav
        aria-label="التنقل السفلي"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#101827]/95 backdrop-blur-md border-t border-white/[0.08] grid grid-cols-7 items-center px-1"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] rounded-lg transition-colors ${
                active ? 'text-[#FF6B1A]' : 'text-[#94A3B8]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-medium truncate max-w-full px-0.5">
                {item.subtitle}
              </span>
            </button>
          );
        })}
      </nav>

      <OfflineIndicator />

      <SupabaseSetupModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        status={configStatus}
      />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
