import React from 'react';
import { BookOpen, FileText, Globe, Home, Sparkles, Wifi, WifiOff } from 'lucide-react';
import type { NavigationTab } from '../types';

interface NavbarProps {
  currentLanguage: 'en' | 'hi';
  onLanguageToggle: () => void;
  activeTab?: NavigationTab;
  onTabChange?: (tab: NavigationTab) => void;
  isOnline?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentLanguage,
  onLanguageToggle,
  activeTab,
  onTabChange,
  isOnline = true,
}) => {
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

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shadow-xs">
      <div className="w-full max-w-lg md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3 shrink-0">
          <img
            src="/logo.png"
            alt="ArthSahayak Logo"
            className="w-9 h-9 object-contain rounded-sm"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold tracking-tight text-blue-900">Arth</span>
              <span className="text-lg font-bold tracking-tight text-emerald-700">Sahayak</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              {currentLanguage === 'hi' ? 'ग्रामीण व्यवसाय वित्तीय सहायक' : 'Rural Financial Assistant'}
            </p>
          </div>
        </div>

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
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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

        {/* Right tools: Language selector & network indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onLanguageToggle}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[38px] cursor-pointer"
            aria-label="Toggle language between English and Hindi"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>{currentLanguage === 'hi' ? 'ENG' : 'हिंदी'}</span>
          </button>

          {isOnline ? (
            <div
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-emerald-50 text-emerald-800 text-xs font-medium"
              title={currentLanguage === 'hi' ? 'सिस्टम ऑनलाइन' : 'System online'}
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span className="sr-only">
                {currentLanguage === 'hi' ? 'स्थिति: ऑनलाइन' : 'Status: Online'}
              </span>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200"
              title={currentLanguage === 'hi' ? 'सिस्टम ऑफ़लाइन' : 'System offline'}
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
              <span className="text-[11px] font-bold">
                {currentLanguage === 'hi' ? 'ऑफ़लाइन' : 'Offline'}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
