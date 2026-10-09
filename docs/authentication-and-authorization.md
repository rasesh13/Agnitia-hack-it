# Authentication and Authorization

Related: [security.md](security.md) · [api-reference.md](api-reference.md#4-authentication) · [frontend.md](frontend.md#3-state-management)

---

## 1. Summary

| Aspect | Implementation | Source |
| --- | --- | --- |
| Credential types | Email and password; Google Sign-In (ID token) | `backend/api/routes_auth.py` |
| Password hashing | Argon2id: time cost 3, memory 64 MiB, parallelism 4, 32-byte hash, 16-byte salt | `backend/services/auth_crypto.py` |
| Session mechanism | Stateless JWT access token, HS256, signed with `JWT_SECRET_KEY` | `auth_crypto.create_access_token` |
| Token claims | `sub` (user ID), `email`, `role`, `token_version`, `iat`, `exp` | same |
| Lifetime | `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (default 120). No refresh token. | `backend/config.py` |
| Revocation | `users.token_version`, incremented by `POST /api/v1/auth/logout`. Every protected HTTP request compares it. | `backend/api/deps.py` |
| Transport | `Authorization: Bearer <jwt>` for HTTP; `?token=<jwt>` for the WebSocket | |
| Client storage | Web: `localStorage.surya_token`. Mobile: Capacitor Preferences `surya.session`. | `frontend/src/context/AuthContext.tsx`, `mobile/src/lib/storage.ts` |
| Roles | `admin`, `operator`, `viewer` | `backend/models/user.py` |
| Rate limiting | Login 15/min, signup 10/min, Google 10/min per IP (in memory) | `backend/api/rate_limit.py` |

## 2. Flows

Source: [diagrams/authentication-flow.mmd](diagrams/authentication-flow.mmd)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant FE as Web console
    participant G as Google Identity Services
    participant API as /api/v1/auth
    participant DB as users
    alt Email + password
        U->>FE: email, password
        FE->>API: POST /login
        API->>DB: find by lower(email)
        API->>API: Argon2id verify
        API-->>FE: access_token + user
    else Google
        U->>G: pick account
        G-->>FE: ID token
        FE->>API: POST /google {id_token}
        API->>G: JWKS, verify RS256 / aud / iss / email_verified
        API->>DB: by google_sub, else email, else create
        API-->>FE: access_token + user
    end
    FE->>FE: store token in localStorage
    FE->>API: Bearer token on each request; /ws?token=
```

How to read it: the two `alt` branches are the two ways to obtain the same `TokenResponse`. After that, both are handled identically.

### Registration (`POST /signup`)

- The email must be unique (case-insensitive lookup) and the password 8–128 characters.
- **Role bootstrap:** the first user in an empty `users` table becomes `admin`; every later signup becomes `viewer`. Development and demo seeding create users first, so in practice signups are `viewer`.
- The response logs the user in immediately.

### Login (`POST /login`)

- Unknown email, wrong password and Google-only accounts (no `password_hash`) all return `401 INVALID_CREDENTIALS`, so the response does not reveal which emails exist.
- An inactive account returns `403 USER_INACTIVE`.

### Google Sign-In (`POST /google`)

- **Server-side verification:** `backend/services/google_identity.py` verifies the token against Google's JWKS using RS256. It requires `exp`, `iat`, `iss`, `aud` and `sub`, checks the issuer is `accounts.google.com`, that `aud == GOOGLE_CLIENT_ID`, and that `email_verified is True`.
- **Disabled state:** if `GOOGLE_CLIENT_ID` is unset, the endpoint returns `503`.
- **Account linking:** an existing password user with the same email is linked to the Google subject on first Google login.
- **New users get `operator`** (`admin` if the table is empty). This is more privileged than email signup (`viewer`), so anyone with a Google account can become an operator and trigger optimisation cycles.
- **Hard-coded promotion:** one specific email address is always promoted to `admin` on Google login (`routes_auth.py`). See [security.md](security.md#findings).
- **Client side:** `GoogleSignInButton` loads `https://accounts.google.com/gsi/client` and initialises it with `VITE_GOOGLE_CLIENT_ID`.

### Token validation (`get_current_user`)

1. A missing token returns `401 AUTH_REQUIRED`.
2. The token is decoded (HS256). An expired token returns `AUTH_TOKEN_EXPIRED`; a bad signature or bad claims return `AUTH_TOKEN_INVALID`.
3. The user is loaded by `sub`. If it is missing or inactive, the response is `USER_NOT_FOUND_OR_INACTIVE`.
4. If `token_version` differs from the user's, the response is `AUTH_TOKEN_REVOKED`.

All of these return `401` with `WWW-Authenticate: Bearer`.

### WebSocket authentication

`WebSocketManager.authenticate_and_connect` only decodes the JWT; it does not check `token_version` or `is_active`. An invalid token closes the socket with code `1008`. A token revoked by logout keeps working for WebSockets until it expires.

### Logout

- `POST /api/v1/auth/logout` revokes every token belonging to the user.
- The **web console does not call it**. Its "Sign out" only clears `localStorage`, so the token stays valid until it expires (120 min by default).
- The mobile app also signs out locally only.

## 3. Authorization matrix

| Capability | viewer | operator | admin | Unauthenticated |
| --- | :-: | :-: | :-: | :-: |
| Read twin, telemetry, decisions, settings, export | ✔ | ✔ | ✔ | ✘ |
| Connect to `/ws` | ✔ | ✔ | ✔ | ✘ |
| Force an optimisation cycle | ✘ | ✔ | ✔ | ✘ |
| Acknowledge a control command | ✘ | ✔ | ✔ | ✘ |
| Update thresholds, building tiers, VNM rules, battery limits, control policy | ✘ | ✘ | ✔ | ✘ |
| Engage or release the emergency stop | ✘ | ✘ | ✔ | ✘ |
| **ML twin and forecast routes** (reset to zero, apply prediction, start/stop stream, reload models, train region) | ✔ | ✔ | ✔ | **✔ (no auth)** |

Notes:

- Enforcement is in the backend dependencies (`require_*`). The console's `ProtectedRoute` and hidden Settings tab, and the mobile app's role checks, are UI conveniences only.
- There is no per-site or per-resource authorization. Every user can read every `site_id`.
- No API exists to change a user's role, deactivate a user or list users. Use direct SQL, for example `UPDATE users SET role='OPERATOR' WHERE email=...`; enum names are stored in upper case, see [database.md](database.md#5-enum-storage-database-vs-application).

## 4. Demo accounts

When seeding runs (development, test, or `SEED_DEMO_DATA=true`), `backend/db/seed_demo_data.py` creates two **admin** accounts. Their password is hard-coded in that file, and the same credentials appear in the console's one-click demo login (`frontend/src/pages/Login.tsx`) and the mobile app's `DEMO_ACCOUNT` (`mobile/src/screens/SignIn.tsx`). Anyone who reads the public repository can therefore sign in as admin on any deployment that seeds demo data, including the Render blueprint (`SEED_DEMO_DATA: "true"`). This document deliberately does not repeat the credentials.

## 5. CORS

- `CORSMiddleware` allows the origins in `CORS_ORIGINS` (a comma-separated string or JSON list), with credentials, all methods and all headers.
- In production a wildcard `*` is rejected at startup.
- Cookies are not used, so `allow_credentials` has no practical effect.
- When the console calls a backend on another origin (Vercel → Render), the console's origin must be listed. Otherwise sign-in fails with a CORS error in the browser.
