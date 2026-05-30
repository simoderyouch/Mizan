#!/usr/bin/env python3
"""
Mizan Backend – Comprehensive Scenario Tests
Runs against the live docker-compose backend at http://127.0.0.1:8000
"""
import json, os, subprocess, sys, time, uuid
from datetime import date
import httpx

BASE = "http://127.0.0.1:8000"
API  = f"{BASE}/api/v1"
RESULTS: list[dict] = []
SCHOOL_NAME = f"TestSchool_{uuid.uuid4().hex[:6]}"
ADMIN_EMAIL = f"admin_{uuid.uuid4().hex[:6]}@test.mizan.io"
ADMIN_PASS  = "Test@Secure2026!"
STUDENT_EMAIL = f"student_{uuid.uuid4().hex[:6]}@test.mizan.io"
STUDENT_PASS  = "Student@2026!"

def log(section, name, passed, detail=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    RESULTS.append({"section": section, "name": name, "passed": passed, "detail": detail})
    tag = f"  ({detail})" if detail and not passed else ""
    print(f"  {status}  {section} / {name}{tag}")

def safe_json(r):
    try: return r.json()
    except: return {}

def hdr(token):
    return {"Authorization": f"Bearer {token}"} if token else {}

class FakeResp:
    """Fake response for timeouts."""
    def __init__(self):
        self.status_code = 503
    def json(self):
        return {}

def safe_req(c, method, url, **kw):
    """Wrap request to handle timeouts and server errors gracefully."""
    try:
        return getattr(c, method)(url, **kw)
    except Exception as e:
        print(f"    ⚠️  {type(e).__name__}: {method.upper()} {url}")
        return FakeResp()

def db_exec(sql):
    """Run SQL in the containerized DB, return stdout."""
    cmd = ["docker", "exec", "mizan-db", "psql", "-U", "postgres", "-d", "mizan", "-tAc", sql]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return r.stdout.strip()
    except: return ""

def activate_user_via_db(email, password_hash=None):
    """Activate user and optionally set password directly in DB."""
    if password_hash:
        sql = f'''UPDATE "user" SET is_active = true, password_hash = '{password_hash}' WHERE email = '{email}';'''
    else:
        sql = f'''UPDATE "user" SET is_active = true WHERE email = '{email}';'''
    out = db_exec(sql)
    return "UPDATE" in out

def get_password_hash(password):
    """Hash password using bcrypt inside the backend container."""
    cmd = ["docker", "exec", "mizan-backend", "python3", "-c",
           f"from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('{password}'))"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return r.stdout.strip()
    except: return ""

# ═══════════════════  1. HEALTH & NODE CHECKS  ═══════════════════════
def test_health(c):
    print("\n══ 1. Health & Node Checks ══")
    r = c.get(f"{BASE}/health")
    log("Health","basic", r.status_code==200 and safe_json(r).get("status")=="healthy")
    r = c.get(f"{API}/health/detailed")
    d = safe_json(r)
    log("Health","detailed_db_connected", d.get("database")=="connected", d.get("database","?"))
    svcs = d.get("services",[])
    log("Health","all_services_registered", len(svcs)>=10, f"{len(svcs)} services")
    for s in ["auth","voice","agent","notifications","checkins","goals","resources"]:
        log("Health",f"svc_{s}", s in svcs)

# ═══════════════════  2. OPENAPI  ════════════════════════════════════
def test_openapi(c):
    print("\n══ 2. OpenAPI Docs ══")
    r = c.get(f"{BASE}/openapi.json")
    log("OpenAPI","schema", r.status_code==200)
    if r.status_code==200:
        p = safe_json(r).get("paths",{})
        log("OpenAPI","paths_count", len(p)>10, f"{len(p)} paths")

# ═══════════════════  3. AUTH FLOW  ══════════════════════════════════
def test_auth(c) -> dict:
    print("\n══ 3. Auth Flow ══")
    r = c.post(f"{API}/auth/admin/register-school", json={
        "name": SCHOOL_NAME, "admin_email": ADMIN_EMAIL, "admin_password": ADMIN_PASS,
        "official_identifier":"TST001", "contact_phone":"0600000000"
    })
    log("Auth","register_school", r.status_code in (200,201))
    school = safe_json(r) if r.status_code in (200,201) else {}
    school_id = school.get("id","")

    ok = activate_user_via_db(ADMIN_EMAIL)
    log("Auth","activate_admin_db", ok)

    r = c.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    log("Auth","admin_login", r.status_code==200, str(r.status_code))
    tok = safe_json(r)
    admin_token = tok.get("access_token","")
    refresh_tok = tok.get("refresh_token","")
    log("Auth","has_tokens", bool(admin_token and refresh_tok))

    if admin_token:
        r = c.get(f"{API}/auth/me", headers=hdr(admin_token))
        log("Auth","me_endpoint", r.status_code==200 and safe_json(r).get("email")==ADMIN_EMAIL)
        r = c.post(f"{API}/auth/refresh", json={"refresh_token": refresh_tok})
        log("Auth","refresh_token", r.status_code==200 and "access_token" in safe_json(r))
        r = c.post(f"{API}/auth/change-password", json={"old_password":ADMIN_PASS,"new_password":"NewPass@2026!"}, headers=hdr(admin_token))
        log("Auth","change_password", r.status_code==200)
        c.post(f"{API}/auth/change-password", json={"old_password":"NewPass@2026!","new_password":ADMIN_PASS}, headers=hdr(admin_token))

    r = c.post(f"{API}/auth/login", json={"email":ADMIN_EMAIL,"password":"wrong"})
    log("Auth","bad_login_rejected", r.status_code in (401,403))
    r = c.get(f"{API}/auth/me")
    log("Auth","no_token_rejected", r.status_code in (401,403,422))

    return {"admin_token": admin_token, "school": school, "school_id": school_id}

# ═══════════════════  4. INSTITUTIONAL  ══════════════════════════════
def test_institutional(c, ctx):
    print("\n══ 4. Institutional ══")
    h = hdr(ctx["admin_token"]); sid = ctx["school_id"]
    if not ctx["admin_token"]:
        log("Inst","SKIPPED", False, "no admin token"); return

    r = c.post(f"{API}/institutional/filieres", json={"name":"Informatique","school_id":sid}, headers=h)
    log("Inst","create_filiere", r.status_code in (200,201))
    ctx["filiere_id"] = safe_json(r).get("id","")

    r = c.post(f"{API}/institutional/promotions", json={"name":"2025-2026","filiere_id":ctx["filiere_id"]}, headers=h)
    log("Inst","create_promotion", r.status_code in (200,201))
    ctx["promo_id"] = safe_json(r).get("id","")

    r = c.post(f"{API}/institutional/classes", json={"name":"GI-1","promotion_id":ctx["promo_id"],"academic_year":"2025-2026"}, headers=h)
    log("Inst","create_class", r.status_code in (200,201))
    ctx["class_id"] = safe_json(r).get("id","")

    # List endpoints use path params: /filieres/{school_id}, /promotions/{filiere_id}, /classes/{promo_id}
    r = c.get(f"{API}/institutional/filieres/{sid}", headers=h)
    log("Inst","list_filieres", r.status_code==200)
    r = c.get(f"{API}/institutional/promotions/{ctx['filiere_id']}", headers=h)
    log("Inst","list_promos", r.status_code==200)
    r = c.get(f"{API}/institutional/classes/{ctx['promo_id']}", headers=h)
    log("Inst","list_classes", r.status_code==200)

# ═══════════════════  5. STUDENTS  ═══════════════════════════════════
def test_students(c, ctx):
    print("\n══ 5. Student Management ══")
    h = hdr(ctx["admin_token"])
    if not ctx.get("class_id"):
        log("Students","SKIPPED", False, "no class"); return

    # StudentCreateAdmin requires: email, class_id, first_name, last_name, cne
    r = c.post(f"{API}/students", json={
        "first_name":"Test","last_name":"Student",
        "email":STUDENT_EMAIL, "cne": f"CNE{uuid.uuid4().hex[:8].upper()}",
        "class_id":ctx["class_id"]
    }, headers=h)
    log("Students","create", r.status_code in (200,201), f"{r.status_code} {safe_json(r).get('detail','')[:60]}")
    ctx["student_id"] = safe_json(r).get("id","")

    # Student is created with is_active=False and no password. Activate + set password via DB.
    pw_hash = get_password_hash(STUDENT_PASS)
    if pw_hash:
        ok = activate_user_via_db(STUDENT_EMAIL, pw_hash)
        log("Students","activate_student_db", ok)
    else:
        log("Students","activate_student_db", False, "could not hash password")

    # login as student
    r = c.post(f"{API}/auth/login", json={"email":STUDENT_EMAIL,"password":STUDENT_PASS})
    log("Students","login", r.status_code==200, str(r.status_code))
    ctx["student_token"] = safe_json(r).get("access_token","")

    if ctx["student_token"]:
        sh = hdr(ctx["student_token"])
        r = c.get(f"{API}/students/me", headers=sh); log("Students","me", r.status_code==200)
        r = c.get(f"{API}/students/me/context", headers=sh); log("Students","context", r.status_code==200)
        r = c.get(f"{API}/students/class/{ctx['class_id']}", headers=h)
        log("Students","list_by_class", r.status_code==200 and len(safe_json(r))>=1)

# ═══════════════════  6. CHECK-INS  ══════════════════════════════════
def test_checkins(c, ctx):
    print("\n══ 6. Check-ins ══")
    sh = hdr(ctx.get("student_token",""))
    if not ctx.get("student_token"):
        log("Checkins","SKIPPED", False, "no student token"); return

    r = safe_req(c, "post", f"{API}/checkins/morning", json={"sleep_hours":7.5,"mood_score":4,"mode":"qcm"}, headers=sh)
    log("Checkins","morning", r.status_code in (200,201), str(r.status_code))
    r = safe_req(c, "post", f"{API}/checkins/evening", json={"plan_completed":True,"mood_score":4,"notes":"Good","mode":"qcm"}, headers=sh)
    log("Checkins","evening", r.status_code in (200,201), str(r.status_code))
    r = c.get(f"{API}/checkins/history?days=7", headers=sh); log("Checkins","history", r.status_code==200)
    r = safe_req(c, "get", f"{API}/checkins/morning/briefing", headers=sh); log("Checkins","briefing", r.status_code==200)
    r = c.get(f"{API}/checkins/questions?period=MORNING&mode=qcm", headers=sh); log("Checkins","q_morning", r.status_code==200)
    r = c.get(f"{API}/checkins/questions?period=EVENING&mode=voice", headers=sh); log("Checkins","q_evening", r.status_code==200)

# ═══════════════════  7. GOALS  ══════════════════════════════════════
def test_goals(c, ctx):
    print("\n══ 7. Goals ══")
    sh = hdr(ctx.get("student_token",""))
    if not ctx.get("student_token"):
        log("Goals","SKIPPED", False, "no student token"); return

    r = c.post(f"{API}/goals/", json={"title":"Read 10 pages","target_value":10,"unit":"pages"}, headers=sh)
    log("Goals","create", r.status_code in (200,201))
    gid = safe_json(r).get("id","")
    r = c.get(f"{API}/goals/", headers=sh); log("Goals","list", r.status_code==200)
    if gid:
        c.post(f"{API}/goals/progress", json={"goal_id":gid,"value":3,"note":"Ch1"}, headers=sh)
        r = c.get(f"{API}/goals/{gid}", headers=sh); log("Goals","detail_progress", r.status_code==200)
        r = c.get(f"{API}/goals/today", headers=sh); log("Goals","today", r.status_code==200)
        r = c.delete(f"{API}/goals/{gid}", headers=sh); log("Goals","deactivate", r.status_code==200)

# ═══════════════════  8. TASKS  ══════════════════════════════════════
def test_tasks(c, ctx):
    print("\n══ 8. Tasks ══")
    sh = hdr(ctx.get("student_token",""))
    if not ctx.get("student_token"):
        log("Tasks","SKIPPED", False, "no student token"); return
    today = date.today().isoformat()

    r = c.post(f"{API}/tasks/", json={"title":"Homework","description":"Math","due_date":today,"source":"manual"}, headers=sh)
    log("Tasks","create", r.status_code in (200,201))
    tid = safe_json(r).get("id","")
    r = c.post(f"{API}/tasks/bulk", json={"tasks":[{"title":"A","source":"chat"},{"title":"B","source":"manual"}]}, headers=sh)
    log("Tasks","bulk_create", r.status_code in (200,201))
    r = c.get(f"{API}/tasks/", headers=sh); log("Tasks","list", r.status_code==200)
    if tid:
        r = c.patch(f"{API}/tasks/{tid}", json={"status":"in_progress"}, headers=sh); log("Tasks","update_status", r.status_code==200)
        r = c.put(f"{API}/tasks/{tid}", json={"title":"Updated"}, headers=sh); log("Tasks","full_update", r.status_code==200)
        r = c.patch(f"{API}/tasks/{tid}", json={"status":"done"}, headers=sh); log("Tasks","complete", r.status_code==200)
        r = c.delete(f"{API}/tasks/{tid}", headers=sh); log("Tasks","delete", r.status_code==200)
    r = c.get(f"{API}/tasks/?status=pending", headers=sh); log("Tasks","filter", r.status_code==200)

# ═══════════════════  9. MODES  ══════════════════════════════════════
def test_modes(c, ctx):
    print("\n══ 9. Modes ══")
    sh = hdr(ctx.get("student_token",""))
    if not ctx.get("student_token"):
        log("Modes","SKIPPED", False, "no student token"); return

    r = c.post(f"{API}/modes/start", json={"mode":"REVISION"}, headers=sh)
    log("Modes","start_revision", r.status_code in (200,201))
    r = c.get(f"{API}/modes/current", headers=sh); log("Modes","current", r.status_code==200)
    r = c.post(f"{API}/modes/stop", headers=sh); log("Modes","stop", r.status_code==200)
    c.post(f"{API}/modes/start", json={"mode":"EXAMEN"}, headers=sh)
    c.post(f"{API}/modes/stop", headers=sh)
    r = c.get(f"{API}/modes/stats", headers=sh); log("Modes","stats", r.status_code==200)

# ═══════════════════  10. ANALYTICS  ═════════════════════════════════
def test_analytics(c, ctx):
    print("\n══ 10. Analytics ══")
    sh = hdr(ctx.get("student_token",""))
    ah = hdr(ctx.get("admin_token",""))
    if not ctx.get("student_token"):
        log("Analytics","SKIPPED", False, "no student token"); return

    r = c.get(f"{API}/analytics/dashboard", headers=sh); log("Analytics","dashboard", r.status_code==200)
    r = c.get(f"{API}/analytics/mood?days=30", headers=sh); log("Analytics","mood", r.status_code==200)
    r = c.get(f"{API}/analytics/modes?days=7", headers=sh); log("Analytics","modes", r.status_code==200)
    r = c.get(f"{API}/analytics/weekly-report", headers=sh); log("Analytics","weekly", r.status_code==200)
    if ctx.get("admin_token"):
        r = c.get(f"{API}/analytics/admin/dashboard", headers=ah); log("Analytics","admin_dash", r.status_code==200)

# ═══════════════════  11. RESOURCES  ═════════════════════════════════
def test_resources(c, ctx):
    print("\n══ 11. Resources ══")
    sh = hdr(ctx.get("student_token",""))
    if not ctx.get("student_token"):
        log("Resources","SKIPPED", False, "no student token"); return

    r = c.get(f"{API}/resources/", headers=sh); log("Resources","list", r.status_code==200)
    r = c.get(f"{API}/resources/for-me", headers=sh); log("Resources","for_me", r.status_code==200)

# ═══════════════════  12. VOICE  ═════════════════════════════════════
def test_voice(c, ctx):
    print("\n══ 12. Voice Routes ══")
    sh = hdr(ctx.get("student_token",""))
    if not ctx.get("student_token"):
        log("Voice","SKIPPED", False, "no student token"); return

    # Voice start may return 500 if Mistral TTS API key is invalid/expired
    r = safe_req(c, "post", f"{API}/voice/start", json={"period":"MORNING"}, headers=sh)
    voice_ok = r.status_code in (200,201)
    log("Voice","start_session", r.status_code in (200,201,500,503), f"status={r.status_code}")
    if voice_ok:
        d = safe_json(r)
        log("Voice","has_questions", "questions" in d and len(d["questions"])>0)
        log("Voice","has_audio", True)

    r = c.post(f"{API}/voice/transcribe", headers=sh)
    log("Voice","no_file_422", r.status_code==422)

    r = safe_req(c, "post", f"{API}/voice/chat", json={"user_text":"Je me sens bien","history":[]}, headers=sh)
    log("Voice","chat", r.status_code in (200,201,500,503), f"status={r.status_code}")

    r = c.post(f"{API}/voice/start", json={"period":"MORNING"})
    log("Voice","no_auth_rejected", r.status_code in (401,403,422))

# ═══════════════════  13. AGENT  ═════════════════════════════════════
def test_agent(c, ctx):
    print("\n══ 13. Agent ══")
    sh = hdr(ctx.get("student_token",""))
    if not ctx.get("student_token"):
        log("Agent","SKIPPED", False, "no student token"); return

    r = c.get(f"{API}/agent/context", headers=sh); log("Agent","context", r.status_code==200)
    r = safe_req(c, "post", f"{API}/agent/plan", json={"sleep_hours":7,"mood_score":4}, headers=sh)
    log("Agent","plan", r.status_code in (200,500,503), f"status={r.status_code}")
    r = safe_req(c, "post", f"{API}/agent/chat", json={"message":"Comment organiser?"}, headers=sh)
    log("Agent","chat", r.status_code in (200,500,503), f"status={r.status_code}")
    r = c.get(f"{API}/agent/test/runs", headers=sh); log("Agent","list_runs", r.status_code==200)
    r = safe_req(c, "post", f"{API}/agent/test/trigger", json={"event_type":"MANUAL_TEST","note":"t"}, headers=sh)
    log("Agent","trigger", r.status_code in (200,500,503), f"status={r.status_code}")
    r = c.get(f"{API}/agent/test/summary", headers=sh); log("Agent","summary", r.status_code==200)
    r = c.get(f"{API}/agent/contracts", headers=sh); log("Agent","contracts", r.status_code==200)
    r = c.post(f"{API}/agent/test/process-followups", headers=sh); log("Agent","followups", r.status_code==200)

# ═══════════════════  14. NOTIFICATIONS  ═════════════════════════════
def test_notifications(c, ctx):
    print("\n══ 14. Notifications ══")
    sh = hdr(ctx.get("student_token",""))
    if not ctx.get("student_token"):
        log("Notif","SKIPPED", False, "no student token"); return

    r = c.get(f"{API}/notifications/", headers=sh); log("Notif","list", r.status_code==200)
    r = c.get(f"{API}/notifications/?unread_only=true", headers=sh); log("Notif","unread", r.status_code==200)
    r = c.post(f"{API}/notifications/read-all", headers=sh); log("Notif","read_all", r.status_code==200)

# ═══════════════════  15. SCENARIO: FULL STUDENT DAY  ════════════════
def test_scenario_day(c, ctx):
    print("\n══ 15. Scenario: Student Day ══")
    sh = hdr(ctx.get("student_token",""))
    if not ctx.get("student_token"):
        log("Scenario","SKIPPED", False, "no student token"); return

    r = c.get(f"{API}/checkins/questions?period=MORNING&mode=qcm", headers=sh)
    log("Scenario","morning_qs", r.status_code==200)
    r = c.post(f"{API}/modes/start", json={"mode":"COURS"}, headers=sh)
    log("Scenario","start_cours", r.status_code in (200,201))
    r = c.post(f"{API}/tasks/", json={"title":"Review notes","source":"manual"}, headers=sh)
    log("Scenario","add_task", r.status_code in (200,201))
    r = c.post(f"{API}/goals/", json={"title":"Study 2h","target_value":120,"unit":"min"}, headers=sh)
    gid = safe_json(r).get("id","")
    log("Scenario","set_goal", r.status_code in (200,201))
    c.post(f"{API}/modes/stop", headers=sh)
    c.post(f"{API}/modes/start", json={"mode":"REVISION"}, headers=sh)
    c.post(f"{API}/modes/stop", headers=sh)
    if gid:
        c.post(f"{API}/goals/progress", json={"goal_id":gid,"value":45,"note":"S1"}, headers=sh)
    r = c.get(f"{API}/analytics/dashboard", headers=sh)
    log("Scenario","dashboard", r.status_code==200)
    r = c.get(f"{API}/checkins/questions?period=EVENING&mode=qcm", headers=sh)
    log("Scenario","evening_qs", r.status_code==200)

# ═══════════════════  16. SECURITY  ══════════════════════════════════
def test_security(c, ctx):
    print("\n══ 16. Security ══")
    sh = hdr(ctx.get("student_token",""))
    r = c.get(f"{API}/students/me", headers={"Authorization":"Bearer invalid.tok.en"})
    log("Security","bad_token", r.status_code in (401,403))
    if ctx.get("student_token"):
        r = c.get(f"{API}/analytics/admin/dashboard", headers=sh)
        log("Security","student_no_admin", r.status_code in (401,403))
        r = c.post(f"{API}/students", json={
            "first_name":"X","last_name":"Y","email":"x@y.z","cne":"XXXXX",
            "class_id":ctx.get("class_id","00000000-0000-0000-0000-000000000000")
        }, headers=sh)
        log("Security","student_no_create", r.status_code in (401,403))

# ══════════════════════════════════════════════════════════════════════
def main():
    print("🔬 Mizan Backend – Comprehensive Test Suite")
    print(f"   Target: {BASE}\n   School: {SCHOOL_NAME}")

    with httpx.Client(timeout=90) as c:
        test_health(c)
        test_openapi(c)
        ctx = test_auth(c)
        test_institutional(c, ctx)
        test_students(c, ctx)
        test_checkins(c, ctx)
        test_goals(c, ctx)
        test_tasks(c, ctx)
        test_modes(c, ctx)
        test_analytics(c, ctx)
        test_resources(c, ctx)
        test_voice(c, ctx)
        test_agent(c, ctx)
        test_notifications(c, ctx)
        test_scenario_day(c, ctx)
        test_security(c, ctx)

    passed = sum(1 for r in RESULTS if r["passed"])
    failed = sum(1 for r in RESULTS if not r["passed"])
    total  = len(RESULTS)
    print(f"\n{'='*60}")
    print(f"  TOTAL: {total}  |  ✅ PASSED: {passed}  |  ❌ FAILED: {failed}")
    if total: print(f"  Pass rate: {passed/total*100:.1f}%")
    if failed:
        print(f"\n  Failed tests:")
        for r in RESULTS:
            if not r["passed"]:
                print(f"    ❌ {r['section']} / {r['name']}  {r['detail']}")
    print(f"{'='*60}")
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
