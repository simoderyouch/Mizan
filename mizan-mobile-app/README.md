# Mizan Mobile

Expo React Native app for **students**: check-ins, voice rituals, agent chat, tasks, goals, focus modes, and notifications.

## Requirements

- Node.js 20+
- Expo Go or EAS build for device testing
- Running [Mizan backend](../mizan-backend) (local Docker or deployed API)

## Setup

```bash
npm ci
cp .env.example .env
npm start
```

## Configuration

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend origin, e.g. `http://192.168.1.10:8000` |

On a physical device, use your machine **LAN IP** (not `localhost`). Android emulator fallback: `http://10.0.2.2:8000`. iOS simulator: `http://localhost:8000`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Expo dev server |
| `npm run android` / `npm run ios` | Native run |
| `npm run typecheck` | TypeScript check (also run in CI) |

## Production builds

Mobile is distributed via **EAS Build** (APK/IPA), not AWS ECS. See [DEPLOYMENT_README.md](../DEPLOYMENT_README.md).

## Related docs

- [Root README](../README.md)
- [Architecture](../docs/ARCHITECTURE.md)
