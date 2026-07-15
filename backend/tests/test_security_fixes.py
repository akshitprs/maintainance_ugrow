"""Security audit fixes verification tests (SEC-001..SEC-005 + regression)."""
import io
import json
import os
import uuid
from datetime import datetime, timedelta

import jwt
import pytest
import requests

BASE_URL = "http://localhost:8001"
OLD_SECRET = "ugrow-dev-secret-change-me-in-prod"


# ---------- helpers / fixtures ----------
@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _login(s, email, password):
    r = s.post(f"{BASE_URL}/api/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"], r.json()["user"]


@pytest.fixture(scope="module")
def admin(s):
    tok, user = _login(s, "admin@ugrow.com", "Admin@123")
    return {"token": tok, "user": user, "h": {"Authorization": f"Bearer {tok}"}}


def _ensure_employee(s, admin, tag):
    """Create (or reuse) an employee with unique email."""
    email = f"sec_{tag}_{uuid.uuid4().hex[:6]}@ugrow.com"
    pw = "Emp@12345"
    r = s.post(
        f"{BASE_URL}/api/users",
        headers=admin["h"],
        json={"name": f"Emp {tag}", "email": email, "password": pw, "role": "employee"},
    )
    assert r.status_code == 200, r.text
    user = r.json()
    tok, _ = _login(s, email, pw)
    return {"id": user["id"], "email": email, "password": pw, "token": tok,
            "h": {"Authorization": f"Bearer {tok}"}}


