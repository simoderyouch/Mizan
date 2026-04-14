# Mizan: The Digital Sanctuary Agent
### 🟢 Eudaimonia Club AI Competition Submission

> **Mission**: Transforming student stress into focused serenity through autonomous AI companionship.

---

## 🎯 The Problem: The "Silent Crisis" in Education
Modern students face a fragmented digital environment. Between overwhelming schedules, looming deadlines, and high-pressure exams, mental wellbeing is often sacrificed. Students don't need another "to-do list"; they need an **intelligent partner** that understands their state and intervenes before burnout happens.

**Mizan** (Balance) is that partner. It isn't a chatbot; it is a **Sense-Think-Decide-Act** autonomous agent.

---

## 🤖 The Mizan Agent: How it Works
Mizan satisfies the four pillars of a "True AI Agent" as defined by the competition:

### 1️⃣ SENSE: Multi-Modal Contextual Input
Mizan doesn't just wait for messages. It autonomously monitors:
- **Ritual Data**: Morning/Evening check-ins (Mood, Sleep, Stress).
- **Academic Context**: Realtime schedule updates, exam dates, and project milestones.
- **Autonomous Triggers**: Metadata changes (e.g., a new exam added) or "Silence Risks" (missed rituals).

### 2️⃣ THINK: Deep LLM Reasoning
Mizan uses a **ReAct (Reason + Action) Planner** powered by **Mistral AI**. 
Instead of hard-coded responses, it reflects on the unified student context:
> *"The student has had low mood for 2 days and has an exam tomorrow. A high-pressure revision task might increase anxiety. I should instead suggest a 20-minute recovery mode followed by a micro-sprint."*

### 3️⃣ DECIDE: Personalized Strategy
Mizan automatically selects the most effective intervention from its arsenal:
- **`PROPOSE_MODE_SWITCH`**: Transitions the entire UI into a "Sanctuary Mode" (REVISION, REPOS, etc.).
- **`CREATE_TASK`**: Generates a low-friction "Adaptive Win" task.
- **`SEND_RESOURCE_NUDGE`**: Recommends a specific wellbeing exercise (Breathing, Posture, Reset).
- **`ESCALATE_WELLBEING`**: High-priority intervention for critical stress levels.

### 4️⃣ ACT: Direct Intervention
Mizan takes concrete action by:
- Updating the UI theme to reduce cognitive load.
- Sending proactive notifications (not just replies).
- Forging "Action Contracts" to increase commitment.
- Managing the user's focus environment.

---

## 🛠️ Technology Stack & Architecture

Mizan is built for stability, scale, and premium user experience:

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Brain** | Mistral AI (Large/Mini) | Core Reasoning & Planning |
| **Backend** | FastAPI (Python) | High-performance Agent Orchestration |
| **Frontend** | Next.js 14 + Tailwind | Glassmorphic "Digital Sanctuary" PWA |
| **Realtime** | WebSockets | Live Voice Companion & Instant Nudges |
| **Voice** | Voxtral-Mini (Mistral) | Realtime Audio Transcription & TTS |
| **Data** | PostgreSQL + SQLAlchemy | Persistent Student Context & History |

---

## 🎭 Impact Scenarios (Demonstrating Utility)

### 🌊 Scenario 1: The Burnout Guard
Detects sustained low mood (SENSE). Identifies "Overdue Projects" (THINK). Decides to lower the cognitive barrier (DECIDE). Transitions app to `REPOS` mode and hides non-essential tasks (ACT).
**Result**: Immediate reduction in user anxiety and prevention of total burnout.

### 📚 Scenario 2: The Exam Strategist
Identifies an exam tomorrow + no study logged (SENSE). Reasons that the student is likely procrastinating due to pressure (THINK). Proposes `EXAMEN` mode with a "30-min Triage" task (DECIDE). Creates the task and locks the dashboard focus (ACT).
**Result**: Transformation of "analysis paralysis" into a concrete academic win.

---

## 🚀 Judge's Evaluation Guide (Quick Start)

### 1. Requirements
- Docker & Docker Compose
- Mistral AI API Key

### 2. Launching Mizan
```bash
# Clone the repository
git clone https://github.com/[YOUR_USERNAME]/mizan.git
cd mizan

# Configure your keys
cp .env.example .env
# Edit .env and enter your MISTRAL_API_KEY

# Launch the entire sanctuary
docker-compose up --build
```

### 3. Testing the Agent
- **Access**: Open `http://localhost:3000` (PWA) or `http://localhost:8000/docs` (API).
- **Trigger**: Complete a "Morning Check-in" with a "Low Mood" score.
- **Watch**: Observe how the agent autonomously suggests a mode switch and creates a tailored "Recovery Task" based on your input.

---

## 🌟 Expected Impact
Mizan's goal is to improve the **Academic Retention Rate** and **Subjective Wellbeing Score** of its users. By offloading "Stress Orchestration" to an autonomous agent, students can reclaim their focus and mental health.

---
*Created with 💚 by Team Mizan for the Eudaimonia Club AI Competition.*
