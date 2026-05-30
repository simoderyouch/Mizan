# Mizan React Native — Product & Technical Specification

Complete reference for the **student mobile app** (`mizan-mobile-app`). Covers functionality, API contracts, screen plans, and UI direction.

**Web reference:** `mizan-frontend` (student routes under `app/(main)/`)  
**Backend:** `mizan-backend` at `/api/v1`  
**Last updated:** May 2026

---

## 1. Scope

### In scope (student app)

| Area | Description |
|------|-------------|
| Authentication | Login, first-time activation, password change |
| Dashboard | Home hub — rituals, week snapshot, today, schedule |
| Daily rituals | Morning / evening quiz + voice check-ins |
| Mizan AI | Text + voice chat, task suggestions |
| AI commitments | Accept / decline / complete contracts |
| Tasks | CRUD, filters, bulk actions |
| Goals | Create, log progress, deactivate |
| Focus modes | Start / stop timer, weekly stats |
| Progress | History, weekly report, mood charts |
| Resources | Personalized wellbeing content |
| Notifications | Inbox, badge, push + WebSocket |
| Profile | Photo, account info, logout |

### Out of scope

- Admin portal (`/admin/*`)
- Agent test console (`/test`, `/agent/scenarios`) — optional QA only
- PWA / offline web features
- School CMS (classes, imports, schedules admin)

---

## 2. Technical requirements

### Stack

| Item | Choice |
|------|--------|
| Framework | Expo SDK 54, React Native 0.81, React 19 |
| Navigation | React Navigation 7 (native stack + custom bottom tabs) |
| HTTP | Axios with JWT interceptors + token refresh |
| Secure storage | `expo-secure-store` (tokens) |
| Audio | `expo-audio` (record + playback) |
| Photos | `expo-image-picker` |
| Push | `expo-notifications` + Expo push token → backend |
| Icons | `lucide-react-native` |

### Environment variables

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | Backend origin (e.g. `https://your-domain.com` or `http://10.0.2.2:8000` for Android emulator) |

WebSocket URL is derived: `API_ORIGIN` with `http` → `ws`, path `/api/v1/notifications/ws?token=…`

### Device permissions

| Permission | Used for |
|------------|----------|
| Microphone | Voice check-in, AI voice chat |
| Photo library | Profile photo upload |
| Notifications | Push alerts, badge count |

### Build & run

```bash
cd mizan-mobile-app
npm ci
npx expo start          # dev
npx expo run:android    # native build
eas build --platform android   # production APK/AAB
```

Backend must be reachable with valid `MISTRAL_API_KEY` for personalized check-ins and AI.

---

## 3. API reference (mobile client)

All endpoints use base URL `{API_ORIGIN}/api/v1`. Auth header: `Bearer {access_token}`.

### 3.1 Authentication

| Method | Endpoint | Body | Response | Mobile usage |
|--------|----------|------|----------|--------------|
| POST | `/auth/login` | `{ email, password }` | `TokenResponse` | Login |
| POST | `/auth/refresh` | `{ refresh_token }` | `{ access_token }` | Auto refresh on 401 |
| GET | `/auth/me` | — | `CurrentUser` | Role check (optional) |
| POST | `/auth/request-activation` | `{ email }` | message | Activate / forgot password entry |
| POST | `/auth/verify-otp` | `{ email, otp }` | `TempTokenResponse` | OTP step |
| POST | `/auth/set-password` | `{ token, new_password }` | `TokenResponse` | First password + auto login |
| POST | `/auth/change-password` | `{ old_password, new_password }` | message | Profile |

**Not yet in mobile API client (web has them):**

| Method | Endpoint | Notes |
|--------|----------|-------|
| POST | `/auth/forgot-password` | Dedicated reset flow |
| POST | `/auth/verify-reset-otp` | Reset OTP |
| POST | `/auth/reset-password` | New password after reset |

