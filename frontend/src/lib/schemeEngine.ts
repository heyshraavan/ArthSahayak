/**
 * Deterministic Government Scheme Eligibility Engine for ArthSahayak.
 *
 * Source: Scheme_Research_Person1_Protofin.pdf and MoSJE guidelines.
 *
 * Key Architectural Invariants:
 * 1. Strictly rule-based: Zero probabilistic LLM or ML hallucinations in eligibility decisions.
 * 2. Privacy-first: Sensitive demographic data (caste, income, gender, Aadhaar) remains 100% local
 *    and is NEVER transmitted over the wire or sent to Gemini/Groq.
 * 3. Complete matching: Returns all matching schemes, ranked by suitability.
 * 4. Transparent criteria: Every scheme result clearly documents matched, unmet, and pending criteria.
 * 5. Three-state classification:
 *    - 'eligible': All conditions verified and satisfied.
 *    - 'potentially_eligible': No hard disqualifications, but required information has not yet been collected.
 *    - 'not_eligible': One or more strict eligibility conditions are unmet.
 * 6. Demonstrable cross-scheme PM Vishwakarma 5-year cooldown rule:
 *    Disqualifies applicants who availed Mudra/PMEGP/SVANidhi loans in the last 5 years.
 */

import type {
  SchemeDefinition,
  SchemeEligibilityStatus,
  SchemeEvaluationResult,
  UserEligibilityProfile,
} from '../types';

/**
 * 18 Recognized Traditional Trades under PM Vishwakarma Scheme
 * (Page 6 of Scheme Research Dossier).
 */
export const VISHWAKARMA_RECOGNIZED_TRADES: readonly string[] = [
  'carpenter', // Suthar / Badhai
  'boat_maker', // Boat builder
  'armourer', // Armourer
  'blacksmith', // Lohar
  'hammer_toolkit_maker', // Hammer and tool kit maker
  'locksmith', // Locksmith
  'goldsmith', // Sonar / Swarnakar
  'potter', // Kumhaar
  'sculptor', // Moortikar / stone carver / stone breaker
  'cobbler', // Charmakar / shoesmith / footwear artisan
  'mason', // Rajmistri
  'basket_mat_broom_maker', // Basket / mat / broom maker / coir weaver
  'doll_toy_maker', // Traditional doll and toy maker
  'barber', // Naai
  'garland_maker', // Malakaar / florist artisan
  'washerman', // Dhobi / laundry artisan
  'tailor', // Darzi
  'fishing_net_maker', // Fishing net maker
];

/**
 * Matches a free-form trade string against the 18 recognized PM Vishwakarma trades.
 */
export function isVishwakarmaTrade(trade: string | null | undefined): boolean {
  if (!trade || typeof trade !== 'string') return false;
  const t = trade.toLowerCase().trim();

  // Keyword associations for each of the 18 traditional artisan trades
  const patterns: RegExp[] = [
    /carpent|woodcraft|furniture|suthar|badhai|timber craft/i, // Carpenter
    /boat|ship build|nauka/i, // Boat Maker
    /armour|weapon craft/i, // Armourer
    /blacksmith|iron work|iron craft|lohar/i, // Blacksmith
    /hammer|tool kit|tool maker/i, // Hammer and Tool Kit Maker
    /locksmith|key maker|chabi/i, // Locksmith
    /goldsmith|jewelry|jeweller|sonar|swarna/i, // Goldsmith
    /potter|pottery|clay|mrid|kumhar|kumhaar/i, // Potter
    /sculpt|stone carv|moorti|murti|stone break|shilp/i, // Sculptor / Stone carver
    /cobbler|shoesmith|footwear|leather craft|charmakar|mochi/i, // Cobbler
    /mason|bricklayer|construction artisan|rajmistri/i, // Mason
    /basket|mat|broom|coir|cane|bamboo|tokri/i, // Basket / Mat / Broom Maker
    /doll|toy|traditional toy|khilona/i, // Doll & Toy Maker
    /barber|haircut|salon|naai|napi/i, // Barber
    /garland|malakar|mala maker|flower artisan/i, // Garland Maker
    /washer|laundry|dhobi/i, // Washerman
    /tailor|tailoring|garment|stitching|darzi/i, // Tailor
    /fish.*net|jal bun/i, // Fishing Net Maker
  ];

  return patterns.some((p) => p.test(t));
}

/**
 * Master Registry of Government Loan & Subsidy Schemes.
 * Data compiled and cross-verified as of 2026-08-31 per Scheme Research Dossier.
 */
