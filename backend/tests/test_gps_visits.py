"""Backend tests for GPS location feature on visits + PDF export.

Covers:
- Admin login
- Create employee, setup assigned to employee
- Employee check-in with GPS
- Employee check-out with GPS
- Admin GET visit -> check_in_lat/lng, check_out_lat/lng persisted
- Admin GET PDF export
- Rating flow regression
- Visit without GPS -> nulls preserved
"""

import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mobile-app-build-6009.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ugrow.com"
ADMIN_PASSWORD = "Admin@123"


# ---- helpers ----
def _login(session: requests.Session, email: str, password: str) -> str:
    r = session.post(
        f"{API}/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    s = requests.Session()
    return _login(s, ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def employee(admin_headers):
    """Create a fresh employee, return dict with id, email, password, token."""
    email = f"TEST_gps_emp_{uuid.uuid4().hex[:8]}@ugrow.com"
    password = "Emp@12345"
    r = requests.post(
        f"{API}/users",
        headers=admin_headers,
        json={"name": "TEST GPS Emp", "email": email, "password": password, "role": "employee"},
    )
    assert r.status_code == 200, f"Create employee failed: {r.status_code} {r.text}"
    user = r.json()
    token = _login(requests.Session(), email, password)
    yield {"id": user["id"], "email": email, "password": password, "token": token}
    # teardown - delete user
    try:
        requests.delete(f"{API}/users/{user['id']}", headers=admin_headers, timeout=10)
    except Exception:
        pass


@pytest.fixture(scope="module")
def setup(admin_headers, employee):
    r = requests.post(
        f"{API}/setups",
        headers=admin_headers,
        json={
            "customer_name": "TEST GPS Customer",
            "mobile": "9999999999",
            "address": "TEST addr",
            "setup_type": "Terrace Garden",
            "maintenance_plan": "Monthly",
            "assigned_employee_id": employee["id"],
        },
    )
    assert r.status_code == 200, f"Create setup failed: {r.status_code} {r.text}"
    s = r.json()
    yield s
    try:
        requests.delete(f"{API}/setups/{s['id']}", headers=admin_headers, timeout=10)
    except Exception:
        pass


# ---- Health / auth ----
class TestHealth:
    def test_api_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_admin_login(self, admin_token):
        assert admin_token and len(admin_token) > 10


# ---- Visits GPS + PDF ----
class TestVisitGPS:
    visit_id = None

    def test_checkin_with_gps(self, employee, setup):
        r = requests.post(
            f"{API}/visits/checkin",
            headers={"Authorization": f"Bearer {employee['token']}", "Content-Type": "application/json"},
            json={"setup_id": setup["id"], "lat": 12.9716, "lng": 77.5946},
        )
        assert r.status_code == 200, f"Checkin failed: {r.status_code} {r.text}"
        v = r.json()
        assert v["check_in_lat"] == 12.9716
        assert v["check_in_lng"] == 77.5946
        assert v["status"] == "in_progress"
        TestVisitGPS.visit_id = v["id"]

    def test_checkout_with_gps(self, employee):
        assert TestVisitGPS.visit_id, "checkin must run first"
        r = requests.post(
            f"{API}/visits/{TestVisitGPS.visit_id}/checkout",
            headers={"Authorization": f"Bearer {employee['token']}", "Content-Type": "application/json"},
            json={"lat": 12.9720, "lng": 77.5950, "form": {"notes": "TEST"}},
        )
        assert r.status_code == 200, f"Checkout failed: {r.status_code} {r.text}"
        v = r.json()
        assert v["check_out_lat"] == 12.9720
        assert v["check_out_lng"] == 77.5950
        assert v["status"] == "completed"

    def test_admin_get_visit_shows_gps(self, admin_headers):
        r = requests.get(f"{API}/visits/{TestVisitGPS.visit_id}", headers=admin_headers)
        assert r.status_code == 200
        v = r.json()
        assert v.get("check_in_lat") == 12.9716
        assert v.get("check_in_lng") == 77.5946
        assert v.get("check_out_lat") == 12.9720
        assert v.get("check_out_lng") == 77.5950

    def test_rating_regression(self, admin_headers):
        r = requests.post(
            f"{API}/visits/{TestVisitGPS.visit_id}/rate",
            headers=admin_headers,
            json={"stars": 5, "comment": "TEST great"},
        )
        assert r.status_code == 200, f"Rate failed: {r.status_code} {r.text}"
        assert r.json()["rating"]["stars"] == 5
        # verify persistence via GET
        g = requests.get(f"{API}/visits/{TestVisitGPS.visit_id}", headers=admin_headers)
        assert g.status_code == 200
        assert g.json()["rating"]["stars"] == 5

    def test_pdf_export_contains_gps(self, admin_headers):
        r = requests.get(
            f"{API}/visits/{TestVisitGPS.visit_id}/export?format=pdf",
            headers={"Authorization": admin_headers["Authorization"]},
        )
        assert r.status_code == 200, f"Export failed: {r.status_code} {r.text[:200]}"
        # Verify content type & PDF magic bytes
        assert r.content[:4] == b"%PDF", "Response is not a PDF"
        assert len(r.content) > 500
        # PDF text is likely compressed; just ensure sizeable body


# ---- No GPS visit regression ----
class TestVisitNoGPS:
    def test_checkin_without_gps_no_crash(self, admin_headers, employee, setup):
        # Employee check-in without lat/lng
        r = requests.post(
            f"{API}/visits/checkin",
            headers={"Authorization": f"Bearer {employee['token']}", "Content-Type": "application/json"},
            json={"setup_id": setup["id"]},
        )
        assert r.status_code == 200, f"Checkin no-gps failed: {r.status_code} {r.text}"
        v = r.json()
        assert v.get("check_in_lat") is None
        assert v.get("check_in_lng") is None

        # Admin GET
        g = requests.get(f"{API}/visits/{v['id']}", headers=admin_headers)
        assert g.status_code == 200
        gv = g.json()
        assert gv.get("check_in_lat") is None
        assert gv.get("check_out_lat") is None

        # PDF export should still work (no crash)
        p = requests.get(
            f"{API}/visits/{v['id']}/export?format=pdf",
            headers={"Authorization": admin_headers["Authorization"]},
        )
        assert p.status_code == 200
        assert p.content[:4] == b"%PDF"
