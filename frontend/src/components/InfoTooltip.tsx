import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

export type BankingTermKey = 'mpbf' | 'wcr' | 'margin' | 'dscr';

interface TermDetail {
  titleEn: string;
  titleHi: string;
  formulaEn?: string;
  formulaHi?: string;
  descEn: string;
  descHi: string;
}

const BANKING_TERMS: Record<BankingTermKey, TermDetail> = {
  mpbf: {
    titleEn: 'Maximum Permissible Bank Finance (MPBF)',
    titleHi: 'अधिकतम अनुमेय बैंक ऋण (MPBF)',
    formulaEn: '20% of Projected Annual Turnover',
    formulaHi: 'वार्षिक टर्नओवर का 20%',
    descEn:
      'Mandated by RBI’s Nayak Committee for micro and small enterprises. Banks calculate your working capital borrowing limit as at least 20% of annual turnover, ensuring institutional credit without collateral burdens.',
    descHi:
      'भारतीय रिज़र्व बैंक (नायक समिति) के नियमों के अनुसार, बैंक सूक्ष्म व लघु व्यवसायों को उनके कुल वार्षिक टर्नओवर का कम से कम 20% कार्यशील पूंजी ऋण (Cash Credit/Overdraft) के रूप में स्वीकृत करते हैं।',
  },
  wcr: {
    titleEn: 'Working Capital Requirement (25%)',
    titleHi: 'कुल कार्यशील पूंजी आवश्यकता (25%)',
    formulaEn: '25% of Annual Turnover',
    formulaHi: 'वार्षिक टर्नओवर का 25%',
    descEn:
      'The total liquid funds required by a business to purchase raw materials, pay worker wages, maintain inventory, and manage day-to-day operations across an operating cycle.',
    descHi:
      'कच्चा माल खरीदने, कारीगरों को दैनिक/साप्ताहिक मजदूरी देने और दुकान में जरूरी स्टॉक बनाए रखने के लिए आवश्यक कुल पूंजी, जिसे टर्नओवर का 25% माना जाता है।',
  },
  margin: {
    titleEn: 'Promoter Margin Equity (5%)',
    titleHi: 'उद्यमी का स्वयं का अंशदान (5%)',
    formulaEn: '5% of Annual Turnover',
    formulaHi: 'वार्षिक टर्नओवर का 5%',
    descEn:
      'The entrepreneur’s own cash contribution towards working capital. This 5% equity, together with 20% bank finance (MPBF), completely fulfills the 25% working capital requirement.',
    descHi:
      'कार्यशील पूंजी में उद्यमी का अपना नकद योगदान (कम से कम 5%)। यह 20% बैंक ऋण के साथ मिलकर व्यवसाय की कुल 25% पूंजीगत आवश्यकता को पूरा करता है।',
  },
  dscr: {
    titleEn: 'Debt Service Coverage Ratio (DSCR)',
    titleHi: 'ऋण अदायगी क्षमता अनुपात (DSCR)',
    formulaEn: 'Operating Surplus / Total Debt Service',
    formulaHi: 'परिचालन बचत / दर्ज ऋण किस्तें',
    descEn:
      'Measures the capacity of the enterprise to comfortably repay loan principal and interest from its operating cash surplus. A ratio of 1.5x or higher indicates strong credit safety for banks.',
    descHi:
      'यह दर्शाता है कि व्यवसाय की शुद्ध आमदनी बैंक की किस्त चुकाने के लिए कितनी पर्याप्त है। 1.5x या उससे अधिक का अनुपात बैंक ऋण के लिए अत्यधिक सुरक्षित व अनुकूल माना जाता है।',
  },
};

interface InfoTooltipProps {
  termKey: BankingTermKey;
  language: 'en' | 'hi';
  buttonSize?: 'sm' | 'md';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  termKey,
  language,
  buttonSize = 'sm',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const term = BANKING_TERMS[termKey];

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!term) return null;

  const title = language === 'hi' ? term.titleHi : term.titleEn;
  const desc = language === 'hi' ? term.descHi : term.descEn;
  const formula = language === 'hi' ? term.formulaHi : term.formulaEn;
  const buttonAria = language === 'hi' ? `${title} की जानकारी देखें` : `Learn more about ${title}`;

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          buttonSize === 'sm' ? 'w-5 h-5 p-0.5' : 'w-7 h-7 p-1'
        }`}
        aria-label={buttonAria}
        aria-expanded={isOpen}
        title={buttonAria}
      >
        <HelpCircle className={buttonSize === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={title}
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 sm:w-80 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-left text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {title}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer shrink-0"
              aria-label={language === 'hi' ? 'बंद करें' : 'Close'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Formula Pill if available */}
          {formula && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-semibold border border-indigo-200 dark:border-indigo-800">
              <span>{language === 'hi' ? 'मानक सूत्र:' : 'Norm:'}</span>
              <span>{formula}</span>
            </div>
          )}

          {/* Detailed explanation */}
          <p className="mt-2 text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
            {desc}
          </p>
        </div>
      )}
    </div>
  );
};
