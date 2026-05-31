import asyncio
from datetime import date, datetime, time, timedelta, timezone
from passlib.context import CryptContext
from sqlalchemy import func, select
from app.core.database import AsyncSessionLocal
from app.models.user import User, Role
from app.models.institution import School, Filiere, Promotion, Class
from app.models.student import Student, Exam, Project
from app.models.checkin import MorningCheckin, EveningCheckin
from app.models.goal import Goal, GoalProgress
from app.models.task import Task
from app.services.schedule_seed_service import seed_schedules_for_students

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
default_password = pwd_context.hash("Mizan@2026!")

async def seed_presentation():
    async with AsyncSessionLocal() as db:
        existing_users = await db.scalar(select(func.count()).select_from(User))
        if existing_users and existing_users > 0:
            print("Demo seed skipped: database already contains users.")
            return

        today = date.today()
        now = datetime.now(timezone.utc)
        student_ids: list = []

        # 1. Global Admin
        global_admin = User(email="admin@mizan.ai", password_hash=default_password, is_active=True, role=Role.ADMIN)
        db.add(global_admin)
        await db.flush()

        # 2. School ENSET
        from app.models.institution import VerificationStatus
        enset = School(name="ENSET Mohammedia", official_identifier="ENSET-M", contact_phone="0523322220", verification_status=VerificationStatus.VERIFIED)
        db.add(enset)
        await db.flush()

        # 3. School Admin
        school_admin = User(email="admin@enset.ma", password_hash=default_password, is_active=True, role=Role.ADMIN, school_id=enset.id)
        db.add(school_admin)

        # 4. Filières, Promotions, Classes
        f_gl = Filiere(name="Génie Logiciel", school_id=enset.id)
        f_ia = Filiere(name="Intelligence Artificielle", school_id=enset.id)
        db.add_all([f_gl, f_ia])
        await db.flush()

        p_gl = Promotion(filiere_id=f_gl.id, name="Promo 2027")
        p_ia = Promotion(filiere_id=f_ia.id, name="Promo 2027")
        db.add_all([p_gl, p_ia])
        await db.flush()

        c_gl = Class(promotion_id=p_gl.id, name="GL - Groupe 1", academic_year="2025/2026")
        c_ia = Class(promotion_id=p_ia.id, name="IA - Groupe 1", academic_year="2025/2026")
        db.add_all([c_gl, c_ia])
        await db.flush()

        # Profiles
        profiles = [
            {
                "email": "nizar@enset.ma", "first": "Nizar", "last": "Stressed", 
                "class_id": c_gl.id, "moods": [4, 3, 2, 3, 2, 1, 2], "sleep": [6, 5, 4.5, 5, 4, 3.5, 4],
                "scenario": "Overwhelmed with upcoming exams, poor sleep, very stressed."
            },
            {
                "email": "yassine@enset.ma", "first": "Yassine", "last": "Thriving", 
                "class_id": c_gl.id, "moods": [7, 8, 8, 9, 8, 9, 9], "sleep": [7.5, 8, 7.5, 8, 8, 8.5, 8],
                "scenario": "Handling the workload perfectly, motivated, getting good sleep."
            },
            {
                "email": "meriem@enset.ma", "first": "Meriem", "last": "Recovering", 
                "class_id": c_ia.id, "moods": [2, 3, 4, 5, 6, 7, 7], "sleep": [4, 5, 6, 7, 7, 8, 8],
                "scenario": "Had a burnout early in the week, but Mizan agent helped her recover."
            }
        ]

        for p in profiles:
            u = User(email=p["email"], password_hash=default_password, is_active=True, role=Role.STUDENT, school_id=enset.id)
            db.add(u)
            await db.flush()

            s = Student(user_id=u.id, first_name=p["first"], last_name=p["last"], class_id=p["class_id"], cne=f"CNE_{p['first']}")
            db.add(s)
            await db.flush()
            student_ids.append(s.id)

            # Goals
            goals = [
                Goal(student_id=s.id, title="Deep Work", target_value=4, unit="hours", is_active=True),
                Goal(student_id=s.id, title="Sleep Minimum", target_value=7, unit="hours", is_active=True)
            ]
            db.add_all(goals)
            await db.flush()

            # Data Generation
            for i in range(7):
                day = today - timedelta(days=6 - i)
                mood = p["moods"][i]
                sleep = p["sleep"][i]
                mood_score = max(1, min(5, round(1 + ((mood - 1) / 9) * 4)))

                db.add(GoalProgress(goal_id=goals[0].id, date=day, value=sleep/2, note="Auto log"))
                db.add(GoalProgress(goal_id=goals[1].id, date=day, value=sleep, note="Sleep log"))

                db.add(MorningCheckin(
                    student_id=s.id, date=day, sleep_hours=sleep, mood_score=mood_score, mode="qcm",
                    executive_summary=f"Context: {p['scenario']} - Day {i+1}",
                    detailed_action_plan=["Focus on well-being", "Prepare for classes"],
                    detected_risks=["Burnout risk"] if mood_score <= 2 else [],
                    checkin_time=(now - timedelta(days=6 - i)).replace(hour=8, minute=0, second=0, microsecond=0)
                ))

                db.add(EveningCheckin(
                    student_id=s.id, date=day, plan_completed=(mood_score > 3), mood_score=mood_score,
                    notes="Finished the day.", mode="qcm",
                    executive_summary=f"Evening reflection: {p['scenario']}",
                    detailed_action_plan=["Rest well tomorrow"],
                    detected_risks=["Low energy"] if sleep < 6 else [],
                    checkin_time=(now - timedelta(days=6 - i)).replace(hour=20, minute=0, second=0, microsecond=0)
                ))

            # Add Exams and Projects for context
            db.add(Exam(student_id=s.id, subject="Architecture Logicielle", exam_date=today + timedelta(days=1), start_time=time(9,0), end_time=time(11,0), room="Amphi A"))
            db.add(Project(student_id=s.id, name="Mizan Backend", subject="Web Dev", due_date=today + timedelta(days=5), members={"team": ["You", "Others"]}))
            db.add(Task(student_id=s.id, title="Fix CORS issues", due_date=today, source="chat", status="done" if p['first'] == 'Yassine' else "pending"))

        if student_ids:
            await seed_schedules_for_students(db, student_ids, replace=True)

        await db.commit()
        print("Presentation data successfully seeded!")
        print("Demo logins: admin@mizan.ai, admin@enset.ma, nizar@enset.ma, yassine@enset.ma, meriem@enset.ma (password: Mizan@2026!)")

if __name__ == "__main__":
    asyncio.run(seed_presentation())
