import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GOVERNMENT_SCHEMES,
  VISHWAKARMA_RECOGNIZED_TRADES,
  evaluateAllSchemes,
  evaluateSingleScheme,
  isVishwakarmaTrade,
} from '../src/lib/schemeEngine.ts';

// ============================================================================
// PART 1: Trade Recognition & PM Vishwakarma Trade List
// ============================================================================

test('Trade Recognition: Recognizes all 18 traditional artisan trades', () => {
  assert.strictEqual(VISHWAKARMA_RECOGNIZED_TRADES.length, 18);

  // Synonyms and variations
  assert.strictEqual(isVishwakarmaTrade('Carpentry & Woodcraft'), true);
  assert.strictEqual(isVishwakarmaTrade('Carpenter / Suthar'), true);
  assert.strictEqual(isVishwakarmaTrade('Blacksmith (Lohar)'), true);
  assert.strictEqual(isVishwakarmaTrade('Clay Pottery & Terracotta'), true);
  assert.strictEqual(isVishwakarmaTrade('Goldsmith / Jewelry'), true);
  assert.strictEqual(isVishwakarmaTrade('Cobbler / Footwear Artisan'), true);
  assert.strictEqual(isVishwakarmaTrade('Tailor & Garment Stitching'), true);
  assert.strictEqual(isVishwakarmaTrade('Barber / Haircut Salon'), true);
  assert.strictEqual(isVishwakarmaTrade('Mason (Rajmistri)'), true);
  assert.strictEqual(isVishwakarmaTrade('Washerman (Dhobi)'), true);
  assert.strictEqual(isVishwakarmaTrade('Bamboo Basket & Mat Weaver'), true);
  assert.strictEqual(isVishwakarmaTrade('Traditional Doll & Toy Maker'), true);
  assert.strictEqual(isVishwakarmaTrade('Fishing Net Maker'), true);

  // Non-Vishwakarma trades
  assert.strictEqual(isVishwakarmaTrade('Software Engineer'), false);
  assert.strictEqual(isVishwakarmaTrade('Kirana Store / Retail'), false);
  assert.strictEqual(isVishwakarmaTrade('Transport & Logistics'), false);
  assert.strictEqual(isVishwakarmaTrade('Stock Trading'), false);
  assert.strictEqual(isVishwakarmaTrade(''), false);
  assert.strictEqual(isVishwakarmaTrade(null), false);
  assert.strictEqual(isVishwakarmaTrade(undefined), false);
});

// ============================================================================
// PART 2: PM Vishwakarma & 5-Year Cooldown Cross-Scheme Rule
// ============================================================================

test('PM Vishwakarma: Eligible when artisan in recognized trade and no prior loans', () => {
  const scheme = GOVERNMENT_SCHEMES.find((s) => s.id === 'pm_vishwakarma');
  assert.ok(scheme);

  const profile = {
    age: 38,
    trade: 'Carpentry & Woodcraft',
    hasAvailedMudraPmegpSvanidhiLast5Years: false,
  };

  const result = evaluateSingleScheme(scheme, profile);
  assert.strictEqual(result.status, 'eligible');
  assert.ok(result.matchedCriteria.some((c) => c.includes('recognized traditional')));
  assert.ok(result.matchedCriteria.some((c) => c.includes('5-year cooldown rule')));
  assert.strictEqual(result.unmetCriteria.length, 0);
  assert.strictEqual(result.pendingCriteria.length, 0);
});

test('PM Vishwakarma: DEMONSTRABLE 5-YEAR COOLDOWN RULE triggers disqualification', () => {
  const scheme = GOVERNMENT_SCHEMES.find((s) => s.id === 'pm_vishwakarma');
  assert.ok(scheme);

  // Applicant is a valid carpenter, but availed Mudra 2 years ago
  const profileWithPriorLoan = {
    age: 35,
    trade: 'Carpentry',
    hasAvailedMudraPmegpSvanidhiLast5Years: true,
  };

  const result = evaluateSingleScheme(scheme, profileWithPriorLoan);
  assert.strictEqual(result.status, 'not_eligible');
  assert.ok(
    result.unmetCriteria.some((c) => c.includes('5-year cooldown rule')),
    'Must explicitly state disqualification under the 5-year cooldown rule',
  );
  assert.ok(
    result.matchedCriteria.some((c) => c.includes('recognized traditional')),
    'Trade was recognized, but cooldown triggered disqualification',
  );
});

test('PM Vishwakarma: Disqualified when trade is not recognized', () => {
  const scheme = GOVERNMENT_SCHEMES.find((s) => s.id === 'pm_vishwakarma');
  assert.ok(scheme);

  const profile = {
    age: 28,
    trade: 'Cyber Cafe Operator',
    hasAvailedMudraPmegpSvanidhiLast5Years: false,
  };

  const result = evaluateSingleScheme(scheme, profile);
  assert.strictEqual(result.status, 'not_eligible');
  assert.ok(result.unmetCriteria.some((c) => c.includes('not among the 18 recognized')));
});