Mobile currently routes “Forgot password?” → Activate flow (same OTP path as first activation).

### 3.2 Student

| Method | Endpoint | Response | Mobile usage |
|--------|----------|----------|--------------|
| GET | `/students/me` | `Student` | Profile, auth bootstrap |
| GET | `/students/me/context` | `StudentContext` | Dashboard (schedule, exams, mode) |
| PUT | `/students/me/push-token` | `{ token }` | Expo push registration |

**Gap — not in mobile client:**

| Method | Endpoint | Response | Web usage |
|--------|----------|----------|-----------|
| GET | `/students/me/schedules` | `ScheduleEntry[]` | Week calendar view |

### 3.3 Analytics

| Method | Endpoint | Response | Mobile usage |
|--------|----------|----------|--------------|
| GET | `/analytics/dashboard` | `StudentDashboard` | Home screen |
| GET | `/analytics/weekly-report` | `WeeklyReport` | Dashboard snapshot, weekly report |
| GET | `/analytics/mood?days=` | `MoodGraphPoint[]` | **Not wired** — web history charts |
| GET | `/analytics/modes?days=` | mode distribution | **Not wired** — could enrich history |

### 3.4 Check-ins

| Method | Endpoint | Params / body | Mobile usage |
|--------|----------|---------------|--------------|
| GET | `/checkins/morning/briefing` | — | Ritual hub |
| GET | `/checkins/questions` | `period`, `mode` (`qcm` \| `voice`) | Morning / evening quiz |
| POST | `/checkins/morning` | answers payload | Morning ritual submit |
| POST | `/checkins/evening` | answers payload | Evening ritual submit |
| GET | `/checkins/history` | `days` | History screen |

### 3.5 Voice

| Method | Endpoint | Body | Mobile usage |
|--------|----------|------|--------------|
| POST | `/voice/start` | `{ period }` | Voice check-in session |
| POST | `/voice/transcribe` | multipart audio | Transcription |
| POST | `/voice/submit` | session answers | AI analysis + recommendations |
| POST | `/voice/chat` | `{ user_text, history }` | AI chat (voice + text fallback) |

**Optional (web advanced):** WebSocket `/voice/realtime` for live voice companion — not in mobile.

### 3.6 Tasks

| Method | Endpoint | Mobile status |
|--------|----------|---------------|
| GET | `/tasks/` | ✅ List (basic) |
| POST | `/tasks/` | ✅ Create |
| POST | `/tasks/bulk` | ✅ API exists — used from chat suggestions |
| PATCH | `/tasks/{id}` | ✅ Status toggle |
| PUT | `/tasks/{id}` | ✅ Edit |
| DELETE | `/tasks/{id}` | ✅ Delete |
| POST | `/tasks/suggest-from-chat` | ✅ Agent chat |
| POST | `/tasks/complete-many` | ❌ **Missing in mobile client** |

Query params web uses: `status`, `due_date` — mobile loads all tasks client-side.

### 3.7 Goals

| Method | Endpoint | Mobile usage |
|--------|----------|--------------|
| GET | `/goals` | Goals list |
| POST | `/goals` | New goal |
| GET | `/goals/today` | Today completion % |
| GET | `/goals/{id}` | Goal detail |
| POST | `/goals/progress` | Log daily value |
| DELETE | `/goals/{id}` | Deactivate |

### 3.8 Focus modes

| Method | Endpoint | Mobile usage |
|--------|----------|--------------|
| POST | `/modes/start` | `{ mode }` — start session |
| POST | `/modes/stop` | Stop active session |
| GET | `/modes/current` | **API exists, screen uses stats.current_session** |
| GET | `/modes/stats` | Modes screen + dashboard |

Modes: `REVISION`, `EXAM`, `PROJECT`, `REST`, `SPORT`, `CLASS`.

### 3.9 Agent (Mizan AI)

