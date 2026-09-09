import React from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';

interface SchemesPageProps {
  language: 'en' | 'hi';
}

interface SchemeItem {
  id: string;
  name: string;
  ministry: string;
  category: string;
  benefit: string;
  eligibility: string;
}

const SCHEMES: SchemeItem[] = [
  {
    id: 's-1',
    name: 'PM Vishwakarma Scheme',
    ministry: 'Ministry of MSME',
    category: 'Artisans & Craftsmen (18 Trades including Carpentry)',
    benefit: 'Subsidized loan up to ₹3,00,000 at 5% interest + ₹15,000 toolkit incentive',
    eligibility: 'Traditional rural carpenters, blacksmiths, potters, etc.',
  },
  {
    id: 's-2',
    name: 'NBCFDC Concessional Term Loan',
    ministry: 'Ministry of Social Justice & Empowerment (MoSJE)',
    category: 'OBC Rural Micro-Entrepreneurs',
    benefit: 'Term loans up to ₹5,00,000 at 6% p.a. interest through State Channelizing Agencies',
    eligibility: 'Annual family income under ₹3,00,000 in rural sectors',
  },
  {
    id: 's-3',
    name: 'Pradhan Mantri MUDRA Yojana (PMMY)',
    ministry: 'Ministry of Finance / SIDBI',
    category: 'Shishu / Kishore Categories',
    benefit: 'Collateral-free working capital loan up to ₹50,000 (Shishu) to ₹5,00,000 (Kishore)',
    eligibility: 'All non-corporate, non-farm rural micro-enterprises',
  },
];

export const SchemesPage: React.FC<SchemesPageProps> = ({ language }) => {
  return (
    <div className="space-y-4">
      {/* Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center gap-2 text-emerald-800 mb-1">
          <Sparkles className="w-5 h-5" />
          <h1 className="text-base font-bold text-slate-900">
            {language === 'hi' ? 'रियायती सरकारी ऋण योजनाएं' : 'Concessional Government Schemes'}
          </h1>
        </div>
        <p className="text-xs text-slate-500">
          {language === 'hi'
            ? 'सामाजिक न्याय और अधिकारिता मंत्रालय (MoSJE) एवं राष्ट्रीय योजनाओं के तहत रियायती पूंजी।'
            : 'Targeted concessional credit schemes under MoSJE and national MSME empowerment programs.'}
        </p>
      </section>

      {/* Scheme Cards */}
      <div className="space-y-3">
        {SCHEMES.map((scheme) => (
          <article
            key={scheme.id}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 px-2 py-0.5 rounded">
                  {scheme.ministry}
                </span>
                <h2 className="text-sm font-bold text-slate-900 mt-1">{scheme.name}</h2>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                {language === 'hi' ? 'पात्र (Eligible)' : 'Eligible'}
              </span>
            </div>

            <div className="bg-slate-50 rounded-lg p-2.5 text-xs space-y-1">
              <p className="text-slate-700">
                <span className="font-semibold text-slate-900">
                  {language === 'hi' ? 'लाभ / रियायत:' : 'Target Benefit:'}
                </span>{' '}
                {scheme.benefit}
              </p>
              <p className="text-slate-600 text-[11px]">
                <span className="font-medium text-slate-800">
                  {language === 'hi' ? 'श्रेणी:' : 'Category:'}
                </span>{' '}
                {scheme.category}
              </p>
            </div>

            <div className="pt-1 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">{scheme.eligibility}</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-bold text-blue-900 hover:text-blue-700 cursor-pointer min-h-[36px] py-1 px-2"
              >
                <span>{language === 'hi' ? 'विवरण' : 'Details'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