export const GOVERNMENT_SCHEMES: readonly SchemeDefinition[] = [
  // 1. Pradhan Mantri Mudra Yojana (PMMY)
  {
    id: 'pmmy_mudra',
    name: 'Pradhan Mantri Mudra Yojana (PMMY)',
    nameHi: 'प्रधानमंत्री मुद्रा योजना (PMMY)',
    shortName: 'Mudra / PMMY',
    ministry: 'Ministry of Finance / MUDRA / SIDBI',
    ministryHi: 'वित्त मंत्रालय / मुद्रा / सिडबी',
    targetGroup: 'Any non-farm micro/small enterprise (manufacturing, trading, services)',
    targetGroupHi: 'कोई भी गैर-कृषि सूक्ष्म/लघु उद्यम (विनिर्माण, व्यापार, सेवा)',
    benefitRange: {
      minAmount: 10000,
      maxAmount: 2000000,
      currency: 'INR',
      formattedRange: 'Up to ₹20 Lakh (4 Tiers)',
      formattedRangeHi: '₹20 लाख तक (4 श्रेणियां)',
      details: 'Shishu (up to ₹50k), Kishor (₹50k–₹5L), Tarun (₹5L–₹10L), Tarun Plus (₹10L–₹20L)',
      detailsHi: 'शिशु (₹50 हजार तक), किशोर (₹50 हजार-₹5 लाख), तरुण (₹5-₹10 लाख), तरुण प्लस (₹10-₹20 लाख)',
    },
    subsidyInfo: 'Bank-determined interest rate (no fixed rate); collateral-free up to ₹20 lakh',
    subsidyInfoHi: 'बैंक द्वारा निर्धारित ब्याज दर; ₹20 लाख तक कोई संपार्श्विक (कोलैटरल) आवश्यक नहीं',
    collateralRequirement: 'None (100% collateral-free up to ₹20 lakh)',
    collateralRequirementHi: 'शून्य (₹20 लाख तक पूरी तरह संपार्श्विक-मुक्त)',
    officialPortal: 'https://www.jansamarth.in',
    portalDisplayUrl: 'jansamarth.in | mudra.org.in',
    lastVerifiedDate: '2026-08-31',
    sources: ['jansamarth.in', 'mudra.org.in', 'PMMY Official Guidelines 2026'],
    documentsNeeded: [
      'Aadhaar card',
      'PAN card',
      'Business plan / project proposal',
      'Bank statements (if existing business)',
      'Passport-size photo',
      'Proof of business address',
    ],
    documentsNeededHi: [
      'आधार कार्ड',
      'पैन कार्ड',
      'व्यवसाय योजना / प्रस्ताव',
      'बैंक विवरण (यदि मौजूदा व्यवसाय है)',
      'पासपोर्ट आकार का फोटो',
      'व्यवसाय पते का प्रमाण',
    ],
    applicationProcess:
      'Apply online via Jan Samarth (jansamarth.in) or directly at any commercial bank, RRB, MFI, or cooperative bank branch.',
    applicationProcessHi:
      'जन समर्थ (jansamarth.in) के माध्यम से ऑनलाइन आवेदन करें या सीधे किसी भी बैंक शाखा, क्षेत्रीय ग्रामीण बैंक या एमएफआई में जाएं।',
  },

  // 2. Prime Minister's Employment Generation Programme (PMEGP)
  {
    id: 'pmegp',
    name: "Prime Minister's Employment Generation Programme (PMEGP)",
    nameHi: 'प्रधानमंत्री रोजगार सृजन कार्यक्रम (PMEGP)',
    shortName: 'PMEGP',
    ministry: 'Ministry of MSME / KVIC',
    ministryHi: 'सूक्ष्म, लघु एवं मध्यम उद्यम मंत्रालय / केवीआईसी',
    targetGroup: 'First-time entrepreneurs setting up brand-new (greenfield) micro-enterprises',
    targetGroupHi: 'ब्रांड-न्यू (ग्रीनफील्ड) सूक्ष्म उद्यम शुरू करने वाले नए उद्यमी',
    benefitRange: {
      minAmount: 100000,
      maxAmount: 5000000,
      currency: 'INR',
      formattedRange: 'Up to ₹50 Lakh (Mfg) / ₹20 Lakh (Service)',
      formattedRangeHi: '₹50 लाख तक (विनिर्माण) / ₹20 लाख तक (सेवा)',
      details: 'Manufacturing projects up to ₹50L; Service units up to ₹20L. Beneficiary contribution 5–10%',
      detailsHi: 'विनिर्माण परियोजनाएं ₹50 लाख तक; सेवा इकाइयां ₹20 लाख तक। लाभार्थी अंशदान 5–10%',
    },
    subsidyInfo:
      'Credit-linked margin money subsidy: 15% (urban) / 25% (rural) for General; 25% (urban) / 35% (rural) for Special categories (SC/ST/OBC/Women/Minorities/PwD)',
    subsidyInfoHi:
      'क्रेडिट-लिंक्ड मार्जिन मनी सब्सिडी: सामान्य श्रेणी के लिए 15% (शहरी) / 25% (ग्रामीण); विशेष श्रेणी (एससी/एसटी/ओबीसी/महिला) के लिए 25% (शहरी) / 35% (ग्रामीण)',
    collateralRequirement: 'None for projects up to ₹10 lakh (covered under CGTMSE)',
    collateralRequirementHi: '₹10 लाख तक की परियोजनाओं के लिए कोई संपार्श्विक आवश्यक नहीं',
    officialPortal: 'https://pmegp.msme.gov.in',
    portalDisplayUrl: 'pmegp.msme.gov.in | kviconline.gov.in',
    lastVerifiedDate: '2026-08-31',
    sources: ['pmegp.msme.gov.in', 'kviconline.gov.in', 'KVIC/MSME Operational Guidelines 2026'],
    documentsNeeded: [
      'Aadhaar card',
      'PAN card',
      'Detailed Project Report (DPR)',
      'Education proof (Class VIII pass for mfg > ₹10L / service > ₹5L)',
      'Caste/category certificate (if claiming special category subsidy)',
      'Rural area certificate (from Gram Panchayat if claiming rural subsidy)',
    ],
    documentsNeededHi: [
      'आधार कार्ड',
      'पैन कार्ड',
      'विस्तृत परियोजना रिपोर्ट (DPR)',
      'शैक्षणिक योग्यता (विनिर्माण > ₹10 लाख / सेवा > ₹5 लाख के लिए 8वीं पास)',
      'जाति/श्रेणी प्रमाण पत्र (यदि विशेष श्रेणी सब्सिडी का दावा कर रहे हैं)',
      'ग्रामीण क्षेत्र प्रमाण पत्र (ग्राम पंचायत से)',
    ],
    applicationProcess:
      'Apply online via KVIC e-portal (pmegp.msme.gov.in). District Level Task Force Committee (DLTFC) scrutinizes, bank sanctions, followed by mandatory EDP training.',
    applicationProcessHi:
      'केवीआईसी ई-पोर्टल (pmegp.msme.gov.in) पर ऑनलाइन आवेदन करें। जिला स्तरीय टास्क फोर्स द्वारा जांच, बैंक स्वीकृति और अनिवार्य उद्यमिता विकास प्रशिक्षण।',
  },

  // 3. Stand-Up India Scheme
  {
    id: 'standup_india',
    name: 'Stand-Up India Scheme',
    nameHi: 'स्टैंड-अप इंडिया योजना',
    shortName: 'Stand-Up India',
    ministry: 'Ministry of Finance / SIDBI',
    ministryHi: 'वित्त मंत्रालय / सिडबी',
    targetGroup: 'SC/ST individuals and Women entrepreneurs setting up greenfield enterprises',
    targetGroupHi: 'एससी/एसटी वर्ग और महिला उद्यमी जो नया (ग्रीनफील्ड) उद्यम शुरू कर रहे हैं',
    benefitRange: {
      minAmount: 1000000,
      maxAmount: 10000000,
      currency: 'INR',
      formattedRange: '₹10 Lakh to ₹1 Crore',
      formattedRangeHi: '₹10 लाख से ₹1 करोड़ तक',
      details: 'Composite loan comprising term loan and working capital for first-time ventures',
      detailsHi: 'नए उद्यमों के लिए सावधि ऋण (टर्म लोन) और कार्यशील पूंजी का समग्र ऋण',
    },
    subsidyInfo:
      "Concessional bank rate (MCLR + 3% + tenor premium); margin money 25% (convergeable with state schemes); Credit Guarantee Scheme (CGSSI) backing",
    subsidyInfoHi:
      'रियायती बैंक दर (MCLR + 3% + अवधि प्रीमियम); 25% मार्जिन मनी; क्रेडिट गारंटी योजना (CGSSI) द्वारा संरक्षित',
    collateralRequirement: 'Largely waived under Credit Guarantee Scheme for Stand-Up India (CGSSI)',
    collateralRequirementHi: 'स्टैंड-अप इंडिया क्रेडिट गारंटी योजना (CGSSI) के तहत अधिकांशतः छूट',
    officialPortal: 'https://www.standupmitra.in',
    portalDisplayUrl: 'standupmitra.in',
    lastVerifiedDate: '2026-08-31',
    sources: ['standupmitra.in', 'SIDBI Stand-Up India Directives 2026'],
    documentsNeeded: [
      'Aadhaar card',
      'PAN card',
      'Caste certificate (for SC/ST applicants)',
      'Detailed Project Report (DPR)',
      'Proof of 51% ownership/shareholding by SC/ST or woman (for non-individual entities)',
      'Clean credit history declaration',
    ],
    documentsNeededHi: [
      'आधार कार्ड',
      'पैन कार्ड',
      'जाति प्रमाण पत्र (एससी/एसटी आवेदकों के लिए)',
      'विस्तृत परियोजना रिपोर्ट (DPR)',
      '51% हिस्सेदारी/स्वामित्व का प्रमाण (गैर-व्यक्तिगत उद्यमों के लिए)',
      'स्वच्छ क्रेडिट इतिहास घोषणा',
    ],
    applicationProcess:
      'Apply online through Stand-Up Mitra portal (standupmitra.in). Select preferred bank branch, upload project proposal, branch reviews and disburses.',
    applicationProcessHi:
      'स्टैंड-अप मित्रा पोर्टल (standupmitra.in) के माध्यम से ऑनलाइन आवेदन करें। बैंक शाखा चुनें, दस्तावेज अपलोड करें, बैंक सत्यापन के बाद ऋण वितरित करता है।',
  },

  // 4. PM SVANidhi (Street Vendor's AtmaNirbhar Nidhi)
  {
    id: 'pm_svanidhi',
    name: "PM SVANidhi (Street Vendor's AtmaNirbhar Nidhi)",
    nameHi: 'पीएम स्वनिधि (स्ट्रीट वेंडर्स आत्मनिर्भर निधि)',
    shortName: 'PM SVANidhi',
    ministry: 'Ministry of Housing and Urban Affairs (MoHUA)',
    ministryHi: 'आवासन और शहरी कार्य मंत्रालय (MoHUA)',
    targetGroup: 'Urban and peri-urban informal street vendors and hawkers',
    targetGroupHi: 'शहरी और अर्ध-शहरी क्षेत्रों के स्ट्रीट वेंडर और रेहड़ी-पटरी विक्रेता',
    benefitRange: {
      minAmount: 10000,
      maxAmount: 50000,
      currency: 'INR',
      formattedRange: '₹10,000 to ₹50,000 (3 Tranches)',
      formattedRangeHi: '₹10,000 से ₹50,000 (3 किस्तें)',
      details: 'Tranche 1: ₹10k–₹15k | Tranche 2: ₹20k–₹25k (on timely repayment) | Tranche 3: Up to ₹50k',
      detailsHi: 'पहली किस्त: ₹10-15 हजार | दूसरी किस्त: ₹20-25 हजार | तीसरी किस्त: ₹50 हजार तक',
    },
    subsidyInfo:
      '7% per annum interest subsidy credited quarterly; digital transaction cashback up to ₹1,200/year (₹100/month)',
    subsidyInfoHi:
      'त्रैमासिक जमा की जाने वाली 7% वार्षिक ब्याज सब्सिडी; यूपीआई उपयोग पर ₹1,200/वर्ष तक डिजिटल कैशबैक',
    collateralRequirement: 'None (100% collateral-free working capital loan)',
    collateralRequirementHi: 'शून्य (100% संपार्श्विक-मुक्त कार्यशील पूंजी ऋण)',
    officialPortal: 'https://pmsvanidhi.mohua.gov.in',
    portalDisplayUrl: 'pmsvanidhi.mohua.gov.in',
    lastVerifiedDate: '2026-08-31',
    sources: ['pmsvanidhi.mohua.gov.in', 'MoHUA Scheme Operational Guidelines 2026'],
    documentsNeeded: [
      'Aadhaar-linked mobile number',
      'Certificate of Vending (CoV) or Identity Card issued by Urban Local Body (ULB)',
      'Letter of Recommendation (LoR) from ULB / Town Vending Committee (if CoV not yet issued)',
      'Bank savings account details',
    ],
    documentsNeededHi: [
      'आधार से जुड़ा मोबाइल नंबर',
      'शहरी स्थानीय निकाय (ULB) द्वारा जारी वेंडिंग प्रमाण पत्र या पहचान पत्र',
      'यूएलबी/टाउन वेंडिंग कमेटी से सिफारिश पत्र (LoR)',
      'बैंक बचत खाता विवरण',
    ],
    applicationProcess:
      'Apply online at pmsvanidhi.mohua.gov.in or via nearest Urban Local Body (ULB) / Common Service Centre (CSC). Disbursed through partner banks/MFIs.',
    applicationProcessHi:
      'pmsvanidhi.mohua.gov.in पर या नजदीकी शहरी निकाय/सीएससी पर ऑनलाइन आवेदन करें। भागीदार बैंकों द्वारा प्रत्यक्ष संवितरण।',
  },

  // 5. PM Vishwakarma Yojana
  {
    id: 'pm_vishwakarma',
    name: 'PM Vishwakarma Yojana',
    nameHi: 'प्रधानमंत्री विश्वकर्मा योजना',
    shortName: 'PM Vishwakarma',
    ministry: 'Ministry of MSME',
    ministryHi: 'सूक्ष्म, लघु एवं मध्यम उद्यम मंत्रालय',
    targetGroup: 'Traditional artisans and craftspeople practicing one of 18 recognized family trades',
    targetGroupHi: '18 मान्यता प्राप्त पारंपरिक व्यवसायों में कार्यरत कारीगर और शिल्पकार',
    benefitRange: {
      minAmount: 100000,
      maxAmount: 300000,
      currency: 'INR',
      formattedRange: 'Up to ₹3 Lakh (2 Tranches) + ₹15k Toolkit',
      formattedRangeHi: '₹3 लाख तक (2 किस्तें) + ₹15 हजार टूलकिट',
      details: 'Tranche 1: Up to ₹1 Lakh (18-mo repayment) | Tranche 2: Up to ₹2 Lakh (30-mo repayment)',
      detailsHi: 'पहली किस्त: ₹1 लाख तक (18 माह) | दूसरी किस्त: ₹2 लाख तक (30 माह)',
    },
    subsidyInfo:
      'Concessional fixed 5% interest rate + ₹15,000 modern toolkit e-voucher + basic/advanced skill training with ₹500/day stipend + ₹1/digital transaction incentive',
    subsidyInfoHi:
      'रियायती निश्चित 5% ब्याज दर + ₹15,000 आधुनिक टूलकिट ई-वाउचर + ₹500/दिन वजीफे के साथ कौशल प्रशिक्षण + ₹1 प्रति डिजिटल लेनदेन प्रोत्साहन',
    collateralRequirement: 'None (100% collateral-free credit support)',
    collateralRequirementHi: 'शून्य (100% संपार्श्विक-मुक्त ऋण सहायता)',
    officialPortal: 'https://pmvishwakarma.gov.in',
    portalDisplayUrl: 'pmvishwakarma.gov.in',
    lastVerifiedDate: '2026-08-31',
    sources: ['pmvishwakarma.gov.in', 'Ministry of MSME Guidelines 2026'],
    documentsNeeded: [
      'Aadhaar card (biometric verification required at CSC)',
      'Proof of practicing one of 18 recognized traditional trades',
      'Active mobile number linked with Aadhaar',
      'Bank account details',
      'Ration card / family details declaration',
    ],
    documentsNeededHi: [
      'आधार कार्ड (सीएससी पर बायोमेट्रिक सत्यापन)',
      '18 मान्यता प्राप्त पारंपरिक व्यवसायों में से एक के संचालन का प्रमाण',
      'आधार से जुड़ा सक्रिय मोबाइल नंबर',
      'बैंक खाता विवरण',
      'राशन कार्ड / पारिवारिक घोषणा',
    ],
    applicationProcess:
      'Registration done via nearest Common Service Centre (CSC) with Aadhaar biometric verification. Multi-stage verification by Gram Panchayat / ULB, DPMAC, and State Screening Committee, followed by Skill Training and loan sanction.',
    applicationProcessHi:
      'नजदीकी सीएससी (CSC) पर बायोमेट्रिक सत्यापन के साथ पंजीकरण। ग्राम पंचायत/यूएलबी और जिला स्तरीय समिति द्वारा सत्यापन, कौशल प्रशिक्षण और ऋण स्वीकृति।',
  },

  // 6. DAY-NRLM / Lakhpati Didi
  {
    id: 'day_nrlm',
    name: 'Deendayal Antyodaya Yojana – NRLM (Lakhpati Didi)',
    nameHi: 'दीनदयाल अंत्योदय योजना - एनआरएलएम (लखपति दीदी)',
    shortName: 'DAY-NRLM / Lakhpati Didi',
    ministry: 'Ministry of Rural Development (MoRD)',
    ministryHi: 'ग्रामीण विकास मंत्रालय (MoRD)',
    targetGroup: 'Rural women entrepreneurs organised into Self-Help Groups (SHGs)',
    targetGroupHi: 'स्वयं सहायता समूहों (SHG) में संगठित ग्रामीण महिला उद्यमी',
    benefitRange: {
      minAmount: 50000,
      maxAmount: 1000000,
      currency: 'INR',
      formattedRange: 'Up to ₹10 Lakh (SHG) / ₹5 Lakh (Lakhpati Didi)',
      formattedRangeHi: '₹10 लाख तक (एसएचजी) / ₹5 लाख तक (लखपति दीदी)',
      details: 'Individual SHG members up to ₹10 Lakh; Women Enterprise Acceleration loans up to ₹5 Lakh',
      detailsHi: 'व्यक्तिगत एसएचजी सदस्यों के लिए ₹10 लाख तक; महिला उद्यम त्वरण ऋण ₹5 लाख तक',
    },
    subsidyInfo:
      '2% interest subvention on qualifying loans up to ₹1.5 Lakh for 3 years + Community Investment Support Fund (CIF) capital',
    subsidyInfoHi:
      '3 वर्षों के लिए ₹1.5 लाख तक के पात्र ऋणों पर 2% ब्याज अनुदान + सामुदायिक निवेश सहायता निधि (CIF)',
    collateralRequirement: 'None (Group guarantee backed by Self-Help Group collective)',
    collateralRequirementHi: 'शून्य (स्वयं सहायता समूह द्वारा सामूहिक गारंटी आधारित)',
    officialPortal: 'https://www.jansamarth.in',
    portalDisplayUrl: 'jansamarth.in | nrlm.gov.in',
    lastVerifiedDate: '2026-08-31',
    sources: ['jansamarth.in', 'nrlm.gov.in', 'MoRD Lakhpati Didi Directives 2026'],
    documentsNeeded: [
      'Aadhaar card',
      'SHG membership proof / passbook',
      'SHG resolution and meeting savings record (Panchasutras compliance)',
      'Livelihood micro-business plan',
      'Bank savings account details',
    ],
    documentsNeededHi: [
      'आधार कार्ड',
      'एसएचजी सदस्यता प्रमाण / पासबुक',
      'एसएचजी प्रस्ताव और बैठक बचत रिकॉर्ड (पंचसूत्र अनुपालन)',
      'आजीविका सूक्ष्म व्यवसाय योजना',
      'बैंक बचत खाता विवरण',
    ],
    applicationProcess:
      'Apply through Village Organisation (VO) / Cluster Level Federation (CLF) of the SHG, facilitated by State Rural Livelihood Mission (SRLM) and Jan Samarth portal.',
    applicationProcessHi:
      'ग्राम संगठन (VO) या संकुल स्तरीय संघ (CLF) के माध्यम से आवेदन करें, जिसे राज्य ग्रामीण आजीविका मिशन द्वारा बैंक लिंकेज किया जाता है।',
  },

  // 7. Preserved MoSJE Scheme: NBCFDC Concessional Term Loan
  {
    id: 'nbcfdc_term_loan',
    name: 'NBCFDC Concessional Term Loan',
    nameHi: 'एनबीसीएफडीसी रियायती सावधि ऋण',
    shortName: 'NBCFDC Loan',
    ministry: 'Ministry of Social Justice & Empowerment (MoSJE)',
    ministryHi: 'सामाजिक न्याय और अधिकारिता मंत्रालय (MoSJE)',
    targetGroup: 'OBC rural and urban micro-entrepreneurs living below the double-poverty line',
    targetGroupHi: 'अन्य पिछड़ा वर्ग (OBC) के ग्रामीण और शहरी सूक्ष्म उद्यमी',
    benefitRange: {
      minAmount: 50000,
      maxAmount: 500000,
      currency: 'INR',
      formattedRange: 'Up to ₹5 Lakh',
      formattedRangeHi: '₹5 लाख तक',
      details: 'Term loan up to ₹5,00,000 for income-generating self-employment activities',
      detailsHi: 'आय सृजन गतिविधियों के लिए ₹5,00,000 तक का सावधि ऋण',
    },
    subsidyInfo: 'Concessional interest rate at 6% per annum through State Channelizing Agencies (SCAs)',
    subsidyInfoHi: 'राज्य चैनेलाइजिंग एजेंसियों (SCA) के माध्यम से 6% वार्षिक रियायती ब्याज दर',
    collateralRequirement: 'As per State Channelizing Agency norms (simplified for micro loans)',
    collateralRequirementHi: 'राज्य चैनेलाइजिंग एजेंसी मानकों के अनुसार (सूक्ष्म ऋणों के लिए सरल)',
    officialPortal: 'https://nbcfdc.gov.in',
    portalDisplayUrl: 'nbcfdc.gov.in | jansamarth.in',
    lastVerifiedDate: '2026-08-31',
    sources: ['nbcfdc.gov.in', 'MoSJE Concessional Finance Norms 2026'],
    documentsNeeded: [
      'Aadhaar card',
      'OBC Caste certificate issued by competent revenue authority',
      'Income certificate proving annual household income under ₹3,00,000',
      'Project proposal / business description',
      'Bank account details',
    ],
    documentsNeededHi: [
      'आधार कार्ड',
      'सक्षम प्राधिकारी द्वारा जारी ओबीसी जाति प्रमाण पत्र',
      'वार्षिक पारिवारिक आय ₹3,00,000 से कम होने का आय प्रमाण पत्र',
      'परियोजना प्रस्ताव / व्यवसाय विवरण',
      'बैंक खाता विवरण',
    ],
    applicationProcess:
      'Apply through State Channelizing Agency (SCA) office in district headquarters or through Jan Samarth portal.',
    applicationProcessHi:
      'जिला मुख्यालय में राज्य चैनेलाइजिंग एजेंसी (SCA) कार्यालय या जन समर्थ पोर्टल के माध्यम से आवेदन करें।',
  },

  // 8. Preserved MoSJE Scheme: NSFDC Concessional Credit
  {
    id: 'nsfdc_term_loan',
    name: 'NSFDC Concessional Credit (National Scheduled Castes Corporation)',
    nameHi: 'एनएसएफडीसी रियायती ऋण (राष्ट्रीय अनुसूचित जाति निगम)',
    shortName: 'NSFDC Credit',
    ministry: 'Ministry of Social Justice & Empowerment (MoSJE)',
    ministryHi: 'सामाजिक न्याय और अधिकारिता मंत्रालय (MoSJE)',
    targetGroup: 'Scheduled Caste (SC) micro-entrepreneurs',
    targetGroupHi: 'अनुसूचित जाति (SC) के सूक्ष्म उद्यमी',
    benefitRange: {
      minAmount: 50000,
      maxAmount: 1500000,
      currency: 'INR',
      formattedRange: 'Up to ₹15 Lakh',
      formattedRangeHi: '₹15 लाख तक',
      details: 'Funding up to 95% of project cost for viable self-employment micro-units',
      detailsHi: 'व्यवहार्य स्व-रोजगार सूक्ष्म इकाइयों के लिए परियोजना लागत का 95% तक वित्तपोषण',
    },
    subsidyInfo: 'Concessional interest rate between 6% to 8% p.a. through SC State Corporations',
    subsidyInfoHi: 'एससी राज्य निगमों के माध्यम से 6% से 8% वार्षिक रियायती ब्याज दर',
    collateralRequirement: 'Waived or minimal as per SCA guidelines',
    collateralRequirementHi: 'राज्य निगम के दिशा-निर्देशों के अनुसार न्यूनतम या छूट',
    officialPortal: 'https://nsfdc.nic.in',
    portalDisplayUrl: 'nsfdc.nic.in',
    lastVerifiedDate: '2026-08-31',
    sources: ['nsfdc.nic.in', 'MoSJE Directives 2026'],
    documentsNeeded: [
      'Aadhaar card',
      'SC Caste certificate issued by competent authority',
      'Family income certificate proving income under ₹3,00,000 p.a.',
      'Project proposal',
      'Bank details',
    ],
    documentsNeededHi: [
      'आधार कार्ड',
      'सक्षम प्राधिकारी द्वारा जारी एससी जाति प्रमाण पत्र',
      'वार्षिक पारिवारिक आय ₹3,00,000 से कम होने का आय प्रमाण पत्र',
      'परियोजना प्रस्ताव',
      'बैंक खाता विवरण',
    ],
    applicationProcess:
      'Apply through State Scheduled Castes Development Corporation (SCDC) or channelizing bank branch.',
    applicationProcessHi:
      'राज्य अनुसूचित जाति विकास निगम (SCDC) या अधिकृत बैंक शाखा के माध्यम से आवेदन करें।',
  },
];