test('PM Vishwakarma: Potentially eligible when 5-year cooldown is unconfirmed', () => {
  const scheme = GOVERNMENT_SCHEMES.find((s) => s.id === 'pm_vishwakarma');
  assert.ok(scheme);

  // Profile has valid trade and age, but prior loan status is not yet collected
  const profile = {
    age: 30,
    trade: 'Blacksmith',
    hasAvailedMudraPmegpSvanidhiLast5Years: null,
  };

  const result = evaluateSingleScheme(scheme, profile);
  assert.strictEqual(result.status, 'potentially_eligible');
  assert.ok(result.pendingCriteria.some((c) => c.includes('5-year cooldown rule')));
});

// ============================================================================
// PART 3: PMEGP Greenfield vs Existing Unit Rule
// ============================================================================

test('PMEGP: Strictly requires new (greenfield) enterprise; existing units are ineligible', () => {
  const scheme = GOVERNMENT_SCHEMES.find((s) => s.id === 'pmegp');
  assert.ok(scheme);

  // Case A: Existing operating business
  const existingProfile = {
    age: 40,
    isNewEnterprise: false,
  };
  const resultExisting = evaluateSingleScheme(scheme, existingProfile);
  assert.strictEqual(resultExisting.status, 'not_eligible');
  assert.ok(resultExisting.unmetCriteria.some((c) => c.includes('Existing operational units are not eligible')));

  // Case B: Brand-new venture
  const newProfile = {
    age: 25,
    isNewEnterprise: true,
  };
  const resultNew = evaluateSingleScheme(scheme, newProfile);
  assert.strictEqual(resultNew.status, 'eligible');
  assert.ok(resultNew.matchedCriteria.some((c) => c.includes('greenfield')));

  // Case C: Uncollected status yields potentially_eligible
  const unconfirmedProfile = {
    age: 30,
  };
  const resultUnconfirmed = evaluateSingleScheme(scheme, unconfirmedProfile);
  assert.strictEqual(resultUnconfirmed.status, 'potentially_eligible');
});

// ============================================================================
// PART 4: Stand-Up India SC/ST or Women Constraint & Greenfield Rule
// ============================================================================

test('Stand-Up India: Mandates SC/ST or Woman entrepreneur; rejects General/OBC male', () => {
  const scheme = GOVERNMENT_SCHEMES.find((s) => s.id === 'standup_india');
  assert.ok(scheme);

  // Case A: General category male -> Strictly NOT eligible
  const generalMale = {
    age: 32,
    gender: 'male',
    socialCategory: 'general',
    isNewEnterprise: true,
  };
  const resultGeneralMale = evaluateSingleScheme(scheme, generalMale);
  assert.strictEqual(resultGeneralMale.status, 'not_eligible');
  assert.ok(resultGeneralMale.unmetCriteria.some((c) => c.includes('SC/ST individuals or Women entrepreneurs')));

  // Case B: OBC male -> Strictly NOT eligible
  const obcMale = {
    age: 32,
    gender: 'male',
    socialCategory: 'obc',
    isNewEnterprise: true,
  };
  const resultObcMale = evaluateSingleScheme(scheme, obcMale);
  assert.strictEqual(resultObcMale.status, 'not_eligible');

  // Case C: Woman entrepreneur of any category -> Eligible
  const womanEntrepreneur = {
    age: 29,
    gender: 'female',
    socialCategory: 'general',
    isNewEnterprise: true,
  };
  const resultWoman = evaluateSingleScheme(scheme, womanEntrepreneur);
  assert.strictEqual(resultWoman.status, 'eligible');
  assert.ok(resultWoman.matchedCriteria.some((c) => c.includes('Woman entrepreneur')));

  // Case D: SC male -> Eligible
  const scMale = {
    age: 35,
    gender: 'male',
    socialCategory: 'sc',
    isNewEnterprise: true,
  };
  const resultSc = evaluateSingleScheme(scheme, scMale);
  assert.strictEqual(resultSc.status, 'eligible');
  assert.ok(resultSc.matchedCriteria.some((c) => c.includes('SC/ST')));

  // Case E: Existing business cannot use Stand-Up India
  const existingWoman = {
    age: 30,
    gender: 'female',
    isNewEnterprise: false,
  };
  const resultExistingWoman = evaluateSingleScheme(scheme, existingWoman);
  assert.strictEqual(resultExistingWoman.status, 'not_eligible');
  assert.ok(resultExistingWoman.unmetCriteria.some((c) => c.includes('first-time (greenfield)')));
});