def _ensure_setup(s, admin, employee_id, customer_name="Test Cust"):
    r = s.post(
        f"{BASE_URL}/api/setups",
        headers=admin["h"],
        json={
            "customer_name": customer_name,
            "setup_type": "Terrace Garden",
            "maintenance_plan": "Monthly",
            "assigned_employee_id": employee_id,
            "status": "active",
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


# ---------- SEC-001: JWT secret hardening ----------
class TestSEC001JWTSecret:
    def test_token_signed_with_old_default_secret_rejected(self, s):
        payload = {
            "sub": str(uuid.uuid4()),
            "email": "admin@ugrow.com",
            "role": "admin",
            "exp": datetime.utcnow() + timedelta(days=365),
        }
        forged = jwt.encode(payload, OLD_SECRET, algorithm="HS256")
        r = s.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {forged}"})
        assert r.status_code == 401, f"OLD-secret token should be 401, got {r.status_code} {r.text}"

    def test_new_jwt_secret_signs_working_token(self, s, admin):
        r = s.get(f"{BASE_URL}/api/auth/me", headers=admin["h"])
        assert r.status_code == 200
        assert r.json()["email"] == "admin@ugrow.com"


# ---------- Regression: admin login still works ----------
class TestRegressionAdminLogin:
    def test_admin_login(self, s):
        tok, u = _login(s, "admin@ugrow.com", "Admin@123")
        assert u["role"] == "admin"
        assert tok


# ---------- SEC-003: IDOR on GET /api/visits ----------
class TestSEC003IDOR:
    def test_employee_cannot_view_other_employee_visits(self, s, admin):
        e1 = _ensure_employee(s, admin, "e1")
        e2 = _ensure_employee(s, admin, "e2")

        # Give E2 a visit
        setup2 = _ensure_setup(s, admin, e2["id"], customer_name="E2 Cust")
        r = s.post(f"{BASE_URL}/api/visits/checkin", headers=e2["h"], json={"setup_id": setup2["id"]})
        assert r.status_code == 200, r.text
        e2_visit_id = r.json()["id"]

        # E1 attempts IDOR: request E2's visits by supplying employee_id=E2.id
        r = s.get(f"{BASE_URL}/api/visits", headers=e1["h"], params={"employee_id": e2["id"]})
        assert r.status_code == 200, r.text
        rows = r.json()
        # Any returned row MUST belong to E1 only
        for v in rows:
            assert v["employee_id"] == e1["id"], f"IDOR leak: {v}"
        # Must not include E2's visit id
        assert all(v["id"] != e2_visit_id for v in rows), "E1 saw E2's visit"


# ---------- SEC-004: payload cap + limit clamp ----------
class TestSEC004Limits:
    def test_checkout_form_over_2mb_returns_413(self, s, admin):
        emp = _ensure_employee(s, admin, "big")
        setup = _ensure_setup(s, admin, emp["id"], customer_name="Big Cust")
        r = s.post(f"{BASE_URL}/api/visits/checkin", headers=emp["h"], json={"setup_id": setup["id"]})
        assert r.status_code == 200
        visit_id = r.json()["id"]

        big_blob = "x" * (2 * 1024 * 1024 + 5000)  # ~2MB+
        r = s.post(
            f"{BASE_URL}/api/visits/{visit_id}/checkout",
            headers=emp["h"],
            json={"form": {"blob": big_blob}},
        )
        assert r.status_code == 413, f"expected 413, got {r.status_code} {r.text[:200]}"

    def test_visits_limit_clamped_to_200(self, s, admin):
        r = s.get(f"{BASE_URL}/api/visits", headers=admin["h"], params={"limit": 5000})
        assert r.status_code == 200
        assert len(r.json()) <= 200


# ---------- SEC-005: CSV formula injection + filename sanitization ----------
class TestSEC005CSV:
    def test_csv_formula_injection_prefixed_with_apostrophe(self, s, admin):
        emp = _ensure_employee(s, admin, "csv")
        malicious = "=cmd|test"
        setup = _ensure_setup(s, admin, emp["id"], customer_name=malicious)
        r = s.post(f"{BASE_URL}/api/visits/checkin", headers=emp["h"], json={"setup_id": setup["id"]})
        assert r.status_code == 200
        visit_id = r.json()["id"]
        r = s.post(f"{BASE_URL}/api/visits/{visit_id}/checkout", headers=emp["h"], json={"form": {"ok": 1}})
        assert r.status_code == 200

        r = s.get(f"{BASE_URL}/api/reports/visits", headers=admin["h"], params={"format": "csv"})
        assert r.status_code == 200
        text = r.text
        # Raw '=cmd|test' should NOT appear at start of a cell; prefixed form should
        assert "'=cmd|test" in text, f"CSV not sanitized. body:\n{text[:500]}"
        # Ensure no raw formula cell at start (comma or newline preceding)
        assert ",=cmd|test" not in text and text.find("\n=cmd|test") == -1

    def test_csv_filename_sanitization(self, s, admin):
        r = s.get(
            f"{BASE_URL}/api/reports/visits",
            headers=admin["h"],
            params={"format": "csv", "date_from": "../../etc/passwd", "date_to": "x"},
        )
        assert r.status_code == 200
        cd = r.headers.get("Content-Disposition", "")
        # Extract filename="..."
        import re
        m = re.search(r'filename="([^"]+)"', cd)
        assert m, f"No filename in Content-Disposition: {cd}"
        fname = m.group(1)
        assert ".." not in fname, f"filename contains '..': {fname}"
        assert "/" not in fname and "\\" not in fname, f"filename contains slash: {fname}"
        assert re.fullmatch(r"[A-Za-z0-9._-]+", fname), f"filename has bad chars: {fname}"


# ---------- Regression: employee checkin/checkout small form ----------
class TestRegressionEmployeeFlow:
    def test_employee_checkin_checkout_small_form(self, s, admin):
        emp = _ensure_employee(s, admin, "reg")
        setup = _ensure_setup(s, admin, emp["id"], customer_name="Reg Cust")
        r = s.post(f"{BASE_URL}/api/visits/checkin", headers=emp["h"], json={"setup_id": setup["id"]})
        assert r.status_code == 200
        vid = r.json()["id"]
        r = s.post(
            f"{BASE_URL}/api/visits/{vid}/checkout",
            headers=emp["h"],
            json={"form": {"notes": "ok", "photos": []}},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "completed"


# ---------- Regression: admin listing + PDF export ----------
class TestRegressionAdminExports:
    def test_admin_list_users(self, s, admin):
        r = s.get(f"{BASE_URL}/api/users", headers=admin["h"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_admin_list_visits(self, s, admin):
        r = s.get(f"{BASE_URL}/api/visits", headers=admin["h"])
        assert r.status_code == 200

    def test_admin_export_csv(self, s, admin):
        r = s.get(f"{BASE_URL}/api/reports/visits", headers=admin["h"], params={"format": "csv"})
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_admin_export_pdf(self, s, admin):
        r = s.get(f"{BASE_URL}/api/reports/visits", headers=admin["h"], params={"format": "pdf"})
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"
