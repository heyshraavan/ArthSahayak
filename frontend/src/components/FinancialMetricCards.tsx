import React from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import type { CalculationDataSource, CalculationStatus, FinancialSummary } from '../types';

interface FinancialMetricCardsProps {
  summary: FinancialSummary | null;
  status: CalculationStatus;
  dataSource: CalculationDataSource;
  errorMessage?: string | null;
  onRetry?: () => void;
  onUseDemoFallback?: () => void;
  language: 'en' | 'hi';
}

const formatCurrency = (val: number): string => {
  return `₹${val.toLocaleString('en-IN')}`;
};

export const FinancialMetricCards: React.FC<FinancialMetricCardsProps> = ({
  summary,
  status,
  dataSource,
  errorMessage,
  onRetry,
  onUseDemoFallback,
  language,
}) => {
  // 1. Loading State
  if (status === 'loading') {
    return (
      <section
        className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-center space-y-3"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-900 flex items-center justify-center mx-auto">
          <Loader2 className="w-6 h-6 animate-spin text-blue-900" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900">
            {language === 'hi'
              ? 'अर्थसहायक वित्त इंजन द्वारा गणना जारी है...'
              : 'Connecting to ArthSahayak Finance Engine...'}
          </h3>
          <p className="text-xs text-slate-500">
            {language === 'hi'
              ? 'बही-खाता लेनदेन और नायक समिति कार्यशील पूंजी अनुपात का मूल्यांकन हो रहा है।'
              : 'Deterministically evaluating ledger cash flows and Nayak Committee norms.'}
          </p>
        </div>
      </section>
    );
  }

  // 2. Error State (NEVER show fake numbers on error)
  if (status === 'error' || !summary) {
    return (
      <section
        className="bg-rose-50/70 border-2 border-rose-200 rounded-xl p-4 shadow-xs space-y-3"
        role="alert"
        aria-labelledby="api-error-heading"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1 flex-1">
            <h3 id="api-error-heading" className="text-sm font-bold text-rose-950">
              {language === 'hi' ? 'बैकएंड वित्त इंजन से संपर्क विफल' : 'Finance Engine Connection Failed'}
            </h3>
            <p className="text-xs text-rose-800 leading-relaxed">
              {errorMessage ||
                (language === 'hi'
                  ? 'FastAPI सर्वर से गणना प्राप्त नहीं हो सकी। कृपया सुनिश्चित करें कि बैकएंड http://127.0.0.1:8000 पर चल रहा है।'
                  : 'Unable to calculate metrics from FastAPI backend. Ensure backend is running at http://127.0.0.1:8000.')}
            </p>
            <p className="text-[11px] font-semibold text-rose-900 pt-0.5">
              {language === 'hi'
                ? 'सुरक्षा नियम: विफलता के बाद अमान्य/नकली वित्तीय आंकड़े प्रदर्शित नहीं किए जा रहे हैं।'
                : 'Safety Guardrail: Failed requests are not replaced with silent fallback numbers.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-700 text-white text-xs font-bold shadow-xs hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-600 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'पुनः प्रयास करें (Retry)' : 'Retry Connection'}</span>
            </button>
          )}

          {onUseDemoFallback && (
            <button
              type="button"
              onClick={onUseDemoFallback}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-rose-300 text-rose-900 text-xs font-semibold hover:bg-rose-50 cursor-pointer"
            >
              <span>{language === 'hi' ? 'ऑफ़लाइन डेमो देखें (Demo Only)' : 'View Static Demo Preview'}</span>
            </button>
          )}
        </div>
      </section>
    );
  }

  // 3. Render Metric Cards
  const isSurplus = summary.net_cash_flow >= 0;
  const isBackendData = dataSource === 'backend';

  return (
    <section className="space-y-3" aria-labelledby="financial-metrics-heading">
      {/* Header and Provenance Badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 id="financial-metrics-heading" className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          {language === 'hi' ? 'वित्तीय स्थिति सारांश' : 'Financial Health Snapshot'}
        </h2>

        {/* Real Backend Data Indicator */}
        {isBackendData ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full shadow-2xs">
            <Server className="w-3 h-3 text-emerald-700" aria-hidden="true" />
            <span>
              {language === 'hi'
                ? 'अर्थसहायक वित्त इंजन द्वारा सत्यापित'
                : 'Calculated by ArthSahayak Finance Engine'}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3 text-amber-700" aria-hidden="true" />
            <span>{language === 'hi' ? 'डेमो डेटा (Not from Backend)' : 'DEMO DATA (Offline Fallback)'}</span>
          </span>
        )}
      </div>

      {/* Primary Card: Operating Cash Flow Balance */}
      <article className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {language === 'hi' ? 'शुद्ध परिचालन नकदी प्रवाह' : 'Net Operating Cash Flow'}
            </p>
            <p className={`text-2xl font-black mt-1 ${isSurplus ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrency(summary.net_cash_flow)}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              {isSurplus
                ? (language === 'hi' ? 'संचालन में शुद्ध नकदी बचत (Surplus)' : 'Operational cash surplus in period')
                : (language === 'hi' ? 'नकदी घाटा (Cash deficit)' : 'Operational cash deficit in period')}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl ${isSurplus ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {isSurplus ? <TrendingUp className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 rounded-lg p-2.5">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'hi' ? 'कुल आवक (Credits)' : 'Total Inflows'}</span>
            </div>
            <p className="text-base font-bold text-slate-900 mt-1">
              {formatCurrency(summary.total_credit)}
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-2.5">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
              <span>{language === 'hi' ? 'कुल खर्च (Debits)' : 'Total Outflows'}</span>
            </div>
            <p className="text-base font-bold text-slate-900 mt-1">
              {formatCurrency(summary.total_debit)}
            </p>
          </div>
        </div>
      </article>

      {/* Secondary Card: Nayak Committee Working Capital Assessment */}
      <article className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-800" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950">
              {language === 'hi' ? 'नायक समिति कार्यशील पूंजी (Nayak Norms)' : 'Nayak Committee Working Capital Norms'}
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
            RBI Formula
          </span>
        </div>

        {/* Highlighted MPBF recommendation */}
        <div className="mt-3 bg-blue-50/70 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-900 font-medium">
            {language === 'hi' ? 'अधिकतम अनुमेय बैंक ऋण (MPBF - 20%)' : 'Maximum Permissible Bank Finance (MPBF)'}
          </p>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-2xl font-black text-blue-950">
              {formatCurrency(summary.maximum_permissible_bank_finance)}
            </p>
            <span className="text-xs font-bold text-blue-800">
              {language === 'hi' ? '20% टर्नओवर' : '20% of Turnover'}
            </span>
          </div>
          <p className="text-[11px] text-blue-900 mt-1">
            {language === 'hi'
              ? 'ग्रामीण बैंक शाखा प्रबंधकों के लिए अनुशंसित ऋण सीमा'
              : 'Recommended institutional borrowing limit for rural bank branches'}
          </p>
        </div>

        {/* 25% WCR and 5% Margin breakdown */}
        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50">
            <p className="text-[11px] text-slate-600 font-medium">
              {language === 'hi' ? 'कार्यशील पूंजी जरूरत (25%)' : 'Working Capital Req. (25%)'}
            </p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {formatCurrency(summary.working_capital_requirement)}
            </p>
          </div>

          <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50">
            <p className="text-[11px] text-slate-600 font-medium">
              {language === 'hi' ? 'उद्यमी अंशदान मार्जिन (5%)' : 'Promoter Margin (5%)'}
            </p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {formatCurrency(summary.promoter_margin)}
            </p>
          </div>
        </div>

        {/* DSCR Indicator */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">
            {language === 'hi' ? 'ऋण भुगतान क्षमता (DSCR):' : 'Debt Service Coverage (DSCR):'}
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {summary.dscr !== null ? `${summary.dscr}x (${language === 'hi' ? 'सुरक्षित' : 'Adequate'})` : 'N/A'}
          </span>
        </div>
      </article>
    </section>
  );
};