| Method | Endpoint | Mobile usage |
|--------|----------|--------------|
| POST | `/agent/chat` | Text chat fallback |
| POST | `/agent/plan` | **Not wired in UI** |
| GET | `/agent/contracts` | Contracts list |
| POST | `/agent/contracts/{id}/respond` | Accept / decline |
| POST | `/agent/contracts/{id}/complete` | **Not wired in mobile UI** |
| GET/POST | `/agent/test/*` | Scenarios screen (dev) |

**Gap:** Web sends `decline_reason` on respond; mobile sends `{ accepted }` only.

### 3.10 Resources

| Method | Endpoint | Mobile usage |
|--------|----------|--------------|
| GET | `/resources` | All resources tab |
| GET | `/resources/for-me` | Personalized tab |

### 3.11 Notifications

| Method | Endpoint | Mobile usage |
|--------|----------|--------------|
| GET | `/notifications/` | Inbox, unread poll |
| PATCH | `/notifications/{id}/read` | Tap to read |
| POST | `/notifications/read-all` | Mark all read |
| WS | `/notifications/ws?token=` | Realtime + local notification |

### 3.12 Files

| Method | Endpoint | Mobile usage |
|--------|----------|--------------|
| POST | `/files/me/photo` | multipart upload |
| DELETE | `/files/me/photo` | Remove photo |

### 3.13 Health (dev / More screen)

| Method | Endpoint | Mobile usage |
|--------|----------|--------------|
| GET | `/health/detailed` | Backend status on More screen |

---

## 4. Navigation architecture

```
App
├── Auth Stack (unauthenticated)
│   ├── Login
│   ├── Activate          ← also "Forgot password"
│   ├── VerifyOtp
│   └── SetPassword
│
└── Main Stack (authenticated)
    ├── Tabs (custom bottom bar)
    │   ├── Home          → DashboardScreen
    │   ├── Ritual        → CheckinHubScreen
    │   ├── Mizan AI      → AgentChatScreen
    │   ├── Tasks         → TasksScreen
    │   └── More          → MoreScreen
    │
    └── Stack screens (from More / Dashboard / deep links)
        ├── MorningCheckin
        ├── EveningCheckin
        ├── VoiceCheckin
        ├── Goals / NewGoal / GoalDetails
        ├── Modes
        ├── History / WeeklyReport
        ├── Resources
        ├── Notifications
        ├── Profile
        ├── AgentContracts
        └── AgentScenarios (optional QA)
```

**Unread badge:** Shown on Home header bell; tab bar does not duplicate notification icon (keeps tabs clean).

---

## 5. UI / UX principles

Goal: **clean, light, calm — not crowded.** The app supports daily wellbeing, not a dense admin dashboard.

### 5.1 Visual language

| Rule | Detail |
|------|--------|
| Background | Warm off-white `#FCF9F8` — already in `theme.ts` |
| Surfaces | White cards, minimal shadow (`shadowOpacity: 0.05`) |
| Primary | Mizan blue `#005CAE` — one accent, not multiple competing colors |
| Typography | One hero line per section; avoid 30px titles everywhere |
| Density | **Max 2–3 cards visible above the fold** on Home; rest on scroll |
| Spacing | Generous padding (`spacing.lg` = 16px minimum between blocks) |
| Icons | Lucide, 18–22px inline; no icon overload per row |

### 5.2 Layout rules

1. **One primary CTA per screen** — e.g. Ritual hub → Voice check-in; Tasks → add or complete today.
2. **Progressive disclosure** — filters, bulk actions, dev info behind secondary UI (sheet, menu).
3. **Avoid stacking duplicate info** — e.g. mode distribution appears once on Home, not in three cards.
4. **Native patterns** — bottom sheets for format pickers, segmented control for tabs/filters, pull-to-refresh everywhere lists load.
5. **Empty states** — short title + one line; no large illustration blocks unless branded moment (login).
6. **Loading** — skeleton or single spinner; never flash multiple spinners on one screen.