// ============================================================================
// PART 5: PM SVANidhi Street Vendor Requirement
// ============================================================================

test('PM SVANidhi: Requires street vendor status / Certificate of Vending', () => {
  const scheme = GOVERNMENT_SCHEMES.find((s) => s.id === 'pm_svanidhi');
  assert.ok(scheme);

  // Case A: Confirmed street vendor with CoV
  const vendor = {
    age: 42,
    isStreetVendor: true,
    hasVendingCertificate: true,
    locationType: 'urban',
  };
  const resultVendor = evaluateSingleScheme(scheme, vendor);
  assert.strictEqual(resultVendor.status, 'eligible');

  // Case B: Confirmed non-vendor
  const nonVendor = {
    age: 42,
    isStreetVendor: false,
    locationType: 'urban',
  };
  const resultNonVendor = evaluateSingleScheme(scheme, nonVendor);
  assert.strictEqual(resultNonVendor.status, 'not_eligible');

  // Case C: Rural location without ULB coverage
  const ruralVendor = {
    age: 42,
    isStreetVendor: true,
    locationType: 'rural',
  };
  const resultRural = evaluateSingleScheme(scheme, ruralVendor);
  assert.strictEqual(resultRural.status, 'not_eligible');
});

// ============================================================================
// PART 6: DAY-NRLM / Lakhpati Didi Rules
// ============================================================================

test('DAY-NRLM: Exclusively for rural women members of Self-Help Groups (SHGs)', () => {
  const scheme = GOVERNMENT_SCHEMES.find((s) => s.id === 'day_nrlm');
  assert.ok(scheme);

  // Case A: Rural woman SHG member -> Eligible
  const shgWoman = {
    age: 34,
    gender: 'female',
    locationType: 'rural',
    isShgMember: true,
  };
  const resultShgWoman = evaluateSingleScheme(scheme, shgWoman);
  assert.strictEqual(resultShgWoman.status, 'eligible');

  // Case B: Male applicant -> Disqualified
  const male = {
    age: 34,
    gender: 'male',
    locationType: 'rural',
    isShgMember: true,
  };
  const resultMale = evaluateSingleScheme(scheme, male);
  assert.strictEqual(resultMale.status, 'not_eligible');

  // Case C: Urban woman -> Disqualified (NRLM is rural only)
  const urbanWoman = {
    age: 34,
    gender: 'female',
    locationType: 'urban',
    isShgMember: true,
  };
  const resultUrban = evaluateSingleScheme(scheme, urbanWoman);
  assert.strictEqual(resultUrban.status, 'not_eligible');

  // Case D: Rural woman without SHG membership -> Disqualified
  const nonShgWoman = {
    age: 34,
    gender: 'female',
    locationType: 'rural',
    isShgMember: false,
  };
  const resultNonShg = evaluateSingleScheme(scheme, nonShgWoman);
  assert.strictEqual(resultNonShg.status, 'not_eligible');
});

// ============================================================================
// PART 7: Pradhan Mantri Mudra Yojana (PMMY) Open Eligibility
// ============================================================================

test('PMMY Mudra: Open to any adult Indian citizen with non-farm micro enterprise', () => {
  const scheme = GOVERNMENT_SCHEMES.find((s) => s.id === 'pmmy_mudra');
  assert.ok(scheme);

  // Adult citizen with general profile
  const profile = {
    age: 26,
    trade: 'General Store',
    isNewEnterprise: false,
  };
  const result = evaluateSingleScheme(scheme, profile);
  assert.strictEqual(result.status, 'eligible');
  assert.strictEqual(result.unmetCriteria.length, 0);

  // Minor (< 18)
  const minor = {
    age: 17,
  };
  const resultMinor = evaluateSingleScheme(scheme, minor);
  assert.strictEqual(resultMinor.status, 'not_eligible');
});

// ============================================================================
// PART 8: Preserved MoSJE Schemes (NBCFDC & NSFDC)
// ============================================================================

test('NBCFDC Term Loan: Requires OBC category and income under ₹3,00,000', () => {
  const scheme = GOVERNMENT_SCHEMES.find((s) => s.id === 'nbcfdc_term_loan');
  assert.ok(scheme);

  // Case A: Qualifying OBC entrepreneur
  const qualifyingObc = {
    age: 35,
    socialCategory: 'obc',
    annualHouseholdIncome: 180000,
  };
  const resultA = evaluateSingleScheme(scheme, qualifyingObc);
  assert.strictEqual(resultA.status, 'eligible');

  // Case B: Income over ceiling
  const highIncomeObc = {
    age: 35,
    socialCategory: 'obc',
    annualHouseholdIncome: 450000,
  };
  const resultB = evaluateSingleScheme(scheme, highIncomeObc);
  assert.strictEqual(resultB.status, 'not_eligible');
  assert.ok(resultB.unmetCriteria.some((c) => c.includes('exceeds ₹3,00,000 ceiling')));

  // Case C: Non-OBC category (General)
  const general = {
    age: 35,
    socialCategory: 'general',
    annualHouseholdIncome: 150000,
  };
  const resultC = evaluateSingleScheme(scheme, general);
  assert.strictEqual(resultC.status, 'not_eligible');
});

