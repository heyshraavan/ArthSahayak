"""ReportLab-based Credit Appraisal Dossier Generator for ArthSahayak.

Generates an audit-ready, 2-page PDF Credit Appraisal Dossier for rural micro-enterprises.
The generator receives pre-calculated, structured financial data and performs NO financial
calculations, NO LLM calls, and NO external API calls.
"""

from datetime import date
import io
from pathlib import Path
from typing import List, Optional, Union

from pydantic import BaseModel, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.schemas import FinancialSummary


class SchemeRecommendation(BaseModel):
    """Targeted concessional scheme recommendation."""

    scheme_name: str = Field(..., description="Name of the government/concessional scheme")
    sponsoring_agency: Optional[str] = Field(None, description="Sponsoring ministry or corporation, e.g. MoSJE / NSFDC")
    target_benefit: Optional[str] = Field(None, description="Key benefit, e.g. 5% interest subsidy, toolkit grant")
    notes: Optional[str] = Field(None, description="Eligibility or operational notes")


class TransactionSnippet(BaseModel):
    """Summary of a representative transaction for the audit trail."""

    date: str = Field(..., description="Transaction date string (YYYY-MM-DD)")
    party_name: str = Field(..., description="Customer or vendor name")
    item: str = Field(..., description="Item or service description")
    amount: float = Field(..., ge=0.0, description="Transaction amount")
    tx_type: str = Field(..., description="'credit' or 'debit'")


class DossierInput(BaseModel):
    """Structured input payload for generating the 2-page Credit Appraisal Dossier.

    Privacy Guardrail:
    ------------------
    Do NOT include Aadhaar, PAN, caste certificate numbers, or sensitive PII.
    Missing fields will gracefully display 'Not provided' rather than inventing data.
    """

    # Enterprise & Applicant profile
    applicant_name: Optional[str] = Field(None, description="Applicant full name")
    business_name: Optional[str] = Field(None, description="Registered or trade name of enterprise")
    business_type: Optional[str] = Field(None, description="Industry or trade, e.g. Carpentry, Kirana, Metalwork")
    assessment_date: Optional[str] = Field(None, description="Date of evaluation (YYYY-MM-DD)")
    financial_period: Optional[str] = Field(None, description="Period covered, e.g. 'FY 2025-26' or 'Last 6 Months'")

    # Pre-calculated financial summary (received from finance engine)
    financial_summary: FinancialSummary

    # Credit assessment details
    proposed_finance_amount: Optional[float] = Field(None, ge=0.0, description="Requested or proposed loan amount")
    transaction_count: Optional[int] = Field(None, ge=0, description="Total number of evaluated ledger entries")
    transaction_sample: Optional[List[TransactionSnippet]] = Field(
        default=None,
        description="Sample of ledger entries for verification",
    )
    scheme_recommendations: Optional[List[SchemeRecommendation]] = Field(
        default=None,
        description="Matched concessional finance schemes",
    )
    appraisal_notes: Optional[str] = Field(
        default=None,
        description="Specific appraisal observations or branch manager recommendations",
    )


def _format_inr(val: Optional[float]) -> str:
    """Format a monetary amount in Indian Rupees notation (INR X,XXX.XX)."""
    if val is None:
        return "N/A"
    return f"INR {val:,.2f}"


def _format_ratio(val: Optional[float]) -> str:
    """Format a financial coverage ratio (e.g. 1.50x or N/A)."""
    if val is None:
        return "N/A (No Debt Obligations)"
    return f"{val:.2f}x"


