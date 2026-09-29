import React from 'react';
import {
  BookOpen,
  FileText,
  Globe,
  Home,
  Moon,
  Sparkles,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import type { NavigationTab } from '../types';

interface NavbarProps {
  currentLanguage: 'en' | 'hi';
  onLanguageToggle: () => void;
  activeTab?: NavigationTab;
  onTabChange?: (tab: NavigationTab) => void;
  isOnline?: boolean;
  onOpenLanding?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentLanguage,
  onLanguageToggle,
  activeTab,
  onTabChange,
  isOnline = true,
  onOpenLanding,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();

  const tabs = [
    {
      id: 'dashboard' as NavigationTab,
      label: currentLanguage === 'hi' ? 'मुख्य' : 'Home',
      icon: Home,
    },
    {
      id: 'ledger' as NavigationTab,
      label: currentLanguage === 'hi' ? 'खाता बही' : 'Ledger',
      icon: BookOpen,
    },
    {
      id: 'appraisal' as NavigationTab,
      label: currentLanguage === 'hi' ? 'बैंक रिपोर्ट' : 'Appraisal',
      icon: FileText,
    },
    {
      id: 'schemes' as NavigationTab,
      label: currentLanguage === 'hi' ? 'योजनाएं' : 'Schemes',
      icon: Sparkles,
    },
  ];

  const themeToggleLabel =
    resolvedTheme === 'dark'
      ? currentLanguage === 'hi'
        ? 'लाइट मोड पर स्विच करें'
        : 'Switch to light mode'
      : currentLanguage === 'hi'
      ? 'डार्क मोड पर स्विच करें'
      : 'Switch to dark mode';

  const onlineTooltip =
    currentLanguage === 'hi'
      ? 'ऑनलाइन: सिस्टम कनेक्टेड है — आवाज व पर्ची का AI विश्लेषण तुरंत उपलब्ध है'
      : 'Online: Connected — Voice and chit AI processing ready';

  const offlineTooltip =
    currentLanguage === 'hi'
      ? 'ऑफ़लाइन: डेटा डिवाइस पर सुरक्षित है — इंटरनेट आने पर कतारबद्ध प्रविष्टियां स्वतः सिंक होंगी'
      : 'Offline: Data saved safely on-device — Queued items sync automatically upon reconnect';

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-3.5 sm:px-6 py-2.5 sm:py-3 transition-colors duration-150 shadow-2xs">
      <div className="w-full max-w-lg md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto flex items-center justify-between gap-2.5 sm:gap-4">
        {/* Brand identity */}
        <button
          type="button"
          onClick={onOpenLanding}
          className={`flex items-center gap-2 sm:gap-3 shrink-0 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-0.5 ${
            onOpenLanding ? 'hover:opacity-90 transition-opacity' : ''
          }`}
          title={onOpenLanding ? (currentLanguage === 'hi' ? 'होमपेज / परिचय देखें' : 'View Homepage / About') : undefined}
          aria-label={currentLanguage === 'hi' ? 'अर्थसहायक होम' : 'ArthSahayak Home'}
        >
          <img
            src="/logo.png"
            alt="ArthSahayak Logo"
            className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-md"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                Arth
              </span>
              <span className="text-base sm:text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                Sahayak
              </span>
              <span className="text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
              {currentLanguage === 'hi' ? 'ग्रामीण व्यवसाय वित्तीय सहायक' : 'Rural Financial Assistant'}
            </p>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        {activeTab && onTabChange && (
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Desktop Navigation">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 dark:bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Right tools: Theme toggle (Sun/Moon), Language selector & network indicator */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Theme Toggle (Clear Sun / Moon) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[38px] min-w-[38px] transition-colors cursor-pointer"
            aria-label={themeToggleLabel}
            title={themeToggleLabel}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" aria-hidden="true" />
            )}
          </button>

          {/* Language Selector */}
          <button
            type="button"
            onClick={onLanguageToggle}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[38px] transition-colors cursor-pointer"
            aria-label="Toggle language between English and Hindi"
            title={currentLanguage === 'hi' ? 'Switch to English' : 'हिंदी में बदलें'}
          >
            <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <span>{currentLanguage === 'hi' ? 'ENG' : 'हिंदी'}</span>
          </button>

          {/* Network Indicator with clear status explanation */}
          {isOnline ? (
            <div
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-medium cursor-help"
              title={onlineTooltip}
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span className="text-[11px] font-bold hidden sm:inline">
                {currentLanguage === 'hi' ? 'ऑनलाइन' : 'Online'}
              </span>
              <span className="sr-only">{onlineTooltip}</span>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-medium cursor-help"
              title={offlineTooltip}
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span className="text-[11px] font-bold">
                {currentLanguage === 'hi' ? 'ऑफ़लाइन (ऑटो-सिंक)' : 'Offline (Auto-sync)'}
              </span>
              <span className="sr-only">{offlineTooltip}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
