import React from 'react';
import { AlertCircle, CheckCircle2, Download, FileText, Landmark, ShieldCheck } from 'lucide-react';
import type { FinancialSummary } from '../types';

interface AppraisalPageProps {
  financialSummary: FinancialSummary | null;
  language: 'en' | 'hi';
}

export const AppraisalPage: React.FC<AppraisalPageProps> = ({ financialSummary, language }) => {
  if (!financialSummary) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
        <h2 className="text-sm font-bold text-slate-900">
          {language === 'hi' ? 'मूल्यांकन डेटा अनुपलब्ध' : 'Appraisal Metrics Unavailable'}
        </h2>
        <p className="text-xs text-slate-500">
          {language === 'hi'
            ? 'बैकएंड वित्त इंजन से वित्तीय आंकड़े प्राप्त होने के बाद बैंक डॉसियर तैयार होगा।'
            : 'Bank dossier structuring requires active calculation from the ArthSahayak Finance Engine.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center gap-2 text-blue-900 mb-1">
          <Landmark className="w-5 h-5" />
          <h1 className="text-base font-bold text-slate-900">
            {language === 'hi' ? 'क्रेडिट मूल्यांकन डॉसियर (Bank Dossier)' : 'Credit Appraisal Dossier'}
          </h1>
        </div>
        <p className="text-xs text-slate-500">
          {language === 'hi'
            ? 'भारतीय रिज़र्व बैंक (नायक समिति) के मानकों के अनुरूप 2-पृष्ठ का बैंक-तैयार क्रेडिट दस्तावेज़।'
            : 'Standardized 2-page institutional loan appraisal dossier compliant with RBI Nayak Committee norms.'}
        </p>
      </section>

      {/* Recommended Limits Card */}
      <section className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-800" />
          <h2 className="text-sm font-bold text-blue-950 uppercase tracking-wider">
            {language === 'hi' ? 'अनुशंसित बैंक ऋण सीमा' : 'Assessed Bank Loan Capacity'}
          </h2>
        </div>

        <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 font-medium">
            {language === 'hi' ? 'अधिकतम अनुमेय बैंक वित्त (MPBF - 20%)' : 'Maximum Permissible Bank Finance (MPBF)'}
          </p>
          <p className="text-2xl font-black text-blue-950 mt-0.5">
            ₹{financialSummary.maximum_permissible_bank_finance.toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">
              {language === 'hi' ? 'संस्थागत ऋण के लिए उपयुक्त' : 'Bank credit viable based on operational cash flow'}
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-2 text-xs text-slate-700">
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">
              {language === 'hi' ? 'कुल मूल्यांकित टर्नओवर:' : 'Assessed Annual Turnover:'}
            </span>
            <span className="font-bold">₹{financialSummary.turnover.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">
              {language === 'hi' ? 'कार्यशील पूंजी जरूरत (25%):' : 'Working Capital Requirement (25%):'}
            </span>
            <span className="font-bold">₹{financialSummary.working_capital_requirement.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">
              {language === 'hi' ? 'उद्यमी अंशदान (5% Margin):' : 'Promoter Margin Equity (5%):'}
            </span>
            <span className="font-bold">₹{financialSummary.promoter_margin.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">
              {language === 'hi' ? 'ऋण चुकौती कवरेज (प्रॉक्सी DSCR):' : 'Debt Repayment Coverage (Proxy DSCR):'}
            </span>
            <span
              className={`font-bold ${
                financialSummary.dscr === null
                  ? 'text-slate-600'
                  : financialSummary.dscr >= 1.5
                  ? 'text-emerald-700'
                  : financialSummary.dscr >= 1.0
                  ? 'text-amber-700'
                  : 'text-rose-700'
              }`}
            >
              {financialSummary.dscr !== null ? `${financialSummary.dscr}x` : 'N/A'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 pb-1 leading-tight">
            {language === 'hi'
              ? '*अनुमान बही-खाते में दर्ज ऋण चुकौती पर आधारित है, औपचारिक सत्यापित वार्षिक ऋण दायित्व पर नहीं।'
              : '*Proxy derived from recorded ledger loan repayments, not a verified annual debt obligation.'}
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => alert(language === 'hi' ? 'बैकएंड ReportLab जनरेटर से डॉसियर डाउनलोड अगले चरण में सक्षम होगा।' : 'ReportLab 2-page PDF generation ready to hook to backend API endpoint.')}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-blue-900 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:bg-blue-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
          >
            <Download className="w-4 h-4" />
            <span>
              {language === 'hi' ? '2-पेज बैंक डॉसियर डाउनलोड करें (PDF)' : 'Download 2-Page Bank Dossier (PDF)'}
            </span>
          </button>
        </div>
      </section>

      {/* Info notice */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2">
        <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p>
          {language === 'hi'
            ? 'यह डॉसियर क्षेत्रीय ग्रामीण बैंकों (RRB) और राज्य चैनलाइजिंग एजेंसियों (SCA) के शाखा प्रबंधकों को औपचारिक ऋण आवेदन के समय प्रस्तुत करने के लिए बनाया गया है।'
            : 'This dossier is formatted specifically for Regional Rural Bank (RRB) and State Channelizing Agency branch managers to eliminate informal lending rejections.'}
        </p>
      </div>
    </div>
  );
};
