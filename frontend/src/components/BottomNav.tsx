import React from 'react';
import { BookOpen, FileText, Home, Sparkles } from 'lucide-react';
import type { NavigationTab } from '../types';

interface BottomNavProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  language: 'en' | 'hi';
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, language }) => {
  const tabs = [
    {
      id: 'dashboard' as NavigationTab,
      label: language === 'hi' ? 'मुख्य' : 'Home',
      icon: Home,
    },
    {
      id: 'ledger' as NavigationTab,
      label: language === 'hi' ? 'खाता बही' : 'Ledger',
      icon: BookOpen,
    },
    {
      id: 'appraisal' as NavigationTab,
      label: language === 'hi' ? 'बैंक रिपोर्ट' : 'Appraisal',
      icon: FileText,
    },
    {
      id: 'schemes' as NavigationTab,
      label: language === 'hi' ? 'योजनाएं' : 'Schemes',
      icon: Sparkles,
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-t border-slate-200 dark:border-slate-800 shadow-lg safe-bottom transition-colors duration-150"
      aria-label="Main Navigation"
    >
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 min-h-[52px] flex flex-col items-center justify-center py-1.5 px-2 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`p-1.5 rounded-full transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