### 5.3 What to remove or simplify (current app)

| Current | Target |
|---------|--------|
| Dashboard has 6+ cards (weekly, today, mode, schedule, quick actions) | Collapse to: **Ritual status → Today focus → Week glance → Schedule** |
| More screen shows backend URL + DB status | Move to dev-only or hide in production builds |
| Heavy purple/blue hero cards on every check-in screen | One accent hero; rest plain white |
| Tasks: create form always open at top | FAB or “Add task” sheet; list first |
| Duplicate mode stats on Dashboard + Mode card | Single “Mode & energy” row with link to Modes |

### 5.4 Motion & feedback

- Haptic on record start/stop (voice).
- Subtle press scale on list rows (`scale: 0.99`).
- Toast/snackbar for success (task created, contract accepted) — not full-width green cards.

---

## 6. Screen-by-screen specification

Status key: **Done** = usable parity | **Partial** = works but gaps vs web | **Planned** = not implemented

---

### 6.1 Auth — Login

| | |
|---|---|
| **File** | `src/screens/AuthScreens.tsx` → `LoginScreen` |
| **Status** | **Done** |
| **Purpose** | Email + password sign-in |

**Behavior**

- Validate email/password; show API error banner.
- Link to Activate flow for first-time users and “Forgot password”.
- On success → `tokenStore` + `studentsApi.me` + push token registration.

**UI**

- Centered logo, minimal fields, single primary button.
- No extra marketing copy blocks.

---

### 6.2 Auth — Activate → Verify OTP → Set Password

| | |
|---|---|
| **File** | `AuthScreens.tsx` |
| **Status** | **Done** |
| **API** | `requestActivation` → `verifyOtp` → `setPassword` |

**Behavior**

- 6-digit OTP input; temp token passed to set-password screen.
- Password min 8 chars; auto-login after set.

**Planned**

- Optional dedicated forgot-password API flow (web parity).

---

### 6.3 Home — Dashboard

| | |
|---|---|
| **File** | `src/screens/student/dashboard/DashboardScreen.tsx` |
| **Status** | **Partial** |
| **API** | `analyticsApi.dashboard`, `weeklyReport`, `studentsApi.context` |

**Should do**

| Block | Content | Priority |
|-------|---------|----------|
| Header | Greeting, ritual count (x/2), notification bell + badge | P0 |
| Ritual CTA | Primary button → voice or next open ritual | P0 |
| Today focus | **Pinned AI commitment** (accept contract → pin) | P1 — **missing** |
| Week glance | Mood, sleep, check-ins, stress badge, link to full report | P0 |
| Today | Next class, nearest deadline, quick morning/evening if pending | P0 |
| Mode | Current mode one-liner + link to Modes | P1 |
| Schedule | Today’s classes list | P0 |
| Shortcuts | Goals, Modes (2 buttons max) | P2 |

**Gaps vs web**

- No pinned commitment card (`localStorage` on web → use `AsyncStorage` on mobile).
- No week calendar — only today list (web has week navigator).
- Mood chart embedded in weekly card — OK but dense; consider sparkline only.
- Active goals count not shown in Today panel.

**UI target**

- Reduce from ~6 cards to **4 sections** with more whitespace.
- Move “Full report” link inline, not a second metrics grid duplicate.

---

### 6.4 Ritual — Check-in Hub

| | |
|---|---|
| **File** | `src/screens/student/checkin/CheckinHubScreen.tsx` |
| **Status** | **Partial** |
| **API** | `checkinsApi.morningBriefing` |

**Should do**

- Show morning/evening completion (x/2) with progress bar.
- Live window status + countdown (`useCheckinWindows`).
- Primary CTA: Voice check-in.
- Secondary: Morning / Evening quiz cards with done/open badges.
- Priority items + wellbeing alert level.

**UI target**

- Simpler hero: drop 3-metric row (mode/classes/exams) or collapse to one line.
- Large tappable morning/evening rows; voice panel as single accent block.

