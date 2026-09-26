# OAU Vehicle Pass — Mobile

Expo Router app for the vehicle pass system. Two roles, selected by the
`role` field on the account:

- **Driver** — register a vehicle, carry the signed QR pass.
- **Gate officer / admin** — scan QR passes or plates at the barrier, override
  decisions, review the day's access log. Works offline off a cached
  whitelist/blacklist snapshot.

## Run

```bash
npm install
npm start          # then press a / i / w
npm run typecheck
npm run lint
```

The API base URL comes from `EXPO_PUBLIC_API_URL` (see `.env`). Without it the
app talks to `10.0.2.2:3000` on Android emulators and `localhost:3000`
elsewhere.

## Layout

```
app/
  (auth)/    login, register
  (driver)/  home, vehicles, register vehicle, QR pass
  (gate)/    scanner, result, today's log
lib/
  api.ts          fetch wrapper + typed endpoints
  auth-client.ts  better-auth client (session in SecureStore)
  offline-gate.ts cached whitelist/blacklist + queued access logs
  use-list.ts     fetch-once + pull-to-refresh state
```

The offline snapshot lives in `Paths.document/gate-cache` as JSON, not in
SecureStore — SecureStore caps values around 2 KB on Android, which a real
whitelist blows straight through.
