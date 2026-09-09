# ArthSahayak (अर्थसहायक)

> **Smart India Hackathon 2026** — Problem Statement ID: SIH26091  
> **AI-Driven Hyper-Local Business Advisory and Financial Structuring Assistant for Rural Micro-Entrepreneurs**  
> Developed by **ProtoFin**

ArthSahayak is a voice-first, vernacular financial assistant designed to empower rural micro-entrepreneurs (carpenters, artisans, street vendors, small shopkeepers). It converts informal spoken transactions and paper *bahi-khata* ledgers into audit-ready, RBI-compliant financial statements and credit appraisal dossiers for concessional loan schemes (MoSJE, PM Vishwakarma, MUDRA).

---

## Repository Structure

```
ArthSahayak/
├── frontend/                     # React + Vite + TypeScript (PWA)
│   ├── src/
│   │   ├── components/           # Reusable UI widgets
│   │   ├── pages/                # Screens (Ledger, Diagnostics, Schemes, Dossier)
│   │   ├── hooks/                # Custom React hooks (Voice, Offline sync)
│   │   ├── services/             # API client calls
│   │   ├── types/                # Domain models & TypeScript definitions
│   │   └── lib/                  # Utilities and IndexedDB storage
│   ├── public/                   # Static assets
│   └── package.json
│
├── backend/                      # FastAPI (Python)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI application entry & endpoints
│   │   ├── schemas.py            # Pydantic data models
│   │   ├── finance_engine.py     # Deterministic financial math (Nayak WC, DSCR)
│   │   ├── scheme_engine.py      # Hard-filter rules engine for schemes
│   │   ├── dossier_generator.py  # ReportLab PDF dossier generation
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── transcription.py  # Voice transcription interface
│   │       └── ocr.py            # Handwritten ledger OCR interface
│   │
│   ├── tests/                    # Backend unit & endpoint tests
│   │   ├── __init__.py
│   │   └── test_health.py
│   └── requirements.txt          # Minimal Python dependencies
│
├── PROJECT_BRIEF.md              # Full architecture and domain specification
├── .gitignore                    # Git ignore configuration
└── README.md                     # Setup and execution guide
```

---

## Prerequisites

- **Node.js**: v20+ (tested on Node v24.21.0, npm v11.19.0)
- **Python**: 3.10+ (tested on Python 3.14.7)

---

## Getting Started

### 1. Backend (FastAPI)

1. Open a terminal in the `backend` directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   * **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   * **Linux / macOS:**
     ```bash
     python -m venv .venv
     source .venv/bin/activate
     ```

3. Install minimal requirements:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. Verify the health check:
   * Open [http://localhost:8000/health](http://localhost:8000/health)
   * Expected response:
     ```json
     {
       "status": "ok",
       "service": "arthsahayak-api"
     }
     ```
   * Interactive OpenAPI Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

6. Run backend tests:
   ```bash
   pytest
   ```

---

### 2. Frontend (React + Vite + TypeScript)

1. Open a terminal in the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local Vite development server:
   ```bash
   npm run dev
   ```
   Open the displayed local URL (typically `http://localhost:5173`).

4. Build for production:
   ```bash
   npm run build
   ```

---

## Architecture Principles

- **Deterministic Financial Math:** No generative AI calculations for financial metrics, loan amounts, or scheme eligibility criteria. All math executes via deterministic Python code.
- **Zero-PII Leakage:** Demographic and financial indicators used for scheme matching remain strictly in-memory or on-device.
- **Voice-First & Low-Literacy Usability:** Human-in-the-loop audio confirmation before finalizing transactions.
- **Offline Resilience:** Local-first queuing via IndexedDB for intermittent rural connectivity.