---

### 6.5 Ritual — Morning / Evening Quiz

| | |
|---|---|
| **Files** | `MorningCheckinScreen.tsx`, `EveningCheckinScreen.tsx`, `QuestionForm.tsx` |
| **Status** | **Partial** |
| **API** | `questions`, `createMorning` / `createEvening` |

**Should do**

1. Pick format (quiz vs voice) — `RitualFormatPicker`.
2. Load personalized questions (`GET /checkins/questions?mode=qcm`).
3. Render all answer types: `single_choice`, `boolean`, `scale`, `multi_choice`, `time_hours`, `number`, `text`.
4. Submit → show executive summary, risks, suggested tasks (select → `tasksApi.createMany`).
5. Navigate back to hub with refreshed state.

**Gaps**

- `QuestionForm` only handles subset of answer types → **Phase 2 priority**.
- Post-check-in task picker less rich than web.
- No step wizard (all questions on one scroll = feels full).

**UI target**

- One question per step with progress indicator (1/5).
- Bottom-fixed “Next” / “Submit” button.

---

### 6.6 Ritual — Voice Check-in

| | |
|---|---|
| **File** | `VoiceCheckinScreen.tsx`, `useVoiceSession.ts` |
| **Status** | **Partial** |
| **API** | `voice/start`, `transcribe`, `submit` |

**Should do**

- Start session for MORNING or EVENING period.
- Play TTS question audio when `audio_base64` present.
- Record answer → transcribe → next question.
- Final analysis screen: summary, risks, recommended tasks (checkbox add).
- Hands-free / silence detection optional polish.

**Gaps**

- Selective task creation from recommendations (web has checkboxes).
- Realtime WS voice (web `VoiceCompanion`) — optional.

**UI target**

- Full-screen calm layout: orb + status text + one record button.
- Minimal transcript list during session.

---

### 6.7 Mizan AI — Chat

| | |
|---|---|
| **File** | `src/screens/student/agent/AgentChatScreen.tsx` |
| **Status** | **Partial** |
| **API** | `voiceApi.chat` (primary), `agentApi.chat` (fallback), `tasksApi.suggestFromChat` |

**Should do**

- Text chat with history (local state; persist optional).
- Voice: record → transcribe → send; play assistant TTS.
- Starter prompt chips (web parity).
- Task suggestion cards after reply → bulk add.
- Alert when agent creates contract/notification.
- Clear conversation.

**Gaps**

- No starter prompt chips.
- No explicit “agent took action” toast.
- Chat history not persisted across sessions.

**UI target**

- Full-screen messages; composer fixed bottom.
- Hands-free toggle in header; hide keyboard when voice-first.
- Light bubbles — user blue, assistant white border.

---

### 6.8 AI Commitments — Contracts

| | |
|---|---|
| **File** | `AgentContractsScreen.tsx` |
| **Status** | **Partial** |
| **API** | `listContracts`, `respondContract` |

**Should do**

| Tab / section | Actions |
|---------------|---------|
| Pending | Accept, Decline (with reason picker) |
| Accepted | Mark complete, show on dashboard as today focus |
| History | Completed, declined, expired |

**Gaps**

- Single flat list — no Pending / Accepted / History tabs.
- No decline reason dialog.
- No `completeContract` action.
- Accept does not pin to dashboard.

**UI target**

- Segmented tabs; one contract per card; max 2 buttons visible.

---

### 6.9 Tasks

| | |
|---|---|
| **File** | `TasksScreen.tsx` |
| **Status** | **Partial** |
| **API** | CRUD + `createMany`; missing `completeMany` |

**Should do**

