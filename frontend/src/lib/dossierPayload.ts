import type {
  DossierInput,
  EntrepreneurProfile,
  FinancialSummary,
  SchemeRecommendation,
  Transaction,
  TransactionSnippet,
} from '../types';
import { evaluateAllSchemes } from './schemeEngine.ts';

export interface BuildDossierPayloadParams {
  financialSummary: FinancialSummary;
  profile?: EntrepreneurProfile;
  transactions?: Transaction[];
  language?: 'en' | 'hi';
  assessmentDate?: string;
}

/**
 * Deterministically constructs DossierInput payload for the ReportLab 2-page PDF generator.
 *
 * Strict Privacy & Architectural Invariants:
 * 1. Zero LLM calls or probabilistic reasoning.
 * 2. Zero recalculation: consumes pre-calculated deterministic financialSummary.
 * 3. Privacy-first: NEVER includes Aadhaar, PAN, caste certificate numbers, or sensitive demographics.
 * 4. Limits transaction sample to 4 and schemes to 3 to guarantee exact 2-page fit.
 */
export function buildDossierPayload({
  financialSummary,
  profile,
  transactions = [],
  language = 'en',
  assessmentDate,
}: BuildDossierPayloadParams): DossierInput {
  // Sort transactions latest first and take up to 4 for the audit trail sample
  const sortedTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const sample: TransactionSnippet[] = sortedTx.slice(0, 4).map((t) => ({
    date: t.date,
    party_name: t.party_name,
    item: t.item,
    amount: t.amount,
    tx_type: t.tx_type,
  }));

  // Deterministic scheme matching (privacy-preserving: only public scheme recommendations returned)
  const schemeMatches = evaluateAllSchemes({
    trade: profile?.trade || 'Carpentry & Woodcraft',
    locationType: 'rural',
  });

  const schemeRecs: SchemeRecommendation[] = schemeMatches
    .filter((s) => s.status === 'eligible' || s.status === 'potentially_eligible')
    .slice(0, 3)
    .map((s) => ({
      scheme_name: s.name,
      sponsoring_agency: s.ministry,
      target_benefit: s.subsidyInfo || s.benefitRange.formattedRange,
      notes:
        s.status === 'eligible'
          ? 'Meets core eligibility criteria'
          : 'Potentially eligible based on trade match',
    }));

  const mpbf = financialSummary.maximum_permissible_bank_finance;
  const mpbfFormatted = `₹${mpbf.toLocaleString('en-IN')}`;
  const dscrFormatted = financialSummary.dscr !== null ? `${financialSummary.dscr}x` : 'N/A';
  const txCount = transactions.length;

  const appraisalNotes =
    language === 'hi'
      ? `नायक समिति 20% टर्नओवर फॉर्मूले के आधार पर अनुशंसित कार्यशील पूंजी सीमा ${mpbfFormatted} है। ऋण शोधन क्षमता (प्रॉक्सी DSCR): ${dscrFormatted}। कुल ${txCount} सत्यापित बही-खाता प्रविष्टियों का मूल्यांकन किया गया।`
      : `Assessed working capital borrowing ceiling of ${mpbfFormatted} based on RBI Nayak Committee 20% turnover norm. Debt service coverage ratio proxy is ${dscrFormatted}. Evaluation synthesized across ${txCount} confirmed digital ledger transactions.`;

  const dateStr = assessmentDate || new Date().toISOString().slice(0, 10);

  return {
    applicant_name: profile?.name || 'Applicant',
    business_name: profile?.name ? `${profile.name}'s Enterprise` : 'Rural Micro-Enterprise',
    business_type: profile?.trade || 'Micro-Enterprise',
    assessment_date: dateStr,
    financial_period: profile?.period || 'FY 2025-26',
    financial_summary: financialSummary,
    proposed_finance_amount: mpbf > 0 ? mpbf : null,
    transaction_count: txCount,
    transaction_sample: sample.length > 0 ? sample : null,
    scheme_recommendations: schemeRecs.length > 0 ? schemeRecs : null,
    appraisal_notes: appraisalNotes,
  };
}
