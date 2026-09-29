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
import { InfoTooltip } from './InfoTooltip';

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
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs text-center space-y-3 transition-colors"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {language === 'hi'
              ? 'अर्थसहायक वित्त इंजन द्वारा गणना जारी है...'
              : 'Connecting to ArthSahayak Finance Engine...'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
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
        className="bg-rose-50/70 dark:bg-rose-950/40 border-2 border-rose-200 dark:border-rose-800/60 rounded-xl p-4 shadow-xs space-y-3 transition-colors"
        role="alert"
        aria-labelledby="api-error-heading"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1 flex-1">
            <h3 id="api-error-heading" className="text-sm font-bold text-rose-950 dark:text-rose-100">
              {language === 'hi' ? 'बैकएंड वित्त इंजन से संपर्क विफल' : 'Finance Engine Connection Failed'}
            </h3>
            <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
              {errorMessage ||
                (language === 'hi'
                  ? 'FastAPI सर्वर से गणना प्राप्त नहीं हो सकी। कृपया सुनिश्चित करें कि बैकएंड http://127.0.0.1:8000 पर चल रहा है।'
                  : 'Unable to calculate metrics from FastAPI backend. Ensure backend is running at http://127.0.0.1:8000.')}
            </p>
            <p className="text-[11px] font-semibold text-rose-900 dark:text-rose-300 pt-0.5">
              {language === 'hi'
                ? 'सुरक्षा नियम: विफलता के बाद अमान्य/नकली वित्तीय आंकड़े प्रदर्शित नहीं किए जा रहे हैं।'
                : 'Safety Guardrail: Failed requests are not replaced with silent fallback numbers.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200 dark:border-rose-800/60">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-600 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'पुनः प्रयास करें (Retry)' : 'Retry Connection'}</span>
            </button>
          )}

          {onUseDemoFallback && (
            <button
              type="button"
              onClick={onUseDemoFallback}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-slate-750 cursor-pointer"
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

  return (
    <section className="space-y-3" aria-labelledby="financial-metrics-heading">
      {/* Header and Provenance Badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 id="financial-metrics-heading" className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          {language === 'hi' ? 'वित्तीय स्थिति सारांश' : 'Financial Health Snapshot'}
        </h2>

        {/* Provenance Badge */}
        {dataSource === 'backend' && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-full shadow-2xs">
            <Server className="w-3 h-3 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span>
              {language === 'hi'
                ? 'अर्थसहायक वित्त इंजन द्वारा सत्यापित'
                : 'Calculated by ArthSahayak Finance Engine'}
            </span>
          </span>
        )}
        {dataSource === 'local' && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-900 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-800/60 px-2.5 py-0.5 rounded-full shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" aria-hidden="true" />
            <span>
              {language === 'hi'
                ? 'डिवाइस पर गणना की गई'
                : 'Calculated On-Device'}
            </span>
          </span>
        )}
        {dataSource === 'demo' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/60 px-2.5 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <span>{language === 'hi' ? 'डेमो डेटा (Not from Backend)' : 'DEMO DATA (Offline Fallback)'}</span>
          </span>
        )}
      </div>

      {/* Primary Card: Operating Cash Flow Balance */}
      <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs transition-colors">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {language === 'hi' ? 'शुद्ध परिचालन नकदी प्रवाह' : 'Net Operating Cash Flow'}
            </p>
            <p className={`text-2xl font-black mt-1 ${isSurplus ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
              {formatCurrency(summary.net_cash_flow)}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {isSurplus
                ? (language === 'hi' ? 'संचालन में शुद्ध नकदी बचत (Surplus)' : 'Operational cash surplus in period')
                : (language === 'hi' ? 'नकदी घाटा (Cash deficit)' : 'Operational cash deficit in period')}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl ${isSurplus ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'}`}>
            {isSurplus ? <TrendingUp className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                {language === 'hi' ? 'पैसा आया' : 'Money In'}{' '}
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  ({language === 'hi' ? 'कुल आवक / Credit' : 'Total Credit'})
                </span>
              </span>
            </div>
            <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatCurrency(summary.total_credit)}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>
                {language === 'hi' ? 'पैसा गया' : 'Money Out'}{' '}
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  ({language === 'hi' ? 'कुल खर्च / Debit' : 'Total Debit'})
                </span>
              </span>
            </div>
            <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatCurrency(summary.total_debit)}
            </p>
          </div>
        </div>
      </article>

      {/* Secondary Card: Nayak Committee Working Capital Assessment */}
      <article className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-4 shadow-xs transition-colors">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-700 dark:text-indigo-400" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
              {language === 'hi' ? 'नायक समिति कार्यशील पूंजी (Nayak Norms)' : 'Nayak Committee Working Capital Norms'}
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
            RBI Formula
          </span>
        </div>

        {/* Highlighted MPBF recommendation with InfoTooltip */}
        <div className="mt-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-indigo-900 dark:text-indigo-200 font-medium">
                {language === 'hi' ? 'अधिकतम अनुमेय बैंक ऋण (MPBF - 20%)' : 'Maximum Permissible Bank Finance (MPBF)'}
              </p>
              <InfoTooltip termKey="mpbf" language={language} />
            </div>
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
              {language === 'hi' ? '20% टर्नओवर' : '20% of Turnover'}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-2xl font-black text-indigo-950 dark:text-indigo-100">
              {formatCurrency(summary.maximum_permissible_bank_finance)}
            </p>
          </div>
          <p className="text-[11px] text-indigo-900/80 dark:text-indigo-300/80 mt-1">
            {language === 'hi'
              ? 'ग्रामीण बैंक शाखा प्रबंधकों के लिए अनुशंसित ऋण सीमा'
              : 'Recommended institutional borrowing limit for rural bank branches'}
          </p>
        </div>

        {/* 25% WCR and 5% Margin breakdown with InfoTooltip */}
        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <div className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate">
                {language === 'hi' ? 'कार्यशील पूंजी (25%)' : 'Working Capital (25%)'}
              </p>
              <InfoTooltip termKey="wcr" language={language} />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {formatCurrency(summary.working_capital_requirement)}
            </p>
          </div>

          <div className="border border-slate-200 dark:border-slate-700/60 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate">
                {language === 'hi' ? 'उद्यमी मार्जिन (5%)' : 'Promoter Margin (5%)'}
              </p>
              <InfoTooltip termKey="margin" language={language} />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {formatCurrency(summary.promoter_margin)}
            </p>
          </div>
        </div>

        {/* DSCR Indicator with InfoTooltip */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {language === 'hi' ? 'ऋण चुकौती कवरेज (DSCR):' : 'Debt Repayment Coverage (DSCR):'}
            </span>
            <InfoTooltip termKey="dscr" language={language} />
          </div>
          <span
            className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded ${
              summary.dscr === null
                ? 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800'
                : summary.dscr >= 1.5
                ? 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60'
                : summary.dscr >= 1.0
                ? 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60'
                : 'text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60'
            }`}
          >
            {summary.dscr === null ? (
              <span>{language === 'hi' ? 'कोई दर्ज ऋण चुकौती नहीं (N/A)' : 'N/A (No Recorded Debt)'}</span>
            ) : (
              <>
                {summary.dscr >= 1.5 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                )}
                <span>
                  {summary.dscr}x (
                  {summary.dscr >= 1.5
                    ? (language === 'hi' ? 'सुरक्षित' : 'Adequate')
                    : summary.dscr >= 1.0
                    ? (language === 'hi' ? 'मध्यम' : 'Moderate')
                    : summary.dscr >= 0.0
                    ? (language === 'hi' ? 'कम' : 'Low')
                    : (language === 'hi' ? 'घाटा' : 'Deficit')}
                  )
                </span>
              </>
            )}
          </span>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-tight">
          {language === 'hi'
            ? '*अनुमान बही-खाते में दर्ज ऋण चुकौती पर आधारित है, औपचारिक सत्यापित वार्षिक ऋण दायित्व पर नहीं।'
            : '*Proxy derived from recorded loan repayment transactions in ledger, not a verified annual debt service obligation.'}
        </p>
      </article>
    </section>
  );
};
