# Mizan Mobile Native

Expo React Native version of the student-facing Mizan mobile app.

The local Next/PWA experiment is development/test only, ignored by git, and not part of production deployment.

## Improvement plan

Roadmap for LLM check-ins, notification WebSocket fixes, and native UX:

**[STUDENT_APP_PLAN.md](./STUDENT_APP_PLAN.md)**

## Run

```bash
npm install
cp .env.example .env
npm start
```

Set `EXPO_PUBLIC_API_URL` to your backend origin. Use your machine LAN IP for a physical phone, for example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:8001
```

When `EXPO_PUBLIC_API_URL` is not set, the app auto-detects your Expo host IP (good for physical devices) and falls back to `http://10.0.2.2:8000` on Android emulator or `http://localhost:8000` on iOS simulator. If Docker maps the backend to another host port, set `EXPO_PUBLIC_API_URL` explicitly.
