# Mt. Olivet Methodist Church Management System

A church management web application (FastAPI backend + React frontend) for managing
members, donations/finances, events, ministries, announcements and attendance.

## Features

- Member directory and profiles (contact details, family, baptism/membership dates)
- Donations, tithes, expenses and receipts with finance reporting
- Events, ministries, announcements and attendance tracking
- Role-based access: member, pastor, finance officer, administrator
- Offline-first: queued writes replay when back online

## Project layout

- `backend/` — FastAPI application (entry point `backend/main.py`)
- `frontend/` — React SPA (build output in `frontend/dist`)
- `api/index.py` — Vercel serverless entrypoint

## Configuration

Copy `.env.example` to `.env` and set the values:

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL/TiDB connection |
| `JWT_SECRET` | Secret used to sign JWTs. **Must be a long random value.** |
| `JWT_ACCESS_EXPIRE_MINUTES` | Access-token lifetime (default 15) |
| `JWT_REFRESH_EXPIRE_DAYS` | Refresh-token lifetime (default 7) |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `WEB_HOST`, `WEB_PORT` | Where the API server binds |

## Running locally

```bash
pip install -r requirements.txt
python backend/main.py        # API at http://localhost:8080
# then build/serve the frontend (see frontend/)
```

## Authentication model

- **Access tokens** are short-lived JWTs (`typ: "access"`) sent as
  `Authorization: Bearer <token>`.
- **Refresh tokens** are longer-lived JWTs (`typ: "refresh"`) tracked server-side in
  the `refresh_tokens` table. On `/api/auth/refresh` the presented refresh token is
  rotated (the old one is revoked) and a new access+refresh pair is issued.
- Logging out or changing a password revokes all of a user's refresh tokens, forcing
  re-authentication.
- Self-registration is limited to the `member` role; staff roles require an admin.
- All writes are rate-limited on login/registration, and DB queries are parameterised.

## Security

- Passwords are hashed with bcrypt; plaintext passwords are never stored.
- CORS is restricted to `CORS_ORIGINS` — do **not** set it to `*` with credentials.
- `/api/health` returns only online status and version (no DB internals).
- **Deployment checklist:**
  - Use a strong, unique `JWT_SECRET` and rotate it if exposed.
  - Use a strong database password and restrict DB network access (IP allowlist / private network).
  - Terminate TLS (HTTPS) at your proxy so tokens are not sent in cleartext.
  - Keep `.env` out of version control (it is git-ignored).

## Privacy

This system stores personal and financial data. See **`PRIVACY.md`** for the data
protection policy. Registration requires explicit acceptance of that policy. If you
operate this system you are responsible for complying with applicable data-protection
law (e.g. Ghana Data Protection Act, 2012; GDPR where relevant).