| Feature | Web | Mobile |
|---------|-----|--------|
| Filters (Focus/Today/Overdue/Done/All) | ✅ | ❌ |
| Source filter (Manual/AI) | ✅ | ❌ |
| Search | ✅ | ❌ |
| Create / edit / delete | ✅ | ✅ |
| Toggle complete | ✅ | ✅ |
| Bulk complete today | ✅ | ❌ |
| Multi-select delete | ✅ | ❌ |
| Commitment strip (quick accept) | ✅ | ❌ |
| Stats row | ✅ | ❌ |

**UI target**

- List-first layout; filter chips horizontal scroll under title.
- Collapse “New task” into FAB → bottom sheet form.
- Swipe or long-press for delete (optional).

---

### 6.10 Goals — List / New / Detail

| | |
|---|---|
| **Files** | `GoalsScreen`, `NewGoalScreen`, `GoalDetailsScreen` |
| **Status** | **Done** (core) |

**Should do**

- List with today % progress bar.
- Create: title, target value, unit.
- Detail: log progress (value + note), history, deactivate.

**UI target**

- Simple list cards; detail screen one log form + history list — no charts needed.

---

### 6.11 Focus Modes

| | |
|---|---|
| **File** | `ModesScreen.tsx` |
| **Status** | **Done** (core) |

**Should do**

- Show active session with live elapsed timer (**timer UI missing** — only mode name).
- Grid of 6 modes to start.
- Stop button when active.
- Weekly minutes breakdown.

**Planned**

- Live timer using `started_at` from current session.
- Haptic on start/stop.

---

### 6.12 History & Weekly Report

| | |
|---|---|
| **Files** | `HistoryScreen.tsx`, `WeeklyReportScreen.tsx` |
| **Status** | **Partial** |

**History should do**

- Period selector (7 / 14 / 30 days).
- Avg mood, sleep, check-in count.
- Mood trend chart (`analyticsApi.mood`).
- Mode distribution chart.
- Timeline cards with risks.

**Current:** 14-day fixed history, simple list, no charts, no period tabs.

**Weekly report should do**

- Week banner, stress card, mode focus breakdown, AI insights (web components).

**UI target**

- One chart per screen max; timeline as simple cards — avoid dashboard density.

---

### 6.13 Resources

| | |
|---|---|
| **File** | `ResourcesScreen.tsx` |
| **Status** | **Done** (core) |

**Should do**

- Tabs: “For me” / “All”.
- Cards by type (Video, Article, Exercise).
- Open URL in browser or in-app WebView.

---

### 6.14 Notifications

| | |
|---|---|
| **File** | `NotificationsScreen.tsx` + `AppNavigator` WS/poll |
| **Status** | **Partial** |

**Should do**

- List with read/unread styling.
- Tap → mark read + navigate (commitment, task, check-in deep link).
- Mark all read.
- Badge on Home bell; app icon badge.
- Push via Expo + WS/local notification.

**Gaps**

- No navigation on tap (only mark read).
- No type-based icons (exam, sleep, sport, etc.).

---

### 6.15 Profile

| | |
|---|---|
| **File** | `ProfileScreen.tsx` |
| **Status** | **Done** (core) |

**Should do**

- Photo upload/delete.
- Display name, email, class, CNE, member since (**email / member since missing**).
- Change password.
- Logout.

---

### 6.16 More (hub)

| | |
|---|---|
| **File** | `MoreScreen.tsx` |
| **Status** | **Partial** |

**Should do**

- Simple menu: Goals, Modes, History, Weekly report, Contracts, Resources, Notifications, Profile.

**UI target**

- Remove backend health card from production UI (dev menu only).
- Single grouped list — no metric cards.

---

### 6.17 Agent Scenarios (optional)

| | |
|---|---|
| **File** | `AgentScenariosScreen.tsx` |
| **Status** | **Done** (dev/QA) |

Internal test triggers — not required for student release.

---

## 7. Cross-cutting features

### 7.1 Auth session

- Access + refresh tokens in SecureStore.
- 401 → refresh → retry; failure → logout.
- Student role only (reject admin accounts if `auth/me` returns admin).

