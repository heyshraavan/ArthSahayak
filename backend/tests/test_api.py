from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    """Verify GET /health returns expected status and service name."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "arthsahayak-api",
    }


def test_valid_calculation_request():
    """Verify POST /finance/calculate with normal mixed transactions and positive debt service."""
    payload = {
        "transactions": [
            {
                "date": "2026-09-01",
                "party_name": "Ramesh Carpenter",
                "item": "Wooden Dining Table",
                "amount": 25000.0,
                "tx_type": "credit",
            },
            {
                "date": "2026-09-02",
                "party_name": "Timber Depot",
                "item": "Wood logs & polish",
                "amount": 10000.0,
                "tx_type": "debit",
            },
            {
                "date": "2026-09-03",
                "party_name": "Suresh",
                "item": "Window Frame",
                "amount": 15000.0,
                "tx_type": "credit",
            },
        ],
        "net_operating_income": 20000.0,
        "debt_service": 10000.0,
    }
    response = client.post("/finance/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["total_credit"] == 40000.0
    assert data["total_debit"] == 10000.0
    assert data["net_cash_flow"] == 30000.0
    assert data["turnover"] == 40000.0
    assert data["working_capital_requirement"] == 10000.0  # 25% of 40000
    assert data["promoter_margin"] == 2000.0              # 5% of 40000
    assert data["maximum_permissible_bank_finance"] == 8000.0  # 20% of 40000
    assert data["dscr"] == 2.0                            # 20000 / 10000


def test_empty_transaction_list():
    """Verify calculation with empty transaction list."""
    payload = {
        "transactions": [],
        "net_operating_income": 50000.0,
        "debt_service": 25000.0,
    }
    response = client.post("/finance/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["total_credit"] == 0.0
    assert data["total_debit"] == 0.0
    assert data["net_cash_flow"] == 0.0
    assert data["turnover"] == 0.0
    assert data["working_capital_requirement"] == 0.0
    assert data["promoter_margin"] == 0.0
    assert data["maximum_permissible_bank_finance"] == 0.0
    assert data["dscr"] == 2.0


def test_explicit_turnover():
    """Verify calculation when explicit_turnover is provided."""
    payload = {
        "transactions": [
            {
                "date": "2026-09-01",
                "party_name": "Shop",
                "item": "Direct Cash",
                "amount": 500.0,
                "tx_type": "credit",
            }
        ],
        "explicit_turnover": 500000.0,
        "net_operating_income": 100000.0,
        "debt_service": 50000.0,
    }
    response = client.post("/finance/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["total_credit"] == 500.0
    assert data["turnover"] == 500000.0
    assert data["working_capital_requirement"] == 125000.0  # 25% of 500k
    assert data["promoter_margin"] == 25000.0              # 5% of 500k
    assert data["maximum_permissible_bank_finance"] == 100000.0  # 20% of 500k
    assert data["dscr"] == 2.0


def test_zero_debt_service():
    """Verify that zero debt service returns dscr as null/None without error."""
    payload = {
        "transactions": [],
        "net_operating_income": 75000.0,
        "debt_service": 0.0,
    }
    response = client.post("/finance/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["dscr"] is None


def test_negative_amount_rejection():
    """Verify 422 Unprocessable Entity when transaction amount is negative."""
    payload = {
        "transactions": [
            {
                "date": "2026-09-01",
                "party_name": "Supplier",
                "item": "Wood",
                "amount": -500.0,
                "tx_type": "debit",
            }
        ],
        "net_operating_income": 50000.0,
        "debt_service": 10000.0,
    }
    response = client.post("/finance/calculate", json=payload)
    assert response.status_code == 422


def test_invalid_transaction_type():
    """Verify 422 Unprocessable Entity when tx_type is not credit or debit."""
    payload = {
        "transactions": [
            {
                "date": "2026-09-01",
                "party_name": "Customer",
                "item": "Order",
                "amount": 500.0,
                "tx_type": "income",
            }
        ],
        "net_operating_income": 50000.0,
        "debt_service": 10000.0,
    }
    response = client.post("/finance/calculate", json=payload)
    assert response.status_code == 422


def test_invalid_date():
    """Verify 422 Unprocessable Entity when date format is invalid."""
    payload = {
        "transactions": [
            {
                "date": "invalid-date-string",
                "party_name": "Customer",
                "item": "Order",
                "amount": 500.0,
                "tx_type": "credit",
            }
        ],
        "net_operating_income": 50000.0,
        "debt_service": 10000.0,
    }
    response = client.post("/finance/calculate", json=payload)
    assert response.status_code == 422


def test_invalid_transaction_empty_strings():
    """Verify 422 Unprocessable Entity when party_name or item is empty/whitespace."""
    payload = {
        "transactions": [
            {
                "date": "2026-09-01",
                "party_name": "   ",
                "item": "Order",
                "amount": 500.0,
                "tx_type": "credit",
            }
        ],
        "net_operating_income": 50000.0,
        "debt_service": 10000.0,
    }
    response = client.post("/finance/calculate", json=payload)
    assert response.status_code == 422


def test_negative_turnover_or_noi_or_debt_service():
    """Verify 422 Unprocessable Entity for negative turnover, NOI, or debt_service."""
    # Negative explicit turnover
    response = client.post(
        "/finance/calculate",
        json={"transactions": [], "explicit_turnover": -100.0, "net_operating_income": 10.0, "debt_service": 5.0},
    )
    assert response.status_code == 422

    # Negative NOI
    response = client.post(
        "/finance/calculate",
        json={"transactions": [], "net_operating_income": -10.0, "debt_service": 5.0},
    )
    assert response.status_code == 422

    # Negative Debt Service
    response = client.post(
        "/finance/calculate",
        json={"transactions": [], "net_operating_income": 10.0, "debt_service": -5.0},
    )
    assert response.status_code == 422


def test_malformed_request_body():
    """Verify 422 Unprocessable Entity for missing required fields or non-JSON payloads."""
    # Missing required fields
    response = client.post("/finance/calculate", json={})
    assert response.status_code == 422

    # Non-dictionary payload
    response = client.post("/finance/calculate", content="not json", headers={"Content-Type": "application/json"})
    assert response.status_code == 422

    # Invalid field types
    response = client.post(
        "/finance/calculate",
        json={"transactions": "not-a-list", "net_operating_income": "abc", "debt_service": "xyz"},
    )
    assert response.status_code == 422


def test_api_with_categorized_transactions():
    """Verify POST /finance/calculate correctly processes categorized transactions."""
    payload = {
        "transactions": [
            {
                "date": "2026-09-01",
                "party_name": "Ramesh Carpenter",
                "item": "Dining Table",
                "amount": 40000.0,
                "tx_type": "credit",
                "category": "sales",
            },
            {
                "date": "2026-09-02",
                "party_name": "Gramin Bank",
                "item": "MUDRA Loan Credit",
                "amount": 50000.0,
                "tx_type": "credit",
                "category": "loan_disbursement",
            },
            {
                "date": "2026-09-03",
                "party_name": "Timber Depot",
                "item": "Teak Wood",
                "amount": 10000.0,
                "tx_type": "debit",
                "category": "raw_material",
            },
            {
                "date": "2026-09-04",
                "party_name": "Household Cash",
                "item": "Personal Groceries",
                "amount": 5000.0,
                "tx_type": "debit",
                "category": "personal_drawings",
            },
        ],
        "net_operating_income": 20000.0,
        "debt_service": 10000.0,
    }
    response = client.post("/finance/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Cash flows
    assert data["total_credit"] == 90000.0
    assert data["total_debit"] == 15000.0
    assert data["net_cash_flow"] == 75000.0

    # Categorized turnover must strictly isolate sales (40k) and exclude the 50k loan
    assert data["turnover"] == 40000.0
    assert data["working_capital_requirement"] == 10000.0  # 25% of 40k
    assert data["promoter_margin"] == 2000.0              # 5% of 40k
    assert data["maximum_permissible_bank_finance"] == 8000.0  # 20% of 40k
    assert data["dscr"] == 2.0


def test_legacy_api_payload_without_category_still_works():
    """Verify legacy payloads omitting the category field continue to work without regression."""
    payload = {
        "transactions": [
            {
                "date": "2026-09-01",
                "party_name": "Customer",
                "item": "Work",
                "amount": 30000.0,
                "tx_type": "credit",
            }
        ],
        "net_operating_income": 15000.0,
        "debt_service": 7500.0,
    }
    response = client.post("/finance/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["turnover"] == 30000.0
    assert data["working_capital_requirement"] == 7500.0
    assert data["promoter_margin"] == 1500.0
    assert data["maximum_permissible_bank_finance"] == 6000.0

