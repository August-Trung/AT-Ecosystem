# Another Tomorrow

Another Tomorrow is a production-quality MVP for a late-night emotional entertainment app. It opens directly into a cinematic radio/player experience and includes anonymous voice episodes, night stories, local confession drafts, archive saving, and a premium monetization screen.

This is not a medical, diagnosis, or therapy product. Crisis and self-harm language is handled by a placeholder safety flow that blocks entertainment-style previewing.

## Tech stack

- Vite
- React
- TypeScript
- CSS
- Local seed data
- Express SQLite API
- Real browser audio sample for the first broadcast
- Safe localStorage wrapper
- Vitest utility and frontend/backend E2E tests

## Run locally

```bash
npm install
npm run dev
```

Run the SQLite backend in another terminal:

```bash
npm run dev:api
```

To make the frontend call the backend, create `.env` from `.env.example` and set:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787
```

The first Rain City broadcast includes a local WAV sample at `public/audio/rain-city-signal.wav`. Other broadcasts keep the same simulated player timing until more produced audio is added.

## Validate

```bash
npm test
npm run build
```

`npm run build` now builds both deployable targets:

- `dist/` for the static Vite frontend.
- `build/server/src/server.js` for the Node API runtime.

## Project structure

- `src/data` - stations, anonymous voice episodes, night stories
- `src/screens` - Tonight, Voices, Stories, Confess, Archive, Premium
- `src/components` - shell, player controls, content actions, station visuals
- `src/utils` - moderation, formatting, localStorage helpers
- `src/hooks` - local archive state
- `server` - Express API, SQLite migrations, backend validation

## MVP notes

- Confessions are stored locally in the browser and also sent to the API when `VITE_API_BASE_URL` points to the backend.
- Public publishing, payments, narrator voices, and generated story/audio flows are mocked as production-shaped UI.
- The data models are kept explicit so Stripe and stronger moderation services can be added later.
- See `DEPLOYMENT.md` for static hosting, Render, and future SQLite backend notes.