/**
 * Deterministically evaluates a single scheme against a user profile.
 */
export function evaluateSingleScheme(
  scheme: SchemeDefinition,
  profile: UserEligibilityProfile,
): SchemeEvaluationResult {
  const matchedCriteria: string[] = [];
  const matchedCriteriaHi: string[] = [];
  const unmetCriteria: string[] = [];
  const unmetCriteriaHi: string[] = [];
  const pendingCriteria: string[] = [];
  const pendingCriteriaHi: string[] = [];

  // --------------------------------------------------------------------------
  // Rule A: Minimum Age Check (Common to all schemes: age >= 18)
  // --------------------------------------------------------------------------
  if (profile.age !== null && profile.age !== undefined) {
    if (profile.age >= 18) {
      matchedCriteria.push(`Applicant is an adult (${profile.age} years old; minimum 18 required).`);
      matchedCriteriaHi.push(`आवेदक वयस्क है (${profile.age} वर्ष; न्यूनतम 18 वर्ष आवश्यक)।`);
    } else {
      unmetCriteria.push(`Applicant age is ${profile.age} years (minimum 18 years required).`);
      unmetCriteriaHi.push(`आवेदक की आयु ${profile.age} वर्ष है (न्यूनतम 18 वर्ष आवश्यक)।`);
    }
  } else {
    pendingCriteria.push('Age verification required (must be 18 years or older).');
    pendingCriteriaHi.push('आयु सत्यापन आवश्यक (18 वर्ष या उससे अधिक होना चाहिए)।');
  }

  // --------------------------------------------------------------------------
  // Scheme-Specific Rules
  // --------------------------------------------------------------------------
  switch (scheme.id) {
    case 'pmmy_mudra': {
      // PMMY is open to any citizen with a non-farm micro-enterprise
      matchedCriteria.push('Open to all Indian citizens; no reserved category requirement.');
      matchedCriteriaHi.push('सभी भारतीय नागरिकों के लिए खुला; कोई आरक्षित श्रेणी आवश्यकता नहीं।');
      matchedCriteria.push('Eligible for both newly proposed and existing operating micro-enterprises.');
      matchedCriteriaHi.push('नए प्रस्तावित और मौजूदा दोनों प्रकार के सूक्ष्म उद्यमों के लिए पात्र।');
      break;
    }

    case 'pmegp': {
      // PMEGP strictly requires GREENFIELD / NEW enterprise
      if (profile.isNewEnterprise === false) {
        unmetCriteria.push(
          'PMEGP strictly requires a brand-new (greenfield) enterprise. Existing operational units are not eligible.',
        );
        unmetCriteriaHi.push(
          'PMEGP केवल ब्रांड-न्यू (ग्रीनफील्ड) उद्यमों के लिए है। मौजूदा इकाइयां पात्र नहीं हैं।',
        );
      } else if (profile.isNewEnterprise === true) {
        matchedCriteria.push('Proposal is for a brand-new (greenfield) enterprise.');
        matchedCriteriaHi.push('प्रस्ताव एक नए (ग्रीनफील्ड) उद्यम की स्थापना के लिए है।');
      } else {
        pendingCriteria.push(
          'Requires confirmation that the project is a brand-new setup (existing units are ineligible).',
        );
        pendingCriteriaHi.push(
          'परियोजना के नए सेटअप होने की पुष्टि आवश्यक है (मौजूदा इकाइयां पात्र नहीं हैं)।',
        );
      }

      // Special category subsidy note
      if (
        profile.socialCategory === 'sc' ||
        profile.socialCategory === 'st' ||
        profile.socialCategory === 'obc' ||
        profile.socialCategory === 'minority' ||
        profile.gender === 'female'
      ) {
        matchedCriteria.push('Eligible for higher Special Category margin money subsidy (25% urban / 35% rural).');
        matchedCriteriaHi.push('उच्च विशेष श्रेणी मार्जिन मनी सब्सिडी (25% शहरी / 35% ग्रामीण) के लिए पात्र।');
      }
      break;
    }

    case 'standup_india': {
      // Stand-Up India strictly requires: SC/ST OR Woman entrepreneur
      const isScOrSt = profile.socialCategory === 'sc' || profile.socialCategory === 'st';
      const isWoman = profile.gender === 'female';

      if (isScOrSt || isWoman) {
        matchedCriteria.push(
          isWoman && isScOrSt
            ? 'Satisfies both SC/ST category and Woman entrepreneur requirements.'
            : isWoman
            ? 'Satisfies Woman entrepreneur eligibility mandate.'
            : 'Satisfies SC/ST entrepreneur eligibility mandate.',
        );
        matchedCriteriaHi.push(
          isWoman && isScOrSt
            ? 'एससी/एसटी वर्ग और महिला उद्यमी दोनों अनिवार्यताओं को पूरा करता है।'
            : isWoman
            ? 'महिला उद्यमी पात्रता अनिवार्यता को पूरा करता है।'
            : 'एससी/एसटी उद्यमी पात्रता अनिवार्यता को पूरा करता है।',
        );
      } else if (
        profile.gender === 'male' &&
        (profile.socialCategory === 'general' || profile.socialCategory === 'obc')
      ) {
        unmetCriteria.push(
          'Stand-Up India is strictly restricted to SC/ST individuals or Women entrepreneurs.',
        );
        unmetCriteriaHi.push(
          'स्टैंड-अप इंडिया योजना केवल एससी/एसटी वर्ग या महिला उद्यमियों के लिए आरक्षित है।',
        );
      } else {
        pendingCriteria.push(
          'Requires verification of SC/ST caste certificate or Woman entrepreneur ownership (>= 51%).',
        );
        pendingCriteriaHi.push(
          'एससी/एसटी जाति प्रमाण पत्र या महिला उद्यमी स्वामित्व (>= 51%) का सत्यापन आवश्यक है।',
        );
      }

      // Stand-Up India also requires greenfield
      if (profile.isNewEnterprise === false) {
        unmetCriteria.push(
          'Stand-Up India is strictly for first-time (greenfield) enterprises; cannot be used to expand an existing business.',
        );
        unmetCriteriaHi.push(
          'स्टैंड-अप इंडिया केवल नए (ग्रीनफील्ड) उद्यमों के लिए है; मौजूदा व्यवसाय के विस्तार के लिए उपयोग नहीं किया जा सकता।',
        );
      } else if (profile.isNewEnterprise === true) {
        matchedCriteria.push('Proposal is for a first-time (greenfield) venture.');
        matchedCriteriaHi.push('प्रस्ताव पहली बार (ग्रीनफील्ड) उद्यम के लिए है।');
      } else {
        pendingCriteria.push(
          'Requires confirmation that the venture is greenfield (first-time).',
        );
        pendingCriteriaHi.push(
          'उद्यम के ग्रीनफील्ड (पहली बार) होने की पुष्टि आवश्यक है।',
        );
      }
      break;
    }

    case 'pm_svanidhi': {
      // PM SVANidhi strictly requires Street Vendor status
      if (profile.isStreetVendor === true || profile.hasVendingCertificate === true) {
        matchedCriteria.push(
          profile.hasVendingCertificate
            ? 'Holds Certificate of Vending (CoV) / LoR from Urban Local Body.'
            : 'Identified as an informal street vendor / hawker.',
        );
        matchedCriteriaHi.push(
          profile.hasVendingCertificate
            ? 'शहरी निकाय से वेंडिंग प्रमाण पत्र (CoV) या सिफारिश पत्र धारक।'
            : 'रेहड़ी-पटरी विक्रेता / स्ट्रीट वेंडर के रूप में सत्यापित।',
        );
      } else if (profile.isStreetVendor === false) {
        unmetCriteria.push(
          'PM SVANidhi is strictly targeted at informal street vendors holding a Certificate of Vending or ULB recommendation.',
        );
        unmetCriteriaHi.push(
          'पीएम स्वनिधि विशेष रूप से वेंडिंग प्रमाण पत्र या निकाय सिफारिश रखने वाले स्ट्रीट वेंडरों के लिए है।',
        );
      } else {
        pendingCriteria.push(
          'Requires confirmation of street vendor status / Certificate of Vending (CoV) from Urban Local Body.',
        );
        pendingCriteriaHi.push(
          'स्ट्रीट वेंडर स्थिति या शहरी निकाय से वेंडिंग प्रमाण पत्र की पुष्टि आवश्यक है।',
        );
      }

      // Location check
      if (profile.locationType === 'rural') {
        unmetCriteria.push(
          'PM SVANidhi is primarily designed for urban and peri-urban vendors covered under Urban Local Bodies (ULBs).',
        );
        unmetCriteriaHi.push(
          'पीएम स्वनिधि मुख्य रूप से शहरी और अर्ध-शहरी निकायों के तहत वेंडरों के लिए बनाई गई है।',
        );
      }
      break;
    }

    case 'pm_vishwakarma': {
      // 1. Traditional Trade Match
      const matchesTrade = isVishwakarmaTrade(profile.trade);
      if (matchesTrade) {
        matchedCriteria.push(
          `Trade "${profile.trade}" belongs to one of the 18 recognized traditional artisan/craft trades.`,
        );
        matchedCriteriaHi.push(
          `व्यवसाय "${profile.trade}" 18 मान्यता प्राप्त पारंपरिक शिल्प व्यवसायों में शामिल है।`,
        );
      } else if (profile.trade !== null && profile.trade !== undefined) {
        unmetCriteria.push(
          `Trade "${profile.trade}" is not among the 18 recognized traditional trades under PM Vishwakarma.`,
        );
        unmetCriteriaHi.push(
          `व्यवसाय "${profile.trade}" पीएम विश्वकर्मा के 18 पारंपरिक शिल्पों में शामिल नहीं है।`,
        );
      } else {
        pendingCriteria.push(
          'Requires confirmation that applicant practices one of the 18 recognized traditional artisan trades.',
        );
        pendingCriteriaHi.push(
          'आवेदक द्वारा 18 मान्यता प्राप्त पारंपरिक शिल्पों में से एक का संचालन करने की पुष्टि आवश्यक है।',
        );
      }

      // 2. DEMONSTRABLE CROSS-SCHEME 5-YEAR COOLDOWN RULE
      // "applicant must not have taken a loan under PMEGP, Mudra or SVANidhi in the last 5 years"
      if (profile.hasAvailedMudraPmegpSvanidhiLast5Years === true) {
        unmetCriteria.push(
          'Ineligible due to 5-year cooldown rule: Applicant has availed a loan under PMEGP, Mudra, or PM SVANidhi within the last 5 years.',
        );
        unmetCriteriaHi.push(
          '5 साल का कूलडाउन नियम: आवेदक ने पिछले 5 वर्षों में PMEGP, मुद्रा या पीएम स्वनिधि के तहत ऋण लिया है।',
        );
      } else if (profile.hasAvailedMudraPmegpSvanidhiLast5Years === false) {
        matchedCriteria.push(
          'No prior loan taken under Mudra, PMEGP, or PM SVANidhi in the last 5 years (complies with 5-year cooldown rule).',
        );
        matchedCriteriaHi.push(
          'पिछले 5 वर्षों में मुद्रा, PMEGP या स्वनिधि से कोई ऋण नहीं लिया गया (5-वर्षीय कूलडाउन नियम का अनुपालन)।',
        );
      } else {
        pendingCriteria.push(
          'Requires declaration: no loan taken under Mudra, PMEGP, or PM SVANidhi within the last 5 years (5-year cooldown rule).',
        );
        pendingCriteriaHi.push(
          'घोषणा आवश्यक: पिछले 5 वर्षों में मुद्रा, PMEGP या स्वनिधि के तहत कोई ऋण नहीं लिया गया (5 साल का नियम)।',
        );
      }
      break;
    }

    case 'day_nrlm': {
      // 1. Gender: Female only
      if (profile.gender === 'female') {
        matchedCriteria.push('Applicant is female (DAY-NRLM / Lakhpati Didi is exclusively for women).');
        matchedCriteriaHi.push('आवेदक महिला हैं (DAY-NRLM / लखपति दीदी विशेष रूप से महिलाओं के लिए है)।');
      } else if (profile.gender === 'male') {
        unmetCriteria.push('DAY-NRLM / Lakhpati Didi credit facilities are exclusively reserved for women entrepreneurs.');
        unmetCriteriaHi.push('DAY-NRLM / लखपति दीदी ऋण सुविधाएं केवल महिला उद्यमियों के लिए आरक्षित हैं।');
      } else {
        pendingCriteria.push('Requires verification of Woman entrepreneur status.');
        pendingCriteriaHi.push('महिला उद्यमी स्थिति का सत्यापन आवश्यक है।');
      }

      // 2. Rural location
      if (profile.locationType === 'rural') {
        matchedCriteria.push('Located in rural area (National Rural Livelihoods Mission jurisdiction).');
        matchedCriteriaHi.push('ग्रामीण क्षेत्र में स्थित (राष्ट्रीय ग्रामीण आजीविका मिशन का अधिकार क्षेत्र)।');
      } else if (profile.locationType === 'urban') {
        unmetCriteria.push('DAY-NRLM is strictly designed for rural areas (urban enterprises are covered under DAY-NULM).');
        unmetCriteriaHi.push('DAY-NRLM केवल ग्रामीण क्षेत्रों के लिए है (शहरी उद्यम DAY-NULM के अंतर्गत आते हैं)।');
      } else {
        pendingCriteria.push('Requires confirmation of rural location.');
        pendingCriteriaHi.push('ग्रामीण क्षेत्र में स्थिति की पुष्टि आवश्यक है।');
      }

      // 3. SHG Membership
      if (profile.isShgMember === true) {
        matchedCriteria.push('Active member of a qualifying rural Women Self-Help Group (SHG).');
        matchedCriteriaHi.push('योग्य ग्रामीण महिला स्वयं सहायता समूह (SHG) की सक्रिय सदस्य।');
      } else if (profile.isShgMember === false) {
        unmetCriteria.push('Requires active membership in a qualified rural Self-Help Group (SHG).');
        unmetCriteriaHi.push('ग्रामीण स्वयं सहायता समूह (SHG) में सक्रिय सदस्यता अनिवार्य है।');
      } else {
        pendingCriteria.push('Requires confirmation of Women Self-Help Group (SHG) membership.');
        pendingCriteriaHi.push('महिला स्वयं सहायता समूह (SHG) की सदस्यता की पुष्टि आवश्यक है।');
      }
      break;
    }

    case 'nbcfdc_term_loan': {
      // 1. Category: OBC
      if (profile.socialCategory === 'obc') {
        matchedCriteria.push('Belongs to Other Backward Classes (OBC) category.');
        matchedCriteriaHi.push('अन्य पिछड़ा वर्ग (OBC) श्रेणी से संबंधित।');
      } else if (profile.socialCategory !== null && profile.socialCategory !== undefined) {
        unmetCriteria.push('NBCFDC schemes are exclusively for Other Backward Classes (OBC).');
        unmetCriteriaHi.push('एनबीसीएफडीसी योजनाएं केवल अन्य पिछड़ा वर्ग (OBC) के लिए हैं।');
      } else {
        pendingCriteria.push('Requires OBC category caste certificate verification.');
        pendingCriteriaHi.push('ओबीसी जाति प्रमाण पत्र का सत्यापन आवश्यक है।');
      }

      // 2. Income ceiling: <= 3,00,000
      if (profile.annualHouseholdIncome !== null && profile.annualHouseholdIncome !== undefined) {
        if (profile.annualHouseholdIncome <= 300000) {
          matchedCriteria.push(`Annual family income ₹${profile.annualHouseholdIncome.toLocaleString('en-IN')} is within ₹3,00,000 ceiling.`);
          matchedCriteriaHi.push(`वार्षिक पारिवारिक आय ₹${profile.annualHouseholdIncome.toLocaleString('en-IN')} ₹3,00,000 की सीमा के भीतर है।`);
        } else {
          unmetCriteria.push(`Annual family income ₹${profile.annualHouseholdIncome.toLocaleString('en-IN')} exceeds ₹3,00,000 ceiling.`);
          unmetCriteriaHi.push(`वार्षिक पारिवारिक आय ₹${profile.annualHouseholdIncome.toLocaleString('en-IN')} ₹3,00,000 की सीमा से अधिक है।`);
        }
      } else {
        pendingCriteria.push('Requires income certificate proving annual household income under ₹3,00,000.');
        pendingCriteriaHi.push('वार्षिक पारिवारिक आय ₹3,00,000 से कम होने का आय प्रमाण पत्र आवश्यक है।');
      }
      break;
    }

    case 'nsfdc_term_loan': {
      // 1. Category: SC
      if (profile.socialCategory === 'sc') {
        matchedCriteria.push('Belongs to Scheduled Caste (SC) category.');
        matchedCriteriaHi.push('अनुसूचित जाति (SC) श्रेणी से संबंधित।');
      } else if (profile.socialCategory !== null && profile.socialCategory !== undefined) {
        unmetCriteria.push('NSFDC schemes are exclusively for Scheduled Caste (SC) entrepreneurs.');
        unmetCriteriaHi.push('एनएसएफडीसी योजनाएं केवल अनुसूचित जाति (SC) के उद्यमियों के लिए हैं।');
      } else {
        pendingCriteria.push('Requires SC category caste certificate verification.');
        pendingCriteriaHi.push('एससी जाति प्रमाण पत्र का सत्यापन आवश्यक है।');
      }

      // 2. Income ceiling: <= 3,00,000
      if (profile.annualHouseholdIncome !== null && profile.annualHouseholdIncome !== undefined) {
        if (profile.annualHouseholdIncome <= 300000) {
          matchedCriteria.push(`Annual family income ₹${profile.annualHouseholdIncome.toLocaleString('en-IN')} is within ₹3,00,000 ceiling.`);
          matchedCriteriaHi.push(`वार्षिक पारिवारिक आय ₹${profile.annualHouseholdIncome.toLocaleString('en-IN')} ₹3,00,000 की सीमा के भीतर है।`);
        } else {
          unmetCriteria.push(`Annual family income ₹${profile.annualHouseholdIncome.toLocaleString('en-IN')} exceeds ₹3,00,000 ceiling.`);
          unmetCriteriaHi.push(`वार्षिक पारिवारिक आय ₹${profile.annualHouseholdIncome.toLocaleString('en-IN')} ₹3,00,000 की सीमा से अधिक है।`);
        }
      } else {
        pendingCriteria.push('Requires income certificate proving annual household income under ₹3,00,000.');
        pendingCriteriaHi.push('वार्षिक पारिवारिक आय ₹3,00,000 से कम होने का आय प्रमाण पत्र आवश्यक है।');
      }
      break;
    }
  }

  // --------------------------------------------------------------------------
  // Determine Final Eligibility Status
  // --------------------------------------------------------------------------
  let status: SchemeEligibilityStatus;
  if (unmetCriteria.length > 0) {
    status = 'not_eligible';
  } else if (pendingCriteria.length > 0) {
    status = 'potentially_eligible';
  } else {
    status = 'eligible';
  }

  // Suitability score for sorting (Eligible > Potentially Eligible > Not Eligible)
  let suitabilityScore = 0;
  if (status === 'eligible') {
    suitabilityScore = 1000 + matchedCriteria.length * 10 + scheme.benefitRange.maxAmount / 100000;
  } else if (status === 'potentially_eligible') {
    suitabilityScore = 500 + matchedCriteria.length * 5 + scheme.benefitRange.maxAmount / 100000;
  } else {
    suitabilityScore = 0;
  }

  return {
    schemeId: scheme.id,
    name: scheme.name,
    nameHi: scheme.nameHi,
    shortName: scheme.shortName,
    ministry: scheme.ministry,
    ministryHi: scheme.ministryHi,
    targetGroup: scheme.targetGroup,
    targetGroupHi: scheme.targetGroupHi,
    status,
    matchedCriteria,
    matchedCriteriaHi,
    unmetCriteria,
    unmetCriteriaHi,
    pendingCriteria,
    pendingCriteriaHi,
    benefitRange: scheme.benefitRange,
    subsidyInfo: scheme.subsidyInfo,
    subsidyInfoHi: scheme.subsidyInfoHi,
    collateralRequirement: scheme.collateralRequirement,
    collateralRequirementHi: scheme.collateralRequirementHi,
    officialPortal: scheme.officialPortal,
    portalDisplayUrl: scheme.portalDisplayUrl,
    lastVerifiedDate: scheme.lastVerifiedDate,
    sources: scheme.sources,
    documentsNeeded: scheme.documentsNeeded,
    documentsNeededHi: scheme.documentsNeededHi,
    applicationProcess: scheme.applicationProcess,
    applicationProcessHi: scheme.applicationProcessHi,
    suitabilityScore,
  };
}

/**
 * Deterministically evaluates all registered government schemes against a user profile.
 * Returns all evaluated schemes sorted by suitability:
 * 1. Definitive matches ('eligible')
 * 2. Plausible candidates ('potentially_eligible')
 * 3. Disqualified schemes ('not_eligible')
 */
export function evaluateAllSchemes(profile: UserEligibilityProfile): SchemeEvaluationResult[] {
  const results = GOVERNMENT_SCHEMES.map((scheme) => evaluateSingleScheme(scheme, profile));

  // Sort: Eligible first, then Potentially Eligible, then Not Eligible
  return results.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}