### 7.2 Notifications pipeline

```
Backend event → WS message → local notification + badge increment
              ↘ poll every 60s as fallback
Push token registered on login → PUT /students/me/push-token
```

### 7.3 Deep linking (planned)

| Source | Target |
|--------|--------|
| Notification `contract_id` | AgentContracts |
| Notification `task_id` | Tasks with highlight |
| Dashboard ritual CTA | VoiceCheckin / MorningCheckin |
| Pinned commitment | Tasks or Contracts |

### 7.4 Offline / errors

- Show `ErrorBanner` with retry on all data screens.
- No offline cache required for v1; graceful error messages sufficient.

---

## 8. Mobile vs web — gap summary

| Feature | Web | Mobile | Priority |
|---------|-----|--------|----------|
| Pinned commitment on dashboard | ✅ | ❌ | P1 |
| Task filters + search + bulk complete | ✅ | ❌ | P1 |
| Decline reason on contracts | ✅ | ❌ | P2 |
| Complete contract | ✅ | ❌ | P2 |
| Week schedule calendar | ✅ | ❌ (today only) | P2 |
| QuestionForm all answer types | ✅ | Partial | P1 |
| History charts + period tabs | ✅ | ❌ | P2 |
| Starter prompts in AI chat | ✅ | ❌ | P2 |
| Live mode timer | ✅ | ❌ | P3 |
| `completeMany` API wrapper | ✅ | ❌ | P1 |
| `studentsApi.mySchedules` | ✅ | ❌ | P2 |
| Forgot-password API (dedicated) | ✅ | Uses activate flow | P3 |

---

## 9. Implementation priority

### Sprint 1 — Core parity (must-have)

1. Add `tasksApi.completeMany` + task filter chips (Today / Overdue / Done).
2. Complete `QuestionForm` answer types for check-ins.
3. Pinned commitment (AsyncStorage + dashboard card).
4. Contracts: tabs + decline reasons + complete + pin on accept.

### Sprint 2 — Polish & clarity

1. Dashboard UI slim-down (4 sections, less duplicate metrics).
2. Tasks: FAB create, hide always-open form.
3. Check-in quiz step wizard.
4. Notification tap → navigate.
5. History period selector + mood API chart.

### Sprint 3 — Nice-to-have

1. Week schedule view (`/students/me/schedules`).
2. AI starter prompts + conversation persist.
3. Live mode timer.
4. Hide dev backend card in production.
5. Realtime voice WS (optional).

---

## 10. File map

| Area | Path |
|------|------|
| API client | `src/lib/api.ts` |
| Types | `src/lib/types.ts` |
| Theme | `src/theme.ts` |
| Auth | `src/context/AuthContext.tsx` |
| Navigation | `src/navigation/AppNavigator.tsx` |
| Screens | `src/screens/student/` |
| Shared UI | `src/components/ui.tsx`, `components/screen.tsx` |
| Push / local notifications | `src/lib/notifications.ts` |
| Improvement roadmap (check-ins, WS) | `STUDENT_APP_PLAN.md` |

---

## 11. Acceptance checklist (release-ready)

- [ ] Student can activate, login, logout on physical device
- [ ] Morning + evening quiz completes with LLM questions (not fallback-only)
- [ ] Voice check-in completes end-to-end with mic permission
- [ ] AI chat sends/receives; task suggestions add to task list
- [ ] Accept contract → visible as today focus on Home
- [ ] Tasks: create, complete, filter today/overdue
- [ ] Goals: create, log progress
- [ ] Modes: start/stop
- [ ] Notifications: badge updates, inbox readable
- [ ] Profile photo upload works against deployed API
- [ ] UI: Home screen feels light (≤4 main sections above fold)
- [ ] No backend debug info visible in production build

---

*For check-in LLM debugging and WebSocket hygiene, see also [STUDENT_APP_PLAN.md](./STUDENT_APP_PLAN.md).*
