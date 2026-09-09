# ArthSahayak (अर्थसहायक) - Project Brief
**Smart India Hackathon 2026**
* **Problem Statement ID:** SIH26091
* **Problem Statement Title:** AI-Driven Hyper-Local Business Advisory and Financial Structuring Assistant for Rural Micro-Entrepreneurs
* **Theme:** Agriculture, FoodTech & Rural Development
* **Category:** Software
* **Team:** ProtoFin

---

## 1. Executive Summary & Problem Overview

Rural micro-entrepreneurs—such as carpenters, rural artisans, street vendors, and small kirana owners—often run thriving micro-enterprises with steady daily cash flows. However, they typically maintain transaction records informally on paper slips, diaries, or traditional *bahi-khata* ledgers in local dialects.

When approaching formal banking institutions for credit, they face **up to an 80%+ formal credit rejection rate** due to:
1. **Lack of formal audited financial statements and balance sheets.**
2. **Text, digital, and linguistic literacy barriers** in navigating formal banking systems.
3. **Mismatches with banking assessment norms** (such as the RBI Nayak Committee working capital norms).

Consequently, entrepreneurs are driven to informal moneylenders charging usurious interest rates (36% to 60%+ per annum), trapping them in perpetual debt cycles and severely restricting enterprise growth.

**ArthSahayak** bridges this divide: a voice-first, vernacular co-pilot that ingests spoken audio and handwritten ledger photos, diagnoses financial health deterministically, and instantly structures informal transactions into an audit-ready, RBI-compliant credit appraisal dossier targeted at concessional finance schemes.

---

## 2. Core Solution Pillars

### A. Voice-First Vernacular Progressive Web App (PWA)
* **Zero-Friction Ingestion:** Eliminates typing barriers by ingesting spoken local dialects and photos of physical paper slips/ledgers (*bahi-khata*).
* **Human-in-the-Loop Confirmation:** Extracted transaction amounts are read back to the user via vernacular voice prompts for simple one-tap or spoken confirmation before persisting.
* **Offline-First Resilience:** Client-side IndexedDB and service workers queue audio clips and ledger entries locally during poor rural connectivity (2G / haat markets) and synchronize seamlessly when online.

### B. Proactive Deterministic Financial Diagnostic Engine
* **Mathematical Precision:** All accounting and banking metrics run strictly through deterministic Python routines (NumPy/Pydantic)—guaranteeing zero LLM hallucination in financial calculations.
* **Key Banking Metrics:**
  * **Nayak Committee Working Capital Norms:** Maximum Permissible Bank Finance (MPBF) calculation based on projected turnover (minimum 25% working capital requirement, 5% promoter margin, 20% bank finance).
  * **Debt Service Coverage Ratio (DSCR):** Net Operating Income vs. Debt Obligations.
  * **Udhar Aging & Cash-Burn Diagnostics:** Real-time tracking of receivables aging, daily cash burn, and working capital gaps.
* **Prescriptive Action:** Issues timely operational alerts (e.g., credit-stop warnings for overdue accounts receivable) rather than passive record tracking.

### C. Hyper-Local Market Grounding via Agmarknet
* Real-time integration with daily wholesale mandi price feeds via Open Government Data (OGD) APIs.
* Generates proactive alerts when raw material input price spikes threaten micro-producers' operating profit margins.

### D. Targeted Concessional Scheme Matching Engine
* Bridges marginalized entrepreneurs into specialized credit corporations under the **Ministry of Social Justice and Empowerment (MoSJE)** and national priority schemes:
  * **NSFDC** (National Scheduled Castes Finance and Development Corporation)
  * **NBCFDC** (National Backward Classes Finance & Development Corporation)
  * **NSKFDC** (National Safai Karamcharis Finance & Development Corporation)
  * **PM Vishwakarma** (Concessional credit & toolkit subsidies for traditional artisans/craftspeople)
  * **PMMY** (Pradhan Mantri MUDRA Yojana - Shishu, Kishore, Tarun)
  * **PMEGP**, **Stand-Up India**, **PM SVANidhi**
* **Deterministic Guardrails:** Hard eligibility filters (age, income ceiling, caste category, trade type) are evaluated purely deterministically in code; LLMs/vector search are quarantined to semantic query discovery and document assistance.

### E. Automated Audit-Ready Credit Appraisal Dossier
* Generates a standardized, 2-page credit appraisal report (PDF format via ReportLab) formatted to Regional Rural Bank (RRB) and State Channelizing Agency (SCA) branch manager standards.
* Transforms raw, informal cash records into an unalterable, verified operational ledger that bank managers can inspect directly.

---

## 3. System Architecture & Technical Specifications

```
ArthSahayak/
├── frontend/                     # React + Vite + TypeScript (PWA)
│   ├── src/
│   │   ├── components/           # Reusable UI widgets and atomic components
│   │   ├── pages/                # High-level screens (Ledger, Diagnostics, Schemes, Dossier)
│   │   ├── hooks/                # Custom React hooks (Audio recording, Offline sync)
│   │   ├── services/             # API client integration (FastAPI calls)
│   │   ├── types/                # TypeScript interfaces & domain models
│   │   └── lib/                  # Utility functions and offline storage (IndexedDB)
│   ├── public/                   # Static assets, manifests, icons
│   └── package.json
│
├── backend/                      # FastAPI (Python)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # Application entry point & core routing
│   │   ├── schemas.py            # Pydantic models & validation contracts
│   │   ├── finance_engine.py     # Deterministic financial math (Nayak norms, DSCR, cash burn)
│   │   ├── scheme_engine.py      # Hard-filter rules engine for MoSJE/national schemes
│   │   ├── dossier_generator.py  # ReportLab PDF dossier generation
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── transcription.py  # Speech-to-text / Bhashini integration interface
│   │       └── ocr.py            # Handwritten ledger OCR pipeline interface
│   │
│   └── tests/                    # Unit and integration test suites
│
├── PROJECT_BRIEF.md              # System blueprint & architectural documentation
├── .gitignore                    # Comprehensive ignore rules
└── README.md                     # Local setup and execution guide
```

---

## 4. Engineering Guardrails

1. **Deterministic Financial Math:** No generative AI may estimate or calculate loan amounts, interest, eligibility, or ratios. All math is implemented via verified Python code.
2. **Zero-PII Leakage:** Sensitive demographic and caste identifiers required for MoSJE scheme routing are evaluated in-memory and never sent to third-party generative LLM endpoints.
3. **Progressive & Incremental Delivery:** Each module is developed, tested, and verified end-to-end without unneeded third-party dependencies or mock bloat.
