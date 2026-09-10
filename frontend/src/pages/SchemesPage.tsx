import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HelpCircle,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { evaluateAllSchemes } from '../lib/schemeEngine';
import type { SchemeEvaluationResult, UserEligibilityProfile } from '../types';

interface SchemesPageProps {
  language: 'en' | 'hi';
  initialProfile?: UserEligibilityProfile;
}

export const SchemesPage: React.FC<SchemesPageProps> = ({ language, initialProfile }) => {
  // Local demographic and business profile for deterministic scheme matching.
  // CRITICAL PRIVACY INVARIANT: This state remains 100% on-device and is NEVER sent to AI models or backend APIs.
  const [profile, setProfile] = useState<UserEligibilityProfile>({
    age: 42,
    gender: 'male',
    socialCategory: 'obc',
    annualHouseholdIncome: 220000,
    locationType: 'rural',
    trade: 'Carpentry & Woodcraft',
    isNewEnterprise: false, // Default to existing established carpentry unit per Ramesh persona
    hasAvailedMudraPmegpSvanidhiLast5Years: false, // Cooldown toggle
    isStreetVendor: false,
    hasVendingCertificate: false,
    isShgMember: false,
    ...initialProfile,
  });

  const [showProfileEditor, setShowProfileEditor] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'eligible' | 'potential' | 'ineligible'>('all');
  const [expandedSchemeId, setExpandedSchemeId] = useState<string | null>(null);

  // Deterministically evaluate all registered schemes against local profile
  const evaluatedSchemes: SchemeEvaluationResult[] = evaluateAllSchemes(profile);

  // Summary counts
  const eligibleCount = evaluatedSchemes.filter((s) => s.status === 'eligible').length;
  const potentialCount = evaluatedSchemes.filter((s) => s.status === 'potentially_eligible').length;
  const ineligibleCount = evaluatedSchemes.filter((s) => s.status === 'not_eligible').length;

  const filteredSchemes = evaluatedSchemes.filter((s) => {
    if (activeFilter === 'eligible') return s.status === 'eligible';
    if (activeFilter === 'potential') return s.status === 'potentially_eligible';
    if (activeFilter === 'ineligible') return s.status === 'not_eligible';
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedSchemeId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {/* Overview Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center gap-2 text-emerald-800 mb-1">
          <Sparkles className="w-5 h-5 text-emerald-700" />
          <h1 className="text-base font-bold text-slate-900">
            {language === 'hi' ? 'सरकारी योजना पात्रता इंजन' : 'Government Scheme Eligibility Engine'}
          </h1>
        </div>
        <p className="text-xs text-slate-600">
          {language === 'hi'
            ? 'सत्यापित सरकारी मानदंडों पर आधारित नियम-आधारित निष्पक्ष पात्रता मूल्यांकन। संवेदनशील डेटा आपके डिवाइस पर सुरक्षित रहता है।'
            : 'Deterministic rule-based matching cross-verified against official ministry guidelines. Sensitive demographic data remains 100% local on-device.'}
        </p>

        {/* Status Count Badges & Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-full font-bold cursor-pointer transition-colors ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {language === 'hi' ? 'सभी योजनाएं' : 'All Schemes'} ({evaluatedSchemes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('eligible')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold cursor-pointer transition-colors ${
              activeFilter === 'eligible'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'पात्र' : 'Eligible'} ({eligibleCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('potential')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold cursor-pointer transition-colors ${
              activeFilter === 'potential'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'संभावित' : 'Potential'} ({potentialCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('ineligible')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold cursor-pointer transition-colors ${
              activeFilter === 'ineligible'
                ? 'bg-slate-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>{language === 'hi' ? 'अपात्र' : 'Ineligible'} ({ineligibleCount})</span>
          </button>
        </div>
      </section>

      {/* Interactive Local Profile & Parameter Adjustment Drawer */}
      <section className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 shadow-xs text-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-800" />
            <h2 className="font-bold text-blue-950 text-xs uppercase tracking-wider">
              {language === 'hi' ? 'स्थानीय पात्रता मापदंड (Local Profile)' : 'Local Eligibility Parameters'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowProfileEditor(!showProfileEditor)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 hover:text-blue-950 cursor-pointer"
          >
            <span>{showProfileEditor ? (language === 'hi' ? 'छिपाएं' : 'Hide') : (language === 'hi' ? 'समायोजित करें' : 'Adjust Rules')}</span>
            {showProfileEditor ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Current profile summary chip row */}
        {!showProfileEditor && (
          <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-blue-900 font-medium">
            <span className="bg-white/90 border border-blue-200 px-2 py-0.5 rounded">
              {profile.trade || 'Trade: Not set'}
            </span>
            <span className="bg-white/90 border border-blue-200 px-2 py-0.5 rounded">
              {profile.locationType === 'rural' ? 'Rural' : 'Urban'}
            </span>
            <span className="bg-white/90 border border-blue-200 px-2 py-0.5 rounded uppercase">
              {profile.socialCategory}
            </span>
            <span className="bg-white/90 border border-blue-200 px-2 py-0.5 rounded">
              {profile.isNewEnterprise ? 'New Setup (Greenfield)' : 'Existing Enterprise'}
            </span>
            <span className={`border px-2 py-0.5 rounded font-semibold ${
              profile.hasAvailedMudraPmegpSvanidhiLast5Years
                ? 'bg-rose-100 text-rose-900 border-rose-300'
                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
            }`}>
              {profile.hasAvailedMudraPmegpSvanidhiLast5Years ? 'Prior Loan in 5yr: YES' : 'Prior Loan in 5yr: NO'}
            </span>
          </div>
        )}

        {/* Expandable editor controls for live deterministic testing */}
        {showProfileEditor && (
          <div className="pt-2 border-t border-blue-200/80 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'उद्यम का प्रकार:' : 'Enterprise Stage:'}
                </label>
                <select
                  value={profile.isNewEnterprise ? 'new' : 'existing'}
                  onChange={(e) => setProfile((p) => ({ ...p, isNewEnterprise: e.target.value === 'new' }))}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-medium"
                >
                  <option value="existing">{language === 'hi' ? 'मौजूदा व्यवसाय (Existing)' : 'Existing Enterprise'}</option>
                  <option value="new">{language === 'hi' ? 'नया उद्यम (Greenfield / New)' : 'Brand-New (Greenfield)'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'सामाजिक श्रेणी:' : 'Social Category:'}
                </label>
                <select
                  value={profile.socialCategory || 'general'}
                  onChange={(e) => setProfile((p) => ({ ...p, socialCategory: e.target.value as any }))}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-medium"
                >
                  <option value="obc">OBC (Other Backward Class)</option>
                  <option value="sc">SC (Scheduled Caste)</option>
                  <option value="st">ST (Scheduled Tribe)</option>
                  <option value="general">General</option>
                  <option value="minority">Minority</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'लिंग (Gender):' : 'Gender:'}
                </label>
                <select
                  value={profile.gender || 'male'}
                  onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value as any }))}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-medium"
                >
                  <option value="male">{language === 'hi' ? 'पुरुष (Male)' : 'Male'}</option>
                  <option value="female">{language === 'hi' ? 'महिला (Female)' : 'Female'}</option>
                  <option value="transgender">{language === 'hi' ? 'ट्रांसजेंडर (Transgender)' : 'Transgender'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {language === 'hi' ? 'स्थान (Location):' : 'Location:'}
                </label>
                <select
                  value={profile.locationType || 'rural'}
                  onChange={(e) => setProfile((p) => ({ ...p, locationType: e.target.value as any }))}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-medium"
                >
                  <option value="rural">{language === 'hi' ? 'ग्रामीण (Rural)' : 'Rural'}</option>
                  <option value="urban">{language === 'hi' ? 'शहरी (Urban)' : 'Urban'}</option>
                  <option value="peri_urban">{language === 'hi' ? 'अर्ध-शहरी (Peri-Urban)' : 'Peri-Urban'}</option>
                </select>
              </div>
            </div>

            {/* Demonstrable 5-Year Cooldown Toggle */}
            <div className="p-2.5 bg-white rounded-lg border border-blue-200">
              <label className="flex items-start sm:items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(profile.hasAvailedMudraPmegpSvanidhiLast5Years)}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, hasAvailedMudraPmegpSvanidhiLast5Years: e.target.checked }))
                  }
                  className="mt-0.5 sm:mt-0 rounded border-slate-300 text-blue-900 focus:ring-blue-600 shrink-0"
                />
                <span className="text-xs font-bold text-slate-800">
                  {language === 'hi'
                    ? 'पिछले 5 वर्षों में मुद्रा/PMEGP/स्वनिधि ऋण लिया है (5-वर्षीय कूलडाउन नियम)'
                    : 'Availed Mudra, PMEGP, or PM SVANidhi loan in last 5 years (PM Vishwakarma 5-Year Cooldown)'}
                </span>
              </label>
              <p className="text-[10px] text-slate-500 mt-0.5 ml-5">
                {language === 'hi'
                  ? 'यह नियम पीएम विश्वकर्मा के तहत दोहरे लाभ को रोकने के लिए 5 साल का कूलडाउन लागू करता है।'
                  : 'Demonstrates cross-scheme constraint from research dossier: blocks duplicate benefits under PM Vishwakarma.'}
              </p>
            </div>

            {/* Street vendor and SHG member checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-blue-200">
                <input
                  type="checkbox"
                  checked={Boolean(profile.isStreetVendor)}
                  onChange={(e) => setProfile((p) => ({ ...p, isStreetVendor: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-900 shrink-0"
                />
                <span className="text-[11px] font-medium text-slate-800">
                  {language === 'hi' ? 'स्ट्रीट वेंडर / रेहड़ी-पटरी' : 'Street Vendor / Hawker'}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-blue-200">
                <input
                  type="checkbox"
                  checked={Boolean(profile.isShgMember)}
                  onChange={(e) => setProfile((p) => ({ ...p, isShgMember: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-900 shrink-0"
                />
                <span className="text-[11px] font-medium text-slate-800">
                  {language === 'hi' ? 'महिला SHG सदस्य (2+ वर्ष)' : 'Women SHG Member (2+ yr)'}
                </span>
              </label>
            </div>
          </div>
        )}
      </section>

      {/* Scheme Cards Grid: Responsive 2 columns on tablet and desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-start">
        {filteredSchemes.map((scheme) => {
          const isExpanded = expandedSchemeId === scheme.schemeId;
          const isEligible = scheme.status === 'eligible';
          const isPotential = scheme.status === 'potentially_eligible';
          const isNotEligible = scheme.status === 'not_eligible';

          return (
            <article
              key={scheme.schemeId}
              className={`bg-white border rounded-xl p-4 shadow-xs space-y-3 transition-colors ${
                isEligible
                  ? 'border-emerald-300 hover:border-emerald-400'
                  : isPotential
                  ? 'border-amber-300 hover:border-amber-400'
                  : 'border-slate-200 opacity-85 hover:opacity-100'
              }`}
            >
              {/* Header: Ministry, Verification Date, and Status Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 px-2 py-0.5 rounded">
                      {language === 'hi' ? scheme.ministryHi : scheme.ministry}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      • {language === 'hi' ? `सत्यापित: ${scheme.lastVerifiedDate}` : `Verified: ${scheme.lastVerifiedDate}`}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                    {language === 'hi' ? scheme.nameHi : scheme.name}
                  </h2>
                </div>

                {/* Status Badges */}
                {isEligible && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{language === 'hi' ? 'पात्र (Eligible)' : 'Eligible'}</span>
                  </span>
                )}
                {isPotential && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full shrink-0">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                    <span>{language === 'hi' ? 'संभावित पात्र' : 'Potentially Eligible'}</span>
                  </span>
                )}
                {isNotEligible && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-full shrink-0">
                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>{language === 'hi' ? 'अपात्र' : 'Not Eligible'}</span>
                  </span>
                )}
              </div>

              {/* Benefit Highlight Box */}
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-100">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {language === 'hi' ? 'ऋण / लाभ सीमा:' : 'Loan / Benefit Capacity:'}
                  </span>
                  <span className="text-sm font-black text-blue-950">
                    {language === 'hi' ? scheme.benefitRange.formattedRangeHi : scheme.benefitRange.formattedRange}
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  <span className="font-semibold">{language === 'hi' ? 'सब्सिडी व ब्याज:' : 'Subsidy & Terms:'}</span>{' '}
                  {language === 'hi' ? scheme.subsidyInfoHi : scheme.subsidyInfo}
                </p>
                <p className="text-slate-600 text-[11px]">
                  <span className="font-semibold">{language === 'hi' ? 'संपार्श्विक (Collateral):' : 'Collateral:'}</span>{' '}
                  {language === 'hi' ? scheme.collateralRequirementHi : scheme.collateralRequirement}
                </p>
              </div>

              {/* Deterministic Criteria Summary */}
              <div className="space-y-1 text-xs">
                {/* Matched Criteria */}
                {scheme.matchedCriteria.length > 0 && (
                  <div className="space-y-0.5">
                    {scheme.matchedCriteria.map((crit, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-emerald-800 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{language === 'hi' ? scheme.matchedCriteriaHi[idx] || crit : crit}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Unmet Criteria (Reasons for Disqualification) */}
                {scheme.unmetCriteria.length > 0 && (
                  <div className="space-y-0.5 pt-0.5">
                    {scheme.unmetCriteria.map((crit, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-rose-800 text-[11px] font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span>{language === 'hi' ? scheme.unmetCriteriaHi[idx] || crit : crit}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending Criteria */}
                {scheme.pendingCriteria.length > 0 && (
                  <div className="space-y-0.5 pt-0.5">
                    {scheme.pendingCriteria.map((crit, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-amber-800 text-[11px]">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{language === 'hi' ? scheme.pendingCriteriaHi[idx] || crit : crit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Collapsible Details: Documents & Application Process */}
              {isExpanded && (
                <div className="pt-2 border-t border-slate-100 space-y-2 text-xs text-slate-700 animate-in fade-in">
                  <div>
                    <h3 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider mb-1">
                      {language === 'hi' ? 'आवश्यक दस्तावेज:' : 'Documents Needed:'}
                    </h3>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
                      {(language === 'hi' ? scheme.documentsNeededHi : scheme.documentsNeeded).map((doc, idx) => (
                        <li key={idx}>{doc}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-[11px] uppercase tracking-wider mb-0.5">
                      {language === 'hi' ? 'आवेदन प्रक्रिया:' : 'Application Process:'}
                    </h3>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {language === 'hi' ? scheme.applicationProcessHi : scheme.applicationProcess}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions: View Details Toggle & Official Portal Link */}
              <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => toggleExpand(scheme.schemeId)}
                  className="text-blue-900 hover:text-blue-700 font-bold text-[11px] cursor-pointer"
                >
                  {isExpanded
                    ? language === 'hi' ? 'कम विवरण' : 'Hide Details'
                    : language === 'hi' ? 'दस्तावेज व प्रक्रिया' : 'Documents & Process'}
                </button>

                <a
                  href={scheme.officialPortal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 text-white font-bold text-xs shadow-xs hover:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
                >
                  <span>{language === 'hi' ? 'आधिकारिक पोर्टल पर जाएं' : 'Official Portal'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {/* Trust & Methodology Footer */}
      <footer className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
        <ShieldCheck className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-800">
            {language === 'hi' ? 'अर्थसहायक योजना मिलान सिद्धांत' : 'ArthSahayak Scheme Matching Protocol'}
          </p>
          <p className="text-[11px] leading-relaxed">
            {language === 'hi'
              ? 'पात्रता की गणना केवल सरकारी राजपत्रित दिशा-निर्देशों के अनुसार शुद्ध गणितीय नियमों से होती है। कृत्रिम बुद्धिमत्ता (LLM) को पात्रता निर्णय लेने की अनुमति नहीं है। जाति, आय और पहचान से संबंधित डेटा पूरी तरह आपके फ़ोन/कंप्यूटर पर स्थानीय रूप से सुरक्षित रहता है।'
              : 'Eligibility is deterministically calculated strictly against published gazetted norms without generative LLM guesswork. Sensitive demographic parameters remain 100% on-device and are never transmitted to cloud servers.'}
          </p>
        </div>
      </footer>
    </div>
  );
};
