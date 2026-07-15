"""UGrow Naturals — Field Service backend (FastAPI + Motor)."""
from __future__ import annotations

import csv
import io
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, List, Optional

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "ugrow_db")
SECRET_KEY = os.environ.get("JWT_SECRET", "ugrow-dev-secret-change-me-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

client: AsyncIOMotorClient | None = None
db = None

logger = logging.getLogger("ugrow")
logging.basicConfig(level=logging.INFO)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


# ---------- Models ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str  # admin | employee
    mobile: Optional[str] = None
    address: Optional[str] = None
    profile_photo: Optional[str] = None
    status: str = "active"
    joining_date: Optional[str] = None
    created_at: str


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    mobile: Optional[str] = None
    address: Optional[str] = None
    profile_photo: Optional[str] = None
    role: str = "employee"
    joining_date: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    profile_photo: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None
    joining_date: Optional[str] = None


class SetupIn(BaseModel):
    customer_name: str
    mobile: Optional[str] = None
    address: Optional[str] = None
    gmap_link: Optional[str] = None
    setup_type: str = "Terrace Garden"
    installation_date: Optional[str] = None
    maintenance_plan: str = "Monthly"
    assigned_employee_id: Optional[str] = None
    status: str = "active"


class VisitCheckIn(BaseModel):
    setup_id: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class VisitCheckOut(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    form: dict = Field(default_factory=dict)


class RatingIn(BaseModel):
    stars: int = Field(ge=1, le=5)
    comment: Optional[str] = ""


# ---------- Auth helpers ----------
def create_token(user: dict) -> str:
    to_encode = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


def _clean_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "name": u["name"],
        "email": u["email"],
        "role": u["role"],
        "mobile": u.get("mobile"),
        "address": u.get("address"),
        "profile_photo": u.get("profile_photo"),
        "status": u.get("status", "active"),
        "joining_date": u.get("joining_date"),
        "created_at": u.get("created_at") if isinstance(u.get("created_at"), str) else iso(u.get("created_at")),
    }


def _clean_setup(s: dict) -> dict:
    s = dict(s)
    s.pop("_id", None)
    return s


def _clean_visit(v: dict) -> dict:
    v = dict(v)
    v.pop("_id", None)
    for k in ("check_in_time", "check_out_time", "created_at", "rated_at"):
        val = v.get(k)
        if isinstance(val, datetime):
            v[k] = iso(val)
    return v


# ---------- Lifespan / seed ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # Idempotent admin seed
    existing = await db.users.find_one({"email": "admin@ugrow.com"})
    if not existing:
        admin_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": admin_id,
            "name": "Admin",
            "email": "admin@ugrow.com",
            "password_hash": pwd_context.hash("Admin@123"),
            "role": "admin",
            "status": "active",
            "created_at": iso(now_utc()),
        })
        logger.info("Seeded admin@ugrow.com / Admin@123")

    # Indices
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.setups.create_index("id", unique=True)
    await db.visits.create_index("id", unique=True)
    await db.visits.create_index([("check_in_time", -1)])
    await db.notifications.create_index([("created_at", -1)])

    yield
    client.close()


app = FastAPI(lifespan=lifespan, title="UGrow Naturals API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Router ----------
from fastapi import APIRouter
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"app": "UGrow Naturals", "ok": True}


# ---- Auth ----
@api.post("/auth/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"email": form.username})
    if not user or not pwd_context.verify(form.password, user.get("password_hash", "")):
        raise HTTPException(400, "Invalid email or password")
    if user.get("status") == "inactive":
        raise HTTPException(403, "Account inactive")
    token = create_token(user)
    return {"access_token": token, "token_type": "bearer", "user": _clean_user(user)}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return _clean_user(user)


# ---- Users ----
@api.get("/users")
async def list_users(role: Optional[str] = None, user=Depends(require_admin)):
    q = {}
    if role:
        q["role"] = role
    rows = await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return [_clean_user(r) for r in rows]


@api.post("/users")
async def create_user(payload: UserCreate, user=Depends(require_admin)):
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(400, "Email already exists")
    doc = payload.dict()
    doc["password_hash"] = pwd_context.hash(doc.pop("password"))
    doc["id"] = str(uuid.uuid4())
    doc["status"] = "active"
    doc["created_at"] = iso(now_utc())
    await db.users.insert_one(doc)
    return _clean_user(doc)


@api.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, user=Depends(require_admin)):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if "password" in update:
        update["password_hash"] = pwd_context.hash(update.pop("password"))
    if not update:
        raise HTTPException(400, "No fields")
    res = await db.users.find_one_and_update({"id": user_id}, {"$set": update}, return_document=True)
    if not res:
        raise HTTPException(404, "User not found")
    return _clean_user(res)


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, user=Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}


