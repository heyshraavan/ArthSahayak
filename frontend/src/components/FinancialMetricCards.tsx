import React from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, ShieldCheck, TrendingUp } from 'lucide-react';
import type { FinancialSummary } from '../types';


interface FinancialMetricCardsProps {
  summary: FinancialSummary;
  isMockData?: boolean;
  language: 'en' | 'hi';
}

const formatCurrency = (val: number): string => {
  return `₹${val.toLocaleString('en-IN')}`;
};

export const FinancialMetricCards: React.FC<FinancialMetricCardsProps> = ({
  summary,
  isMockData = true,
  language,
}) => {
  const isSurplus = summary.net_cash_flow >= 0;

  return (
    <section className="space-y-3" aria-labelledby="financial-metrics-heading">
      <div className="flex items-center justify-between">
        <h2 id="financial-metrics-heading" className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          {language === 'hi' ? 'वित्तीय स्थिति सारांश' : 'Financial Health Snapshot'}
        </h2>
        {isMockData && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3 text-amber-700" aria-hidden="true" />
            {language === 'hi' ? 'डेमो डेटा (प्रोटोटाइप)' : 'Demo Data (Prototype)'}
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
                ? (language === 'hi' ? 'संचालन में नकदी बचत (Surplus)' : 'Operational cash surplus in period')
                : (language === 'hi' ? 'नकदी कमी (Cash deficit)' : 'Operational cash deficit in period')}
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

        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50">
            <p className="text-[11px] text-slate-600 font-medium">
              {language === 'hi' ? 'कार्यशील पूंजी आवश्यकता (25%)' : 'Working Capital Req. (25%)'}
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
