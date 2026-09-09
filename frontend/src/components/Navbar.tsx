import React from 'react';
import { Globe, Wifi } from 'lucide-react';

interface NavbarProps {
  currentLanguage: 'en' | 'hi';
  onLanguageToggle: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentLanguage, onLanguageToggle }) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-xs">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
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
            <p className="text-[11px] text-slate-500 font-medium">
              {currentLanguage === 'hi' ? 'ग्रामीण व्यवसाय वित्तीय सहायक' : 'Rural Financial Assistant'}
            </p>
          </div>
        </div>

        {/* Right tools: Language selector & network indicator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLanguageToggle}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[38px] cursor-pointer"
            aria-label="Toggle language between English and Hindi"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span>{currentLanguage === 'hi' ? 'ENG' : 'हिंदी'}</span>
          </button>

          <div
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-emerald-50 text-emerald-800 text-xs font-medium"
            title="System online"
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span className="sr-only">Status: Online</span>
          </div>
        </div>
      </div>
    </header>
  );
};