test('NSFDC Credit: Requires SC category and income under ₹3,00,000', () => {
  const scheme = GOVERNMENT_SCHEMES.find((s) => s.id === 'nsfdc_term_loan');
  assert.ok(scheme);

  const qualifyingSc = {
    age: 30,
    socialCategory: 'sc',
    annualHouseholdIncome: 200000,
  };
  const result = evaluateSingleScheme(scheme, qualifyingSc);
  assert.strictEqual(result.status, 'eligible');

  const nonSc = {
    age: 30,
    socialCategory: 'st',
    annualHouseholdIncome: 200000,
  };
  const resultNonSc = evaluateSingleScheme(scheme, nonSc);
  assert.strictEqual(resultNonSc.status, 'not_eligible');
});

// ============================================================================
// PART 9: Safety Invariant — Never Claim Definitive Eligibility on Empty Profile
// ============================================================================

test('Safety Invariant: Uncollected profile NEVER claims definitive eligibility', () => {
  const emptyProfile = {};
  const allResults = evaluateAllSchemes(emptyProfile);

  assert.ok(allResults.length >= 8);

  // Invariant: No scheme should evaluate to 'eligible' when user information has not been collected
  const definitivelyEligible = allResults.filter((r) => r.status === 'eligible');
  assert.strictEqual(
    definitivelyEligible.length,
    0,
    'Must NOT claim definitive eligibility when required information is uncollected',
  );

  // All schemes should either be potentially_eligible or have pending criteria
  for (const r of allResults) {
    assert.ok(r.status === 'potentially_eligible' || r.status === 'not_eligible');
    assert.ok(r.pendingCriteria.length > 0 || r.unmetCriteria.length > 0);
  }
});

// ============================================================================
// PART 10: Multi-Scheme Matching & Ranking
// ============================================================================

test('Multi-Scheme Matching: Returns all matching schemes, ranked by suitability', () => {
  // Prototype user: Ramesh Sharma (Carpentry & Woodcraft artisan, OBC, existing unit, no prior loans)
  const rameshProfile = {
    age: 42,
    gender: 'male',
    socialCategory: 'obc',
    annualHouseholdIncome: 220000,
    locationType: 'rural',
    trade: 'Carpentry & Woodcraft',
    isNewEnterprise: false, // Existing established carpentry unit
    hasAvailedMudraPmegpSvanidhiLast5Years: false,
    isStreetVendor: false,
    isShgMember: false,
  };

  const results = evaluateAllSchemes(rameshProfile);

  // Find results for Ramesh
  const vishwakarma = results.find((r) => r.schemeId === 'pm_vishwakarma');
  const mudra = results.find((r) => r.schemeId === 'pmmy_mudra');
  const nbcfdc = results.find((r) => r.schemeId === 'nbcfdc_term_loan');
  const pmegp = results.find((r) => r.schemeId === 'pmegp');
  const standup = results.find((r) => r.schemeId === 'standup_india');
  const svanidhi = results.find((r) => r.schemeId === 'pm_svanidhi');
  const dayNrlm = results.find((r) => r.schemeId === 'day_nrlm');

  // Ramesh is ELIGIBLE for Vishwakarma (traditional carpenter, no prior loan in 5 yrs)
  assert.strictEqual(vishwakarma?.status, 'eligible');
  // Ramesh is ELIGIBLE for Mudra (non-farm micro-business, existing unit allowed)
  assert.strictEqual(mudra?.status, 'eligible');
  // Ramesh is ELIGIBLE for NBCFDC (OBC, family income < 3L)
  assert.strictEqual(nbcfdc?.status, 'eligible');

  // Ramesh is NOT ELIGIBLE for:
  // - PMEGP (strictly for new greenfield setups, Ramesh has existing unit)
  assert.strictEqual(pmegp?.status, 'not_eligible');
  // - Stand-Up India (OBC male with existing unit)
  assert.strictEqual(standup?.status, 'not_eligible');
  // - PM SVANidhi (not a street vendor)
  assert.strictEqual(svanidhi?.status, 'not_eligible');
  // - DAY-NRLM (male, not an SHG member)
  assert.strictEqual(dayNrlm?.status, 'not_eligible');

  // Top ranked schemes must be the eligible ones
  assert.strictEqual(results[0].status, 'eligible');
  assert.strictEqual(results[1].status, 'eligible');
  assert.strictEqual(results[2].status, 'eligible');
});