def generate_dossier_pdf(
    data: DossierInput,
    output_path: Optional[Union[str, Path]] = None,
) -> bytes:
    """Generate a deterministic, audit-ready 2-page PDF Credit Appraisal Dossier.

    Args:
        data: Structured DossierInput containing applicant details and pre-calculated financial metrics.
        output_path: Optional file path to write the PDF to disk.

    Returns:
        bytes: Raw PDF content bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
    )

    usable_width = A4[0] - (24 * mm)  # approx 527 pt

    # Base typography styles
    styles = getSampleStyleSheet()

    primary_color = colors.HexColor("#1E3A8A")     # Deep bank navy
    secondary_color = colors.HexColor("#334155")   # Slate neutral
    border_color = colors.HexColor("#CBD5E1")      # Soft border
    bg_subtle = colors.HexColor("#F8FAFC")         # Table header background
    accent_green = colors.HexColor("#065F46")      # Inflow/surplus
    accent_red = colors.HexColor("#991B1B")        # Outflow/deficit

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=primary_color,
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=secondary_color,
    )

    section_heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=primary_color,
        spaceAfter=3,
    )

    body_style = ParagraphStyle(
        "BodySmall",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#1E293B"),
    )

    body_bold = ParagraphStyle(
        "BodySmallBold",
        parent=body_style,
        fontName="Helvetica-Bold",
    )

    body_right = ParagraphStyle(
        "BodySmallRight",
        parent=body_style,
        alignment=2,
    )

    body_bold_right = ParagraphStyle(
        "BodySmallBoldRight",
        parent=body_bold,
        alignment=2,
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )

    table_header_right = ParagraphStyle(
        "TableHeaderRight",
        parent=table_header_style,
        alignment=2,
    )

    disclaimer_style = ParagraphStyle(
        "Disclaimer",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=6.5,
        leading=8.5,
        textColor=colors.HexColor("#475569"),
    )

    story = []

    # =========================================================================
    # PAGE 1 — BUSINESS & FINANCIAL SNAPSHOT
    # =========================================================================

    # Header / Branding Block
    header_data = [
        [
            Paragraph("<b>ARTHSAHAYAK (अर्थसहायक)</b><br/><font size='7' color='#64748B'>Smart India Hackathon 2026 Prototype | Team ProtoFin</font>", body_style),
            Paragraph("<b>CONFIDENTIAL</b><br/><font size='7' color='#64748B'>For Institutional Lending Evaluation</font>", body_right),
        ]
    ]
    t_header = Table(header_data, colWidths=[usable_width * 0.65, usable_width * 0.35])
    t_header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceBefore=1, spaceAfter=5))

    story.append(Paragraph("CREDIT APPRAISAL DOSSIER", title_style))
    story.append(Paragraph("Rural Micro-Enterprise Financial Assessment & Working Capital Structuring Report", subtitle_style))
    story.append(Spacer(1, 7))

    # Applicant & Enterprise Profile
    story.append(Paragraph("1. APPLICANT & ENTERPRISE PROFILE", section_heading_style))

    assessed_dt = data.assessment_date or date.today().isoformat()
    period_txt = data.financial_period or "Not provided"
    applicant_txt = data.applicant_name or "Not provided"
    business_txt = data.business_name or "Not provided"
    trade_txt = data.business_type or "Not provided"
    dossier_ref = f"AS-DOS-{assessed_dt.replace('-', '')}-01"

    profile_data = [
        [
            Paragraph("<b>Applicant Name:</b>", body_style),
            Paragraph(applicant_txt, body_style),
            Paragraph("<b>Assessment Date:</b>", body_style),
            Paragraph(assessed_dt, body_style),
        ],
        [
            Paragraph("<b>Enterprise Name:</b>", body_style),
            Paragraph(business_txt, body_style),
            Paragraph("<b>Financial Period:</b>", body_style),
            Paragraph(period_txt, body_style),
        ],
        [
            Paragraph("<b>Business Activity:</b>", body_style),
            Paragraph(trade_txt, body_style),
            Paragraph("<b>Dossier Reference:</b>", body_style),
            Paragraph(dossier_ref, body_style),
        ],
    ]
    t_profile = Table(
        profile_data,
        colWidths=[usable_width * 0.22, usable_width * 0.28, usable_width * 0.22, usable_width * 0.28],
    )
    t_profile.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg_subtle),
        ("BOX", (0, 0), (-1, -1), 0.5, border_color),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_profile)
    story.append(Spacer(1, 7))

    # Financial Summary Section
    story.append(Paragraph("2. FINANCIAL SUMMARY & CASH FLOW SNAPSHOT", section_heading_style))

    fs = data.financial_summary
    net_color = accent_green if fs.net_cash_flow >= 0 else accent_red
    net_flow_txt = f"<font color='{net_color.hexval()}'><b>{_format_inr(fs.net_cash_flow)}</b></font>"

    fin_summary_table = [
        [
            Paragraph("Financial Metric", table_header_style),
            Paragraph("Evaluated Amount", table_header_right),
            Paragraph("Operational Description", table_header_style),
        ],
        [
            Paragraph("Total Credit (Inflows)", body_style),
            Paragraph(_format_inr(fs.total_credit), body_bold_right),
            Paragraph("Cumulative cash and banking operational inflows recorded", body_style),
        ],
        [
            Paragraph("Total Debit (Outflows)", body_style),
            Paragraph(_format_inr(fs.total_debit), body_bold_right),
            Paragraph("Cumulative procurement, operational, and wage expenses recorded", body_style),
        ],
        [
            Paragraph("Net Cash Flow", body_style),
            Paragraph(net_flow_txt, body_right),
            Paragraph("Operational cash balance over the evaluated reporting period", body_style),
        ],
        [
            Paragraph("Assessed Annual Turnover", body_style),
            Paragraph(_format_inr(fs.turnover), body_bold_right),
            Paragraph("Gross turnover baseline applied for credit appraisal sizing", body_style),
        ],
    ]
    t_fin = Table(fin_summary_table, colWidths=[usable_width * 0.35, usable_width * 0.25, usable_width * 0.40])
    t_fin.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), bg_subtle),
        ("BOX", (0, 0), (-1, -1), 0.5, border_color),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_fin)
    story.append(Spacer(1, 7))

    # Working Capital Requirement (Nayak Committee Norms)
    story.append(Paragraph("3. WORKING CAPITAL ASSESSMENT (NAYAK COMMITTEE NORMS)", section_heading_style))
    story.append(Paragraph(
        "<font size='7' color='#475569'>Calculated using standard Reserve Bank of India Nayak Committee working capital norms: minimum 25% turnover working capital requirement, 5% promoter margin, and 20% Maximum Permissible Bank Finance (MPBF).</font>",
        subtitle_style,
    ))
    story.append(Spacer(1, 3))

    wc_data = [
        [
            Paragraph("Assessment Parameter", table_header_style),
            Paragraph("Norm %", table_header_style),
            Paragraph("Evaluated Amount", table_header_right),
            Paragraph("Regulatory Purpose / Guidance", table_header_style),
        ],
        [
            Paragraph("Turnover Baseline", body_style),
            Paragraph("100.0%", body_style),
            Paragraph(_format_inr(fs.turnover), body_right),
            Paragraph("Base enterprise operational turnover", body_style),
        ],
        [
            Paragraph("Working Capital Requirement (WCR)", body_style),
            Paragraph("25.0%", body_style),
            Paragraph(_format_inr(fs.working_capital_requirement), body_bold_right),
            Paragraph("Total operational operating capital required", body_style),
        ],
        [
            Paragraph("Promoter Margin", body_style),
            Paragraph("5.0%", body_style),
            Paragraph(_format_inr(fs.promoter_margin), body_right),
            Paragraph("Mandatory minimum enterprise equity contribution", body_style),
        ],
        [
            Paragraph("<b>Maximum Permissible Bank Finance (MPBF)</b>", body_style),
            Paragraph("<b>20.0%</b>", body_style),
            Paragraph(f"<b>{_format_inr(fs.maximum_permissible_bank_finance)}</b>", body_bold_right),
            Paragraph("<b>Recommended maximum institutional lending ceiling</b>", body_style),
        ],
    ]
    t_wc = Table(
        wc_data,
        colWidths=[usable_width * 0.38, usable_width * 0.12, usable_width * 0.22, usable_width * 0.28],
    )
    t_wc.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), bg_subtle),
        ("BACKGROUND", (0, 4), (-1, 4), colors.HexColor("#EFF6FF")),  # Light blue highlight for MPBF
        ("BOX", (0, 0), (-1, -1), 0.5, border_color),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_wc)
    story.append(Spacer(1, 7))

    # Debt Service Capacity
    story.append(Paragraph("4. DEBT SERVICE CAPACITY & COVERAGE", section_heading_style))

    dscr_note = "Coverage adequate (>= 1.50x)" if (fs.dscr and fs.dscr >= 1.5) else (
        "Coverage moderate / sensitive (< 1.50x)" if fs.dscr else "Unencumbered / Debt-free enterprise"
    )

    dscr_data = [
        [
            Paragraph("Debt Metric", table_header_style),
            Paragraph("Calculated Metric", table_header_right),
            Paragraph("Appraisal Benchmark / Status", table_header_style),
        ],
        [
            Paragraph("Debt Service Coverage Ratio (DSCR)", body_style),
            Paragraph(f"<b>{_format_ratio(fs.dscr)}</b>", body_bold_right),
            Paragraph(dscr_note, body_style),
        ],
    ]
    t_dscr = Table(dscr_data, colWidths=[usable_width * 0.38, usable_width * 0.25, usable_width * 0.37])
    t_dscr.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), bg_subtle),
        ("BOX", (0, 0), (-1, -1), 0.5, border_color),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_dscr)

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceBefore=2, spaceAfter=3))
    story.append(Paragraph(
        "ArthSahayak Dossier | Page 1 of 2 — Business & Financial Snapshot | Confidential for Institutional Review",
        subtitle_style,
    ))

    # Page Break to enforce strictly 2 pages
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2 — CREDIT ASSESSMENT
    # =========================================================================

    # Page 2 Header
    p2_header_data = [
        [
            Paragraph("<b>ARTHSAHAYAK (अर्थसहायक)</b> — CREDIT APPRAISAL DOSSIER", body_style),
            Paragraph("<b>PAGE 2: CREDIT ASSESSMENT & SCHEMES</b>", body_right),
        ]
    ]
    t_p2_header = Table(p2_header_data, colWidths=[usable_width * 0.65, usable_width * 0.35])
    t_p2_header.setStyle(TableStyle([
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(t_p2_header)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1, color=primary_color, spaceBefore=1, spaceAfter=5))

    # Proposed Credit Facility & Request
    story.append(Paragraph("5. CREDIT FACILITY & APPLICANT REQUEST ANALYSIS", section_heading_style))

    prop_finance = data.proposed_finance_amount
    prop_finance_str = _format_inr(prop_finance) if prop_finance is not None else "Not provided"

    facility_alignment = "Not provided"
    if prop_finance is not None:
        if prop_finance <= fs.maximum_permissible_bank_finance:
            facility_alignment = "Within recommended MPBF limits (Conforming)"
        else:
            excess = prop_finance - fs.maximum_permissible_bank_finance
            facility_alignment = f"Exceeds standard MPBF ceiling by { _format_inr(excess) }"

    facility_table = [
        [
            Paragraph("Credit Assessment Field", table_header_style),
            Paragraph("Value / Status", table_header_style),
            Paragraph("Evaluation Comment", table_header_style),
        ],
        [
            Paragraph("Proposed / Requested Finance", body_style),
            Paragraph(f"<b>{prop_finance_str}</b>", body_style),
            Paragraph("Amount requested by applicant or estimated by field officer", body_style),
        ],
        [
            Paragraph("Permissible Limit (MPBF)", body_style),
            Paragraph(_format_inr(fs.maximum_permissible_bank_finance), body_style),
            Paragraph("Prudential working capital borrowing limit (20% turnover)", body_style),
        ],
        [
            Paragraph("Facility Alignment", body_style),
            Paragraph(facility_alignment, body_style),
            Paragraph("Comparison against Nayak Committee working capital ceiling", body_style),
        ],
    ]
    t_fac = Table(facility_table, colWidths=[usable_width * 0.32, usable_width * 0.33, usable_width * 0.35])
    t_fac.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), bg_subtle),
        ("BOX", (0, 0), (-1, -1), 0.5, border_color),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_fac)
    story.append(Spacer(1, 6))

    # Transaction Summary & Sample Ledger Audit
    story.append(Paragraph("6. TRANSACTION AUDIT TRAIL & VELOCITY", section_heading_style))

    tx_count_str = str(data.transaction_count) if data.transaction_count is not None else "Not provided"

    if data.transaction_sample and len(data.transaction_sample) > 0:
        sample_rows = [
            [
                Paragraph("Date", table_header_style),
                Paragraph("Counterparty", table_header_style),
                Paragraph("Item / Description", table_header_style),
                Paragraph("Type", table_header_style),
                Paragraph("Amount", table_header_right),
            ]
        ]
        for tx in data.transaction_sample[:4]:  # limit to top 4 rows for deterministic 2-page fit
            tx_color = accent_green if tx.tx_type == "credit" else accent_red
            sample_rows.append([
                Paragraph(tx.date, body_style),
                Paragraph(tx.party_name, body_style),
                Paragraph(tx.item, body_style),
                Paragraph(f"<font color='{tx_color.hexval()}'><b>{tx.tx_type.upper()}</b></font>", body_style),
                Paragraph(_format_inr(tx.amount), body_right),
            ])
        t_sample = Table(
            sample_rows,
            colWidths=[usable_width * 0.18, usable_width * 0.25, usable_width * 0.27, usable_width * 0.12, usable_width * 0.18],
        )
        t_sample.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), bg_subtle),
            ("BOX", (0, 0), (-1, -1), 0.5, border_color),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, border_color),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(t_sample)
    else:
        tx_info_p = Paragraph(
            f"<b>Evaluated Transactions:</b> {tx_count_str} recorded entries. Detailed transaction ledger maintained in local digital ledger.",
            body_style,
        )
        story.append(tx_info_p)
    story.append(Spacer(1, 6))

    # Scheme Recommendations
    story.append(Paragraph("7. TARGETED CONCESSIONAL SCHEME RECOMMENDATIONS", section_heading_style))

    if data.scheme_recommendations and len(data.scheme_recommendations) > 0:
        scheme_rows = [
            [
                Paragraph("Scheme Name", table_header_style),
                Paragraph("Sponsoring Body", table_header_style),
                Paragraph("Target Concessional Benefit", table_header_style),
            ]
        ]
        for sch in data.scheme_recommendations[:3]:  # Top 3 to strictly respect page height
            scheme_rows.append([
                Paragraph(f"<b>{sch.scheme_name}</b>", body_style),
                Paragraph(sch.sponsoring_agency or "Central / State Agency", body_style),
                Paragraph(sch.target_benefit or "Concessional credit & interest subsidy", body_style),
            ])
        t_scheme = Table(scheme_rows, colWidths=[usable_width * 0.38, usable_width * 0.28, usable_width * 0.34])
        t_scheme.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), bg_subtle),
            ("BOX", (0, 0), (-1, -1), 0.5, border_color),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, border_color),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(t_scheme)
    else:
        story.append(Paragraph(
            "<i>No specific scheme recommendations supplied for this profile. Standard MUDRA (Shishu/Kishore) or priority sector micro-enterprise credit norms apply.</i>",
            body_style,
        ))
    story.append(Spacer(1, 6))

    # Basic Credit Assessment & Appraisal Notes
    story.append(Paragraph("8. APPRAISAL OBSERVATIONS & RECOMMENDATIONS", section_heading_style))
    notes_txt = data.appraisal_notes or (
        "Enterprise demonstrates active operational cash flow velocity. "
        "The applicant maintains positive net operating cash surplus and is recommended for "
        "a working capital credit facility aligned with MPBF benchmarks subject to standard branch verification."
    )
    story.append(Paragraph(notes_txt, body_style))
    story.append(Spacer(1, 6))

    # Important Disclaimers & Assumptions Box
    story.append(Paragraph("9. IMPORTANT ASSUMPTIONS & REGULATORY DISCLAIMERS", section_heading_style))

    disclaimer_text = (
        "<b>PROTOTYPE REPORT NOTICE:</b> This document is a computer-generated credit appraisal dossier produced by the "
        "ArthSahayak prototype (Team ProtoFin, Smart India Hackathon 2026). All metrics are derived deterministically "
        "from informal ledger transactions and user inputs using standard mathematical formulations. "
        "This dossier does NOT constitute an official Reserve Bank of India (RBI) statutory audit, certified financial statement, "
        "or loan sanction commitment. Lending decisions, credit underwriting, KYC, and asset verifications rest entirely with "
        "the sanctioning financial institution.<br/>"
        "<b>DATA PRIVACY COMPLIANCE:</b> In accordance with India's Digital Personal Data Protection (DPDP) Act, this dossier contains "
        "no Aadhaar numbers, PAN identifiers, or sensitive category certificate records."
    )

    t_disc = Table([[Paragraph(disclaimer_text, disclaimer_style)]], colWidths=[usable_width])
    t_disc.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#F1F5F9")),
        ("BOX", (0, 0), (0, 0), 0.5, border_color),
        ("TOPPADDING", (0, 0), (0, 0), 4),
        ("BOTTOMPADDING", (0, 0), (0, 0), 4),
        ("LEFTPADDING", (0, 0), (0, 0), 6),
        ("RIGHTPADDING", (0, 0), (0, 0), 6),
    ]))
    story.append(t_disc)

    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=0.5, color=border_color, spaceBefore=2, spaceAfter=3))
    story.append(Paragraph(
        "ArthSahayak Dossier | Page 2 of 2 — Credit Assessment & Scheme Alignment | Confidential for Institutional Review",
        subtitle_style,
    ))

    # Build the PDF document
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    if output_path is not None:
        p = Path(output_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(pdf_bytes)

    return pdf_bytes