# ---- Setups ----
@api.get("/setups")
async def list_setups(user=Depends(get_current_user)):
    q = {}
    if user["role"] == "employee":
        q["assigned_employee_id"] = user["id"]
    rows = await db.setups.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # attach employee name
    emp_ids = list({r.get("assigned_employee_id") for r in rows if r.get("assigned_employee_id")})
    emp_map = {}
    if emp_ids:
        async for u in db.users.find({"id": {"$in": emp_ids}}, {"_id": 0, "id": 1, "name": 1}):
            emp_map[u["id"]] = u["name"]
    for r in rows:
        r["assigned_employee_name"] = emp_map.get(r.get("assigned_employee_id"))
    return rows


@api.get("/setups/{setup_id}")
async def get_setup(setup_id: str, user=Depends(get_current_user)):
    s = await db.setups.find_one({"id": setup_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Setup not found")
    if user["role"] == "employee" and s.get("assigned_employee_id") != user["id"]:
        raise HTTPException(403, "Not your setup")
    if s.get("assigned_employee_id"):
        emp = await db.users.find_one({"id": s["assigned_employee_id"]}, {"_id": 0, "name": 1})
        s["assigned_employee_name"] = emp["name"] if emp else None
    visits = await db.visits.find({"setup_id": setup_id}, {"_id": 0}).sort("check_in_time", -1).to_list(100)
    s["visits"] = [_clean_visit(v) for v in visits]
    return s


@api.post("/setups")
async def create_setup(payload: SetupIn, user=Depends(require_admin)):
    doc = payload.dict()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = iso(now_utc())
    await db.setups.insert_one(doc)
    return _clean_setup(doc)


@api.put("/setups/{setup_id}")
async def update_setup(setup_id: str, payload: SetupIn, user=Depends(require_admin)):
    res = await db.setups.find_one_and_update(
        {"id": setup_id}, {"$set": payload.dict()}, return_document=True
    )
    if not res:
        raise HTTPException(404, "Setup not found")
    return _clean_setup(res)


@api.delete("/setups/{setup_id}")
async def delete_setup(setup_id: str, user=Depends(require_admin)):
    await db.setups.delete_one({"id": setup_id})
    return {"ok": True}


# ---- Visits ----
@api.post("/visits/checkin")
async def checkin(payload: VisitCheckIn, user=Depends(get_current_user)):
    setup = await db.setups.find_one({"id": payload.setup_id}, {"_id": 0})
    if not setup:
        raise HTTPException(404, "Setup not found")
    if user["role"] == "employee" and setup.get("assigned_employee_id") != user["id"]:
        raise HTTPException(403, "Not assigned to this setup")

    visit = {
        "id": str(uuid.uuid4()),
        "setup_id": payload.setup_id,
        "employee_id": user["id"],
        "employee_name": user["name"],
        "customer_name": setup.get("customer_name"),
        "setup_type": setup.get("setup_type"),
        "check_in_time": iso(now_utc()),
        "check_in_lat": payload.lat,
        "check_in_lng": payload.lng,
        "check_out_time": None,
        "check_out_lat": None,
        "check_out_lng": None,
        "duration_minutes": None,
        "status": "in_progress",
        "form": {},
        "rating": None,
        "created_at": iso(now_utc()),
    }
    await db.visits.insert_one(visit)

    # In-app notifications for all admins
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
    notifs = []
    for a in admins:
        notifs.append({
            "id": str(uuid.uuid4()),
            "admin_id": a["id"],
            "type": "check_in",
            "title": "New Check-In",
            "body": f"{user['name']} checked in at {setup.get('customer_name')}",
            "visit_id": visit["id"],
            "setup_id": setup["id"],
            "read": False,
            "created_at": iso(now_utc()),
        })
    if notifs:
        await db.notifications.insert_many(notifs)

    return _clean_visit(visit)


@api.post("/visits/{visit_id}/checkout")
async def checkout(visit_id: str, payload: VisitCheckOut, user=Depends(get_current_user)):
    visit = await db.visits.find_one({"id": visit_id}, {"_id": 0})
    if not visit:
        raise HTTPException(404, "Visit not found")
    if visit["employee_id"] != user["id"] and user["role"] != "admin":
        raise HTTPException(403, "Not your visit")

    check_in = visit["check_in_time"]
    if isinstance(check_in, str):
        ci = datetime.fromisoformat(check_in.replace("Z", "+00:00"))
    else:
        ci = check_in
    end = now_utc()
    duration = int((end - ci).total_seconds() // 60)

    update = {
        "check_out_time": iso(end),
        "check_out_lat": payload.lat,
        "check_out_lng": payload.lng,
        "duration_minutes": max(1, duration),
        "status": "completed",
        "form": payload.form,
    }
    res = await db.visits.find_one_and_update({"id": visit_id}, {"$set": update}, return_document=True)
    return _clean_visit(res)


@api.get("/visits")
async def list_visits(
    limit: int = 100,
    employee_id: Optional[str] = None,
    setup_id: Optional[str] = None,
    status_: Optional[str] = Query(None, alias="status"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(get_current_user),
):
    q: dict = {}
    if user["role"] == "employee":
        q["employee_id"] = user["id"]
    if employee_id:
        q["employee_id"] = employee_id
    if setup_id:
        q["setup_id"] = setup_id
    if status_:
        q["status"] = status_
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to + "T23:59:59"
        q["check_in_time"] = rng
    rows = await db.visits.find(q, {"_id": 0}).sort("check_in_time", -1).to_list(limit)
    return [_clean_visit(v) for v in rows]


@api.get("/visits/{visit_id}")
async def get_visit(visit_id: str, user=Depends(get_current_user)):
    v = await db.visits.find_one({"id": visit_id}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Visit not found")
    if user["role"] == "employee" and v["employee_id"] != user["id"]:
        raise HTTPException(403, "Not your visit")
    return _clean_visit(v)


@api.post("/visits/{visit_id}/rate")
async def rate_visit(visit_id: str, payload: RatingIn, user=Depends(require_admin)):
    res = await db.visits.find_one_and_update(
        {"id": visit_id},
        {"$set": {"rating": {"stars": payload.stars, "comment": payload.comment}, "rated_at": iso(now_utc())}},
        return_document=True,
    )
    if not res:
        raise HTTPException(404, "Visit not found")
    return _clean_visit(res)


# ---- Dashboard ----
@api.get("/dashboard/stats")
async def dashboard(user=Depends(require_admin)):
    today_start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    total_visits_today = await db.visits.count_documents({"check_in_time": {"$gte": today_start}})
    completed_today = await db.visits.count_documents({"check_in_time": {"$gte": today_start}, "status": "completed"})
    working_now = await db.visits.count_documents({"status": "in_progress"})
    active_setups = await db.setups.count_documents({"status": "active"})
    employees = await db.users.count_documents({"role": "employee", "status": "active"})
    pending = max(0, total_visits_today - completed_today - working_now)
    recent = await db.visits.find({}, {"_id": 0}).sort("check_in_time", -1).to_list(10)
    return {
        "todays_visits": total_visits_today,
        "completed": completed_today,
        "pending": pending,
        "working_now": working_now,
        "active_setups": active_setups,
        "employees": employees,
        "recent_activity": [_clean_visit(v) for v in recent],
    }


# ---- Notifications ----
@api.get("/notifications")
async def list_notifs(user=Depends(require_admin)):
    rows = await db.notifications.find({"admin_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    unread = await db.notifications.count_documents({"admin_id": user["id"], "read": False})
    return {"items": rows, "unread": unread}


@api.post("/notifications/{notif_id}/read")
async def read_notif(notif_id: str, user=Depends(require_admin)):
    await db.notifications.update_one({"id": notif_id, "admin_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def read_all(user=Depends(require_admin)):
    await db.notifications.update_many({"admin_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---- Reports (CSV / PDF) ----
def _rows_for_export(visits: List[dict], setup_map: dict, emp_map: dict) -> List[List[Any]]:
    header = ["Date", "Customer", "Employee", "Check-In", "Check-Out", "Duration (min)", "Status", "Rating", "Setup Type"]
    out = [header]
    for v in visits:
        ci = v.get("check_in_time") or ""
        co = v.get("check_out_time") or ""
        out.append([
            ci[:10],
            v.get("customer_name") or "",
            v.get("employee_name") or "",
            ci[11:16] if len(ci) >= 16 else "",
            co[11:16] if len(co) >= 16 else "",
            v.get("duration_minutes") or "",
            v.get("status") or "",
            (v.get("rating") or {}).get("stars") if v.get("rating") else "",
            v.get("setup_type") or "",
        ])
    return out


@api.get("/reports/visits")
async def reports_visits(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    employee_id: Optional[str] = None,
    setup_id: Optional[str] = None,
    status_: Optional[str] = Query(None, alias="status"),
    format: Optional[str] = None,
    user=Depends(require_admin),
):
    q: dict = {}
    if employee_id:
        q["employee_id"] = employee_id
    if setup_id:
        q["setup_id"] = setup_id
    if status_:
        q["status"] = status_
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to + "T23:59:59"
        q["check_in_time"] = rng
    visits = await db.visits.find(q, {"_id": 0}).sort("check_in_time", -1).to_list(2000)
    visits = [_clean_visit(v) for v in visits]

    if not format:
        return {"items": visits, "count": len(visits)}

    fname_base = f"visits_{date_from or 'all'}_to_{date_to or 'all'}"

    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        for row in _rows_for_export(visits, {}, {}):
            writer.writerow(row)
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{fname_base}.csv"'},
        )

    if format == "pdf":
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm)
        styles = getSampleStyleSheet()
        elements: list = []
        elements.append(Paragraph("<b>UGrow Naturals — Visit Report</b>", styles["Title"]))
        elements.append(Paragraph(f"Range: {date_from or 'All'} → {date_to or 'All'}  |  Visits: {len(visits)}", styles["Normal"]))
        elements.append(Spacer(1, 0.4 * cm))
        table_data = _rows_for_export(visits, {}, {})
        t = Table(table_data, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#064E3B")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E7EB")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(t)
        doc.build(elements)
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{fname_base}.pdf"'},
        )

    raise HTTPException(400, "Invalid format")


@api.get("/visits/{visit_id}/export")
async def export_single_visit(visit_id: str, format: str = "pdf", user=Depends(require_admin)):
    v = await db.visits.find_one({"id": visit_id}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Visit not found")
    v = _clean_visit(v)

    if format != "pdf":
        raise HTTPException(400, "Only pdf supported")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    els: list = []
    els.append(Paragraph("<b>UGrow Naturals — Visit Report</b>", styles["Title"]))
    els.append(Spacer(1, 0.3 * cm))
    meta = [
        ["Customer", v.get("customer_name") or ""],
        ["Employee", v.get("employee_name") or ""],
        ["Setup Type", v.get("setup_type") or ""],
        ["Check-In", (v.get("check_in_time") or "")[:19].replace("T", " ")],
        ["Check-Out", (v.get("check_out_time") or "")[:19].replace("T", " ")],
        ["Duration", f"{v.get('duration_minutes') or 0} min"],
        ["Status", v.get("status") or ""],
        ["Rating", str((v.get("rating") or {}).get("stars") or "-")],
    ]
    t = Table(meta, colWidths=[4 * cm, 12 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E7EB")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    els.append(t)
    els.append(Spacer(1, 0.5 * cm))

    form = v.get("form") or {}
    if form:
        els.append(Paragraph("<b>Maintenance Form</b>", styles["Heading2"]))
        rows = []
        for k, val in form.items():
            if isinstance(val, (str, int, float, bool)) or val is None:
                rows.append([k.replace("_", " ").title(), str(val) if val is not None else "-"])
            elif isinstance(val, list):
                if val and isinstance(val[0], str) and val[0].startswith("data:"):
                    rows.append([k.replace("_", " ").title(), f"{len(val)} photo(s)"])
                else:
                    rows.append([k.replace("_", " ").title(), ", ".join(map(str, val))])
            elif isinstance(val, dict):
                rows.append([k.replace("_", " ").title(), ", ".join(f"{a}: {b}" for a, b in val.items())])
        if rows:
            ft = Table(rows, colWidths=[6 * cm, 10 * cm])
            ft.setStyle(TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E7EB")),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]))
            els.append(ft)

    if v.get("rating") and v["rating"].get("comment"):
        els.append(Spacer(1, 0.4 * cm))
        els.append(Paragraph(f"<b>Admin Comment:</b> {v['rating']['comment']}", styles["Normal"]))

    doc.build(els)
    buf.seek(0)
    fname = f"visit_{(v.get('customer_name') or 'report').replace(' ', '_')}_{(v.get('check_in_time') or '')[:10]}.pdf"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


app.include_router(api)
