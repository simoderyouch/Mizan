# Mizan — The Autonomous Student Wellbeing Agent
### 🏷️ GIEW 2026: Wellness & Agent Challenge Submission
**Deadline:** April 14, 2026 | **Team:** Mizan Team

> **Mission**: Transforming student stress into focused serenity through a proactive, agentic AI companion.

---

## 🚀 Live Demo & Access

Mizan is fully deployed and ready for immediate evaluation.

*   **Mobile PWA (Primary User Hub):** [https://mizanm.mohamededderyouch.me/](https://mizanm.mohamededderyouch.me/)
*   **Web Dashboard:** [https://mizan.mohamededderyouch.me/](https://mizan.mohamededderyouch.me/)
*   **API Documentation:** [https://api.mohamededderyouch.me/docs](https://api.mohamededderyouch.me/docs)

### 🔑 Credentials for Evaluation
| Role | Email | Password |
| :--- | :--- | :--- |
| **Student** | `mohamededderyouch5@gmail.com` | `Simosimo1` |
| **Admin (School Head)** | `admin@mizanmail.local` | `Admin123!` |

---

## 🎯 The Problem: The "Silent Crisis" in Education
Modern students face a fragmented digital environment. Between overwhelming schedules, looming deadlines, and high-pressure exams, mental wellbeing is often sacrificed. Students don't need another "to-do list"; they need an **intelligent partner** that understands their state and intervenes before burnout happens.

**Mizan** (Balance) is that partner. It is a **Sense-Think-Decide-Act** autonomous agent.

---

## 🤖 The Mizan Agent: How it Works
Mizan satisfies the four pillars of a "True AI Agent":

### 1️⃣ SENSE: Multi-Modal Contextual Input
Mizan autonomously monitors:
- **Ritual Data**: Morning/Evening check-ins (Mood, Sleep, Stress).
- **Academic Context**: Real-time schedule updates, exam dates, and project milestones.
- **Autonomous Triggers**: Institutional updates (e.g., a new exam added) or "Silence Risks" (missed rituals).

### 2️⃣ THINK: Deep LLM Reasoning
Mizan uses a **ReAct (Reason + Action) Planner** powered by **Mistral AI**. 
Instead of hard-coded responses, it reflects on the unified student context:
> *"The student has had low mood for 2 days and has an exam tomorrow. A high-pressure revision task might increase anxiety. I should instead suggest a 20-minute recovery mode followed by a micro-sprint."*

### 3️⃣ DECIDE: Personalized Strategy
Mizan automatically selects the most effective intervention:
- **`PROPOSE_MODE_SWITCH`**: Transitions the entire UI into a specialized mode (REVISION, REPOS, etc.).
- **`CREATE_TASK`**: Generates a low-friction "Adaptive Win" task.
- **`AGENT_SYNC`**: Clones class-wide academic content to the student dashboard.

### 4️⃣ ACT: Direct Intervention
Mizan takes concrete action by updating the UI, sending proactive notifications, and managing the focus environment.

---

## 🏗️ Technology Stack & Architecture

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Brain** | Mistral AI (Large/Mini) | Core Reasoning & Planning |
| **Backend** | FastAPI (Python 3.12) | High-performance Agent Orchestration |
| **Frontend** | Next.js 14 + Tailwind | Glassmorphic "Digital Sanctuary" PWA |
| **Voice** | Mistral Voxtral (STT/TTS) | Real-time Audio Transcription & Synthesis |
| **Infrastructure** | Docker & AWS EC2 | Production-grade deployment with Nginx & SSL |

```mermaid
graph TD
    User([User Mobile/Web]) -- HTTPS --> Nginx[Nginx SSL]
    Nginx --> Backend[FastAPI Backend Agent]
    Backend <--> Mistral[Mistral AI LLM/Voice]
    Backend --> DB[(PostgreSQL)]
    Admin[School Head] -- "Admin Panel" --> Backend
    Backend -- "Auto-Assignment" --> Student[Student Dashboard]
```

---

## 🎭 Impact Scenarios

### 🌊 Scenario 1: The Burnout Guard
**Detects** sustained low mood. **Identifies** overdue projects. **Decides** to lower the cognitive barrier. **Transitions** app to `REPOS` mode and hides non-essential tasks.
*Result: Immediate reduction in user anxiety and prevention of total burnout.*

### 📚 Scenario 2: The Exam Strategist
**Identifies** an exam tomorrow with no study logged. **Reasons** procrastination due to pressure. **Proposes** `EXAMEN` mode with a "30-min Triage" task. **Locks** the dashboard focus.
*Result: Transformation of "analysis paralysis" into a concrete academic win.*

---

## 🛠️ Local Setup

1.  **Clone**: `git clone https://github.com/simoderyouch/Mizan.git && cd Mizan`
2.  **Env**: `cp .env.compose.example .env.compose` (Set your `MISTRAL_API_KEY`).
3.  **Run**: `docker compose --env-file .env.compose up -d --build`

---
*Created with 💚 by Team Mizan for the Eudaimonia Club AI Competition.*
