"""Backend tests for the redesigned visit form checkout.

Verifies POST /api/visits/{id}/checkout persists all new fields with correct types:
- weather (string chip selection)
- plants_checked, plants_dead, plants_replaced (integers from steppers)
- toggles (booleans)
- pesticide_details (conditional string)
- photos_before/after/problem (arrays, empty ok)

And regression: GET /api/visits/{id} returns the persisted form dict.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mobile-app-build-6009.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ugrow.com"
ADMIN_PASSWORD = "Admin@123"


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{API}/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers():
    tok = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def employee(admin_headers):
    email = f"TEST_form_emp_{uuid.uuid4().hex[:8]}@ugrow.com"
    password = "Emp@12345"
    r = requests.post(
        f"{API}/users",
        headers=admin_headers,
        json={"name": "TEST Form Emp", "email": email, "password": password, "role": "employee"},
    )
    assert r.status_code == 200, f"create emp: {r.status_code} {r.text}"
    user = r.json()
    tok = _login(email, password)
    yield {"id": user["id"], "email": email, "token": tok}
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
            "customer_name": "TEST Form Customer",
            "mobile": "9999999999",
            "address": "TEST addr form",
            "setup_type": "Terrace Garden",
            "maintenance_plan": "Monthly",
            "assigned_employee_id": employee["id"],
        },
    )
    assert r.status_code == 200, f"create setup: {r.status_code} {r.text}"
    s = r.json()
    yield s
    try:
        requests.delete(f"{API}/setups/{s['id']}", headers=admin_headers, timeout=10)
    except Exception:
        pass


class TestVisitForm:
    """Full visit checkout with new form schema."""

    visit_id = None

    def test_ravi_seed_or_skip(self, admin_headers):
        # Try login ravi to confirm test creds mentioned in review request
        r = requests.post(
            f"{API}/auth/login",
            data={"username": "ravi@ugrow.com", "password": "Ravi@123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        # not required - just informational
        assert r.status_code in (200, 400, 401)

    def test_checkin_visit(self, employee, setup):
        r = requests.post(
            f"{API}/visits/checkin",
            headers={"Authorization": f"Bearer {employee['token']}", "Content-Type": "application/json"},
            json={"setup_id": setup["id"], "lat": 12.9, "lng": 77.5},
        )
        assert r.status_code == 200, f"checkin: {r.status_code} {r.text}"
        TestVisitForm.visit_id = r.json()["id"]

    def test_checkout_persists_new_form_fields(self, employee):
        assert TestVisitForm.visit_id
        form = {
            "weather": "Sunny",
            "plants_checked": 12,
            "plants_dead": 1,
            "plants_replaced": 2,
            "new_plantation": "3 tomato saplings",
            "harvest": "500g spinach",
            "watering": True,
            "weeding": True,
            "pruning": False,
            "fertilizer_type": "Vermicompost",
            "fertilizer_qty": "500g",
            "pesticide_used": True,
            "pesticide_details": "Neem oil 5ml/L, 2 sqm",
            "cleaning_done": True,
            "drip_ok": True,
            "drip_notes": "",
            "problems": "Minor aphid attack",
            "materials_used": "Compost, mulch",
            "customer_present": True,
            "customer_feedback": "Happy with growth",
            "customer_complaints": "",
            "work_summary": "Full maintenance done",
            "next_visit_recommendation": "In 3 weeks",
            "photos_before": [],
            "photos_after": [],
            "photos_problem": [],
        }
        r = requests.post(
            f"{API}/visits/{TestVisitForm.visit_id}/checkout",
            headers={"Authorization": f"Bearer {employee['token']}", "Content-Type": "application/json"},
            json={"lat": 12.9, "lng": 77.5, "form": form},
        )
        assert r.status_code == 200, f"checkout: {r.status_code} {r.text}"
        v = r.json()
        assert v["status"] == "completed"
        f = v.get("form", {})
        # scalar assertions
        assert f.get("weather") == "Sunny"
        assert f.get("plants_checked") == 12
        assert f.get("plants_dead") == 1
        assert f.get("plants_replaced") == 2
        assert isinstance(f.get("plants_checked"), int)
        # booleans preserved
        assert f.get("watering") is True
        assert f.get("pruning") is False
        assert f.get("pesticide_used") is True
        assert f.get("pesticide_details") == "Neem oil 5ml/L, 2 sqm"
        assert f.get("cleaning_done") is True
        assert f.get("drip_ok") is True
        # arrays preserved
        assert f.get("photos_before") == []
        assert f.get("photos_after") == []
        assert f.get("photos_problem") == []

    def test_get_visit_shows_persisted_form(self, admin_headers):
        r = requests.get(f"{API}/visits/{TestVisitForm.visit_id}", headers=admin_headers)
        assert r.status_code == 200
        v = r.json()
        f = v.get("form") or {}
        assert f.get("weather") == "Sunny"
        assert f.get("plants_checked") == 12
        assert f.get("pesticide_used") is True
        assert f.get("work_summary") == "Full maintenance done"

    def test_checkout_photos_as_data_urls(self, admin_headers, employee, setup):
        # separate visit for photo data-url check
        r = requests.post(
            f"{API}/visits/checkin",
            headers={"Authorization": f"Bearer {employee['token']}", "Content-Type": "application/json"},
            json={"setup_id": setup["id"]},
        )
        assert r.status_code == 200
        vid = r.json()["id"]
        # Use a very small (1x1) valid base64 data url to simulate a photo
        tiny_b64 = (
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mMEAAA"
            "AAgAB/1cQeAAAAABJRU5ErkJggg=="
        )
        data_url = f"data:image/png;base64,{tiny_b64}"
        form = {"photos_before": [data_url], "photos_after": [], "photos_problem": [data_url, data_url]}
        r2 = requests.post(
            f"{API}/visits/{vid}/checkout",
            headers={"Authorization": f"Bearer {employee['token']}", "Content-Type": "application/json"},
            json={"form": form},
        )
        assert r2.status_code == 200, f"photo checkout: {r2.status_code} {r2.text[:200]}"
        g = requests.get(f"{API}/visits/{vid}", headers=admin_headers)
        assert g.status_code == 200
        gf = g.json().get("form", {})
        assert len(gf.get("photos_before", [])) == 1
        assert gf["photos_before"][0].startswith("data:image/png;base64,")
        assert len(gf.get("photos_problem", [])) == 2
