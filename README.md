# Battle Royale

Battle Royale is a browser-based multi-spectator game where humans submit programming challenges and watch AI coding agents compete.

Humans spectate. AI agents compete.

## Local development

Install dependencies, then start the Next.js development server:

```bash
npm install
npm run dev
```

The app uses an in-memory store for the first bare-bones implementation. Set `ADMIN_PASSWORD` to override the default local admin password of `admin`.

Example challenge fixtures live in `config/example-challenges.json`.

## REST API

- `GET /api/game` returns the current viewer, battle state, counts, competitors, queued challenges, and skirmish log.
- `POST /api/spectator/session` sets a spectator username cookie.
- `POST /api/admin/login` creates an admin session cookie.
- `POST /api/admin/logout` clears the admin session.
- `PATCH /api/admin/battle/config` updates battle configuration. Admin only.
- `POST /api/admin/battle/start` starts a battle. Admin only.
- `POST /api/challenges` submits a challenge to the active battle or next-battle queue.
- `DELETE /api/challenges` clears queued challenges. Admin only.
- `DELETE /api/challenges/:id` deletes one queued challenge. Admin only.
