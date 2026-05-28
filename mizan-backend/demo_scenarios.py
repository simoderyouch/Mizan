#!/usr/bin/env python3
"""
Mizan Demo Scenarios Generator
Creates 5 distinct scenarios showcasing Mizan's LLM/AI capabilities,
with one highlighted for the project presentation.
"""

import json
import os
import subprocess
import time
import uuid
import httpx
from datetime import date

BASE = "http://127.0.0.1:8000"
API = f"{BASE}/api/v1"

SCHOOL_NAME = f"DemoSchool_{uuid.uuid4().hex[:6]}"
ADMIN_EMAIL = f"admin_{uuid.uuid4().hex[:6]}@demo.mizan.io"
STUDENT_EMAIL = f"student_{uuid.uuid4().hex[:6]}@demo.mizan.io"
PASS = "Demo@2026!"

def db_exec(sql):
    cmd = ["docker", "exec", "mizan-db", "psql", "-U", "mizan", "-d", "mizan", "-tAc", sql]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return r.stdout.strip()
    except: return ""

def get_password_hash(password):
    cmd = ["docker", "exec", "mizan-backend", "python3", "-c",
           f"from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('{password}'))"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return r.stdout.strip()
    except: return ""

def setup_demo_student():
    """Sets up a complete student account for the demo."""
    with httpx.Client(timeout=30) as c:
        # Register school
        r = c.post(f"{API}/auth/admin/register-school", json={
            "name": SCHOOL_NAME, "admin_email": ADMIN_EMAIL, "admin_password": PASS,
            "official_identifier": "DEMO001", "contact_phone": "0600000000"
        })
        school_id = r.json().get("id")
        
        # Activate admin
        db_exec(f'''UPDATE "user" SET is_active = true WHERE email = '{ADMIN_EMAIL}';''')
        
        # Login admin
        r = c.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": PASS})
        admin_token = r.json().get("access_token")
        h = {"Authorization": f"Bearer {admin_token}"}
        
        # Create structure
        r = c.post(f"{API}/institutional/filieres", json={"name":"Genie Info","school_id":school_id}, headers=h)
        filiere_id = r.json().get("id")
        r = c.post(f"{API}/institutional/promotions", json={"name":"2026","filiere_id":filiere_id}, headers=h)
        promo_id = r.json().get("id")
        r = c.post(f"{API}/institutional/classes", json={"name":"Demo Class","promotion_id":promo_id,"academic_year":"2026"}, headers=h)
        class_id = r.json().get("id")
        
        # Create student
        r = c.post(f"{API}/students", json={
            "first_name": "Nizar", "last_name": "Demo", "email": STUDENT_EMAIL,
            "cne": f"DEMO{uuid.uuid4().hex[:5]}", "class_id": class_id
        }, headers=h)
        student_id = r.json().get("id")
        
        # Activate student
        pw_hash = get_password_hash(PASS)
        db_exec(f'''UPDATE "user" SET is_active = true, password_hash = '{pw_hash}' WHERE email = '{STUDENT_EMAIL}';''')
        
        # Login student
        r = c.post(f"{API}/auth/login", json={"email": STUDENT_EMAIL, "password": PASS})
        student_token = r.json().get("access_token")
        
        return student_token

def safe_req(c, method, url, **kw):
    try:
        return getattr(c, method)(url, **kw)
    except Exception as e:
        class FakeResp:
            status_code = 503
            def json(self): return {"error": "timeout"}
        return FakeResp()

def run_scenarios(token):
    sh = {"Authorization": f"Bearer {token}"}
    out = []
    
    with httpx.Client(timeout=60) as c:
        # ==========================================
        # SCENARIO 1 (PRESENTATION): HIGH STRESS
        # ==========================================
        out.append("# 🌟 SCENARIO 1: The Presentation (High Stress / Exam Prep)")
        out.append("*Context: Nizar has an exam tomorrow, slept very little, and feels overwhelmed.*")
        
        # 1. Trigger agent stress scenario
        c.post(f"{API}/agent/test/trigger", json={"event_type":"FORCE_HIGH_STRESS_EXAM_CRUNCH"}, headers=sh)
        
        # 2. Morning Check-in
        out.append("### 📝 Morning Check-in Analysis (Mistral AI)")
        r = safe_req(c, "post", f"{API}/checkins/morning", json={"sleep_hours":4.5,"mood_score":2,"mode":"qcm"}, headers=sh)
        if r.status_code in (200, 201):
            report = r.json().get("report", {})
            out.append(f"**Executive Summary:** {report.get('executive_summary')}")
            out.append("**Action Plan:**\n- " + "\n- ".join(report.get("detailed_action_plan", [])))
            
        # 3. Chat with Agent
        out.append("### 💬 Chat with Mizan Agent")
        msg = "Je suis tellement stressé pour l'examen de demain, je n'ai pas assez dormi et je panique."
        out.append(f"**Nizar:** {msg}")
        r = safe_req(c, "post", f"{API}/agent/chat", json={"message": msg}, headers=sh)
        if r.status_code in (200, 201):
            out.append(f"**Mizan:** {r.json().get('response')}")
        else:
            out.append("**Mizan:** (API Error / Timeout)")

        out.append("\n---\n")

        # ==========================================
        # SCENARIO 2: GOAL SETTER & MOTIVATION
        # ==========================================
        out.append("# 🚀 SCENARIO 2: The Goal Setter")
        out.append("*Context: Nizar had a great night's sleep and wants to be highly productive today.*")
        
        out.append("### 📝 Morning Check-in Analysis")
        r = safe_req(c, "post", f"{API}/checkins/morning", json={"sleep_hours":8.5,"mood_score":5,"mode":"qcm"}, headers=sh)
        if r.status_code in (200, 201):
            report = r.json().get("report", {})
            out.append(f"**Executive Summary:** {report.get('executive_summary')}")
            
        out.append("### 📅 AI Daily Plan Generation")
        r = safe_req(c, "post", f"{API}/agent/plan", json={"sleep_hours":8.5,"mood_score":5}, headers=sh)
        if r.status_code in (200, 201):
            out.append(f"**Mizan's Daily Plan:**\n{r.json().get('plan')}")
            
        out.append("### 💬 Chat with Mizan Agent")
        msg = "Je veux vraiment rester concentré aujourd'hui, comment éviter les distractions ?"
        out.append(f"**Nizar:** {msg}")
        r = safe_req(c, "post", f"{API}/agent/chat", json={"message": msg}, headers=sh)
        if r.status_code in (200, 201):
            out.append(f"**Mizan:** {r.json().get('response')}")

        out.append("\n---\n")

        # ==========================================
        # SCENARIO 3: OVERCOMING PROCRASTINATION
        # ==========================================
        out.append("# ⏳ SCENARIO 3: Overcoming Procrastination")
        out.append("*Context: Nizar is feeling sluggish and struggling to start a big project.*")
        
        out.append("### 💬 Chat with Mizan Agent")
        msg = "Je n'arrive pas à commencer mon projet d'informatique, il est trop gros et je procrastine depuis ce matin."
        out.append(f"**Nizar:** {msg}")
        r = safe_req(c, "post", f"{API}/agent/chat", json={"message": msg}, headers=sh)
        if r.status_code in (200, 201):
            out.append(f"**Mizan:** {r.json().get('response')}")

        out.append("\n---\n")

        # ==========================================
        # SCENARIO 4: POST-EXAM RECOVERY (EVENING)
        # ==========================================
        out.append("# 🌙 SCENARIO 4: Post-Exam Recovery")
        out.append("*Context: Nizar just finished a hard day of exams and does his evening check-in.*")
        
        out.append("### 📝 Evening Check-in Analysis")
        r = safe_req(c, "post", f"{API}/checkins/evening", json={"plan_completed":True,"mood_score":4,"notes":"L'examen s'est bien passé mais je suis épuisé.","mode":"voice"}, headers=sh)
        if r.status_code in (200, 201):
            report = r.json().get("report", {})
            out.append(f"**Executive Summary:** {report.get('executive_summary')}")
            out.append("**Action Plan:**\n- " + "\n- ".join(report.get("detailed_action_plan", [])))

        out.append("### 💬 Voice Chat Transcript")
        msg = "L'examen est enfin terminé, je n'ai plus du tout d'énergie pour faire quoi que ce soit ce soir."
        out.append(f"**Nizar:** {msg}")
        r = safe_req(c, "post", f"{API}/voice/chat", json={"user_text": msg, "history":[]}, headers=sh)
        if r.status_code in (200, 201):
            out.append(f"**Mizan (Audio response):** {r.json().get('agent_text')}")

        out.append("\n---\n")

        # ==========================================
        # SCENARIO 5: SAFETY FALLBACK
        # ==========================================
        out.append("# 🚨 SCENARIO 5: Safety and Ethics Fallback")
        out.append("*Context: Nizar sends a message expressing severe distress. The system bypasses normal LLM limits to enforce safety protocols.*")
        
        out.append("### 💬 Chat with Mizan Agent")
        msg = "Je n'en peux plus, je suis à bout, je veux tout abandonner et je me sens en danger."
        out.append(f"**Nizar:** {msg}")
        r = safe_req(c, "post", f"{API}/agent/chat", json={"message": msg}, headers=sh)
        if r.status_code in (200, 201):
            d = r.json()
            out.append(f"**Safety Level Triggered:** {d.get('safety_level', 'unknown')}")
            out.append(f"**Mizan:** {d.get('response')}")
            
    return "\n".join(out)

if __name__ == "__main__":
    print("Setting up student environment...")
    token = setup_demo_student()
    if not token:
        print("Failed to set up demo student.")
        exit(1)
        
    print("Running scenarios... (This will take a minute or two as it calls Mistral AI multiple times)")
    output = run_scenarios(token)
    
    with open("presentation_scenarios.md", "w") as f:
        f.write(output)
        
    print("\n✅ Scenarios generated successfully in 'presentation_scenarios.md'!")
