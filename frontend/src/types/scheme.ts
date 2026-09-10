/**
 * Government Scheme Eligibility Engine Types
 * Based on Scheme_Research_Person1_Protofin.pdf and MoSJE guidelines.
 */

export type SchemeEligibilityStatus = 'eligible' | 'potentially_eligible' | 'not_eligible';

export interface SchemeBenefitRange {
  minAmount: number;
  maxAmount: number;
  currency: string;
  formattedRange: string;
  formattedRangeHi: string;
  details: string;
  detailsHi: string;
}

export interface SchemeCriterionEvaluation {
  id: string;
  name: string;
  nameHi: string;
  description: string;
  descriptionHi: string;
  satisfied: boolean;
  unmetReason?: string;
  unmetReasonHi?: string;
  missingData?: boolean;
}

export interface SchemeDefinition {
  id: string;
  name: string;
  nameHi: string;
  shortName: string;
  ministry: string;
  ministryHi: string;
  targetGroup: string;
  targetGroupHi: string;
  benefitRange: SchemeBenefitRange;
  subsidyInfo: string;
  subsidyInfoHi: string;
  collateralRequirement: string;
  collateralRequirementHi: string;
  officialPortal: string;
  portalDisplayUrl: string;
  lastVerifiedDate: string; // e.g. "2026-08-31" per research dossier
  sources: string[];
  documentsNeeded: string[];
  documentsNeededHi: string[];
  applicationProcess: string;
  applicationProcessHi: string;
}

export interface SchemeEvaluationResult {
  schemeId: string;
  name: string;
  nameHi: string;
  shortName: string;
  ministry: string;
  ministryHi: string;
  targetGroup: string;
  targetGroupHi: string;
  status: SchemeEligibilityStatus;
  matchedCriteria: string[];
  matchedCriteriaHi: string[];
  unmetCriteria: string[];
  unmetCriteriaHi: string[];
  pendingCriteria: string[];
  pendingCriteriaHi: string[];
  benefitRange: SchemeBenefitRange;
  subsidyInfo: string;
  subsidyInfoHi: string;
  collateralRequirement: string;
  collateralRequirementHi: string;
  officialPortal: string;
  portalDisplayUrl: string;
  lastVerifiedDate: string;
  sources: string[];
  documentsNeeded: string[];
  documentsNeededHi: string[];
  applicationProcess: string;
  applicationProcessHi: string;
  suitabilityScore: number;
}

export interface UserEligibilityProfile {
  age?: number | null;
  gender?: 'female' | 'male' | 'transgender' | 'other' | null;
  socialCategory?: 'general' | 'sc' | 'st' | 'obc' | 'minority' | null;
  annualHouseholdIncome?: number | null;
  locationType?: 'rural' | 'urban' | 'peri_urban' | null;
  trade?: string | null;
  isNewEnterprise?: boolean | null; // true = brand new greenfield, false = existing unit
  isStreetVendor?: boolean | null;
  hasVendingCertificate?: boolean | null; // CoV / LoR from Urban Local Body
  isShgMember?: boolean | null; // Rural Women Self-Help Group member
  isSafaiKaramchari?: boolean | null;
  hasAvailedMudraPmegpSvanidhiLast5Years?: boolean | null; // Cross-scheme 5-year cooldown
  educationLevel?: 'below_class_8' | 'class_8_or_above' | 'graduate' | null;
}
