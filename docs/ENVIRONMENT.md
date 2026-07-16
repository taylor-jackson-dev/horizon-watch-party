# Environment Variables — the single source of truth

Every deploy-critical variable, its **exact** value/format, and **which environment
it belongs to**. When changing anything here, run the preflight first:

```bash
npm run check:env      # validates shape + confirms the DB actually connects
```

> **Rule: establish the full correct target first.** Before editing env vars, read
> this table, decide the exact value for every field, then make all edits to match —
> don't fix one error at a time through the live sign-in flow.

---

## The one gotcha that causes most of the pain: two doors to the database

Supabase exposes the same Postgres database two ways, and they are **not
interchangeable across environments**:

| Door | Host | Username | Reachable from |
|---|---|---|---|
| **Direct** | `db.<project-ref>.supabase.co:5432` | `postgres` | your local machine only |
| **Session pooler** | `aws-1-us-east-1.pooler.supabase.com:5432` | `postgres.<project-ref>` | everywhere (**required** for Vercel + Railway) |

- **Vercel and Railway cannot reach the direct host** — serverless/edge networking
  can't open it. They must use the **pooler**.
- The pooler **requires** the username to include the project ref:
  `postgres.<project-ref>` (plain `postgres` fails auth on the pooler).
- Because of this, the same variable name (`DIRECT_URL`) legitimately holds a
  **different value locally vs. in production.**

Current project ref: `szbxxnbsiubuquodgoep`.

---

## The variables

### Local — `.env.local` (this machine only)

| Variable | Value / format |
|---|---|
| `DATABASE_URL` | `postgresql://postgres.<ref>:<pw>@aws-1-us-east-1.pooler.supabase.com:5432/postgres` (pooler) |
| `DIRECT_URL` | `postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres` (**direct** — works locally) |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:3001` |
| `NEXTAUTH_SECRET` | any long random string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud |
| `LIVEKIT_URL` / `_API_KEY` / `_API_SECRET`, `YOUTUBE_API_KEY` | as issued |

### Vercel (web + API, production)

| Variable | Value / format | Notes |
|---|---|---|
| `DATABASE_URL` | pooler string, `postgres.<ref>` user | runtime DB |
| `DIRECT_URL` | **pooler** string (same as `DATABASE_URL`) | direct host unreachable here |
| `NEXTAUTH_URL` | `https://horizon-watch-party.vercel.app` | full https, no trailing slash |
| `NEXT_PUBLIC_APP_URL` | `https://horizon-watch-party.vercel.app` | **build-time inlined → redeploy after change** |
| `NEXT_PUBLIC_SOCKET_URL` | `https://horizon-watch-party-production.up.railway.app` | **build-time inlined → redeploy after change** |
| `NEXTAUTH_SECRET` | **byte-identical to Railway's** | web signs the socket JWT |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud | |
| `LIVEKIT_*`, `YOUTUBE_API_KEY`, `NEXT_PUBLIC_SUPABASE_*` | as issued | |

### Railway (socket server, production)

| Variable | Value / format | Notes |
|---|---|---|
| `DATABASE_URL` | pooler string, `postgres.<ref>` user | membership checks |
| `DIRECT_URL` | pooler string | |
| `NEXTAUTH_SECRET` | **byte-identical to Vercel's** | verifies the socket JWT |
| `SOCKET_ALLOWED_ORIGINS` | `https://horizon-watch-party.vercel.app` | CORS allowlist; exact origin, no trailing slash |

### Google Cloud Console (OAuth client)

| Setting | Value |
|---|---|
| Authorized redirect URI | `https://horizon-watch-party.vercel.app/api/auth/callback/google` |
| Authorized JavaScript origin | `https://horizon-watch-party.vercel.app` |

---

## Rules of thumb (each of these bit us at least once)

1. **Full URLs only** — `https://…`, never scheme-less. A bare `horizon-watch-party.vercel.app`
   in `NEXT_PUBLIC_APP_URL` throws `new URL()` and crashes the build.
2. **No trailing slash** on any URL var (breaks CORS origin matching and redirects).
3. **`NEXT_PUBLIC_*` need a redeploy** to take effect — they're baked in at build time.
   Saving the var is not enough.
4. **Exactly one `@`** in a connection string; the password sits between `:` and `@`.
5. **Prefer alphanumeric DB passwords** — symbols (`@ : / ? # %`) must be URL-encoded
   or they corrupt the connection string. A letters+numbers password sidesteps it.
6. **`NEXTAUTH_SECRET` must match** on Vercel and Railway, or the socket rejects the
   JWT (symptom: "Auth failed" on the socket, not a DB error).
7. After changing a DB password, propagate to **all four** prod fields
   (Vercel `DATABASE_URL`+`DIRECT_URL`, Railway `DATABASE_URL`+`DIRECT_URL`) **and**
   `.env.local`, then redeploy.

When a deploy misbehaves, read the **actual logs first** — Vercel runtime logs and
Railway logs show the real error (a DB auth failure, a thrown `new URL()`, a rejected
JWT) far faster than guessing from the browser symptom.
