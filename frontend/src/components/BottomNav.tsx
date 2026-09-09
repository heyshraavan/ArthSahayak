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
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-lg safe-bottom"
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
              className={`flex-1 min-h-[52px] flex flex-col items-center justify-center py-1.5 px-2 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                isActive
                  ? 'text-blue-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`p-1 rounded-full ${
                  isActive ? 'bg-blue-100 text-blue-900' : 'text-slate-500'
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
