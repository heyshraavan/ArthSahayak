import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Landmark,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { buildDossierPayload } from '../lib/dossierPayload';
import { generateDossier } from '../services/api';
import type { EntrepreneurProfile, FinancialSummary, Transaction } from '../types';
import { InfoTooltip } from '../components/InfoTooltip';

interface AppraisalPageProps {
  financialSummary: FinancialSummary | null;
  language: 'en' | 'hi';
  profile?: EntrepreneurProfile;
  transactions?: Transaction[];
}

export const AppraisalPage: React.FC<AppraisalPageProps> = ({
  financialSummary,
  language,
  profile,
  transactions = [],
}) => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [dossierError, setDossierError] = useState<string | null>(null);

  const handleDownloadDossier = async () => {
    if (!financialSummary) return;

    // Check offline status before network request
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setDossierError(
        language === 'hi'
          ? 'आप वर्तमान में ऑफ़लाइन हैं। बैंक डॉसियर पीडीएफ डाउनलोड करने के लिए इंटरनेट कनेक्शन आवश्यक है।'
          : 'You are currently offline. An active internet connection is required to generate the bank dossier PDF.'
      );
      return;
    }

    setIsGenerating(true);
    setDossierError(null);

    try {
      const payload = buildDossierPayload({
        financialSummary,
        profile,
        transactions,
        language,
      });

      const blob = await generateDossier(payload);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'ArthSahayak_Credit_Appraisal_Dossier.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate dossier PDF';
      setDossierError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!financialSummary) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center space-y-3 transition-colors">
        <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {language === 'hi' ? 'मूल्यांकन डेटा अनुपलब्ध' : 'Appraisal Metrics Unavailable'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
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
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs transition-colors">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
          <Landmark className="w-5 h-5" />
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {language === 'hi' ? 'क्रेडिट मूल्यांकन डॉसियर (Bank Dossier)' : 'Credit Appraisal Dossier'}
          </h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {language === 'hi'
            ? 'भारतीय रिज़र्व बैंक (नायक समिति) के मानकों के अनुरूप 2-पृष्ठ का बैंक-तैयार क्रेडिट दस्तावेज़।'
            : 'Standardized 2-page institutional loan appraisal dossier compliant with RBI Nayak Committee norms.'}
        </p>
      </section>

      {/* Responsive 2-column layout on md+ screens */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">
        {/* Left Column: Recommended Capacity & PDF Action */}
        <section className="md:col-span-6 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-4 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
              {language === 'hi' ? 'अनुशंसित बैंक ऋण सीमा' : 'Assessed Bank Loan Capacity'}
            </h2>
          </div>

          <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-lg p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-indigo-800 dark:text-indigo-300 font-medium">
                {language === 'hi' ? 'अधिकतम अनुमेय बैंक वित्त (MPBF - 20%)' : 'Maximum Permissible Bank Finance (MPBF)'}
              </p>
              <InfoTooltip termKey="mpbf" language={language} />
            </div>
            <p className="text-3xl font-black text-indigo-950 dark:text-indigo-100 mt-1">
              ₹{financialSummary.maximum_permissible_bank_finance.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold">
                {language === 'hi' ? 'संस्थागत ऋण के लिए उपयुक्त' : 'Bank credit viable based on operational cash flow'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleDownloadDossier}
              disabled={isGenerating}
              className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {language === 'hi' ? 'डॉसियर तैयार किया जा रहा है...' : 'Generating PDF...'}
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {language === 'hi' ? '2-पेज बैंक डॉसियर डाउनलोड करें (PDF)' : 'Download 2-Page Bank Dossier (PDF)'}
                  </span>
                </>
              )}
            </button>

            {dossierError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg p-3 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">
                    {language === 'hi' ? 'डॉसियर त्रुटि' : 'Dossier Download Error'}
                  </p>
                  <p className="text-rose-700 dark:text-rose-300 mt-0.5">{dossierError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDossierError(null)}
                  className="text-rose-500 hover:text-rose-700 font-bold ml-1 cursor-pointer p-0.5"
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Regulatory Breakdown & Institutional Notice */}
        <div className="md:col-span-6 space-y-4">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3 transition-colors">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {language === 'hi' ? 'नायक समिति वित्तीय मानक विवरण' : 'Nayak Committee Norms Breakdown'}
            </h3>

            <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">
                  {language === 'hi' ? 'कुल मूल्यांकित टर्नओवर:' : 'Assessed Annual Turnover:'}
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  ₹{financialSummary.turnover.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 dark:text-slate-400">
                    {language === 'hi' ? 'कार्यशील पूंजी जरूरत (25%):' : 'Working Capital Requirement (25%):'}
                  </span>
                  <InfoTooltip termKey="wcr" language={language} />
                </div>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  ₹{financialSummary.working_capital_requirement.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 dark:text-slate-400">
                    {language === 'hi' ? 'उद्यमी अंशदान (5% Margin):' : 'Promoter Margin Equity (5%):'}
                  </span>
                  <InfoTooltip termKey="margin" language={language} />
                </div>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  ₹{financialSummary.promoter_margin.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 dark:text-slate-400">
                    {language === 'hi' ? 'ऋण चुकौती कवरेज (DSCR):' : 'Debt Repayment Coverage (DSCR):'}
                  </span>
                  <InfoTooltip termKey="dscr" language={language} />
                </div>
                <span
                  className={`font-bold ${
                    financialSummary.dscr === null
                      ? 'text-slate-600 dark:text-slate-400'
                      : financialSummary.dscr >= 1.5
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : financialSummary.dscr >= 1.0
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {financialSummary.dscr !== null ? `${financialSummary.dscr}x` : 'N/A'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 pb-1 leading-tight">
                {language === 'hi'
                  ? '*अनुमान बही-खाते में दर्ज ऋण चुकौती पर आधारित है, औपचारिक सत्यापित वार्षिक ऋण दायित्व पर नहीं।'
                  : '*Proxy derived from recorded ledger loan repayments, not a verified annual debt obligation.'}
              </p>
            </div>
          </section>

          {/* Info notice */}
          <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5 transition-colors">
            <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {language === 'hi'
                ? 'यह डॉसियर क्षेत्रीय ग्रामीण बैंकों (RRB) और राज्य चैनलाइजिंग एजेंसियों (SCA) के शाखा प्रबंधकों को औपचारिक ऋण आवेदन के समय प्रस्तुत करने के लिए बनाया गया है।'
                : 'This dossier is formatted specifically for Regional Rural Bank (RRB) and State Channelizing Agency branch managers to eliminate informal lending rejections.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
