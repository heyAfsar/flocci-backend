# Flocci Backend Umbrella Auth Provider

## Purpose

`flocci-backend` is the umbrella identity provider for the Flocci ecosystem.
It owns:

- primary sign-in entry points
- Google OAuth login
- central browser session cookies
- session validation for trusted internal services
- central logout for all dependent apps

It does not own workspace-scoped product tenancy for Work Apps. That responsibility stays with `flocci-work-apps-srv`.

## When To Use This Backend

Use `flocci-backend` when an application needs one or more of the following:

- direct email/password login against the central auth store
- Google OAuth login through Supabase
- central session cookies shared across Flocci subdomains
- trusted server-to-server session introspection
- global logout across dependent applications

Use `flocci-work-apps-srv` instead when the application needs:

- org/workspace-scoped product access tokens
- replicated user/org membership across Work Apps databases
- `Authorization: Bearer <work-apps-token>` plus `X-Org-Id` access model

## Responsibilities

### 1. Browser Session Authority

`flocci-backend` sets and clears the central auth cookies.

Current cookie names:

- `session_token`: custom email/password session
- `supabase_session`: Google OAuth access token used as umbrella session proof

These cookies should be set with a shared domain in production, typically:

- `COOKIE_DOMAIN=.flocci.in`

That allows sibling apps like `notes.flocci.in`, `calendar.flocci.in`, or other future apps to reuse the same umbrella session.

### 2. User Identity Authority

The backend returns a normalized user identity that downstream services can consume.

Expected identity shape from `GET /api/auth/session`:

```json
{
  "message": "Session valid",
  "provider": "custom_session",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "full_name": "User Name",
    "role": "user"
  }
}
```

For Google OAuth fallback, the same endpoint can return:

```json
{
  "message": "Session valid",
  "provider": "supabase_oauth",
  "user": {
    "id": "supabase-user-id",
    "email": "user@example.com",
    "full_name": "User Name",
    "role": "user",
    "avatar_url": "https://..."
  }
}
```

### 3. Trusted Session Introspection

Trusted internal services such as `flocci-work-apps-srv` can validate central sessions without depending on browser cookie forwarding semantics alone.

Current trusted pattern:

- send `Authorization: Bearer <umbrella-session-token>`
- send `X-Flocci-Service-Token: <shared-secret>`
- call `GET /api/auth/session`

The service token protects the introspection route from being used as a public token validator.

## Current Endpoints Relevant To Work Apps

### `POST /api/login`

Creates a custom session and sets `session_token` cookie.

### `POST /api/auth/google`

Starts Google OAuth flow.

### `GET /api/auth/callback`

Completes OAuth flow and sets `supabase_session` cookie.

### `GET /api/auth/session`

Validates the current umbrella session.

Resolution order:

1. Validate `session_token` against the custom `sessions` table.
2. If not matched, validate the token as a Supabase user token for Google OAuth sessions.

This endpoint supports two usage modes:

- browser mode: read cookie directly
- trusted service mode: read bearer token when `X-Flocci-Service-Token` matches

### `DELETE /api/auth/session`

Revokes the custom session if present and clears central cookies.
This is the endpoint that dependent products should call to perform umbrella logout.

## Required Environment Variables

### Existing core auth vars

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `COOKIE_DOMAIN`
- `FRONTEND_URL`

### Required for Work Apps integration

- `WORK_APPS_SERVICE_TOKEN`

`WORK_APPS_SERVICE_TOKEN` must match `UMBRELLA_SERVICE_TOKEN` in `flocci-work-apps-srv`.

## Security Model

### Session Types

Two central session types currently exist:

1. custom email/password session stored in `sessions`
2. Supabase OAuth session represented by `supabase_session`

### Why The Service Token Exists

A raw umbrella session token must not become a generally introspectable credential.
Without the service token, any caller holding the token could query identity metadata server-side.

The shared service token narrows that capability to trusted Flocci backends only.

### Cookie Domain Guidance

For flagship multi-app rollout, all umbrella auth cookies must use the same parent domain.

Recommended production setting:

```env
COOKIE_DOMAIN=.flocci.in
```

Without this, sibling apps on different subdomains will not see the central cookie, and silent SSO bootstrap will fail.

### Transport Requirements

Production requirements:

- HTTPS only
- `secure: true` cookies in production
- `httpOnly: true` for umbrella session cookies
- restricted CORS allowlist
- do not expose `WORK_APPS_SERVICE_TOKEN` to browser code

## Sequence Flows

### A. First Login From Central Auth

```text
Browser -> flocci-backend: POST /api/login or Google OAuth
flocci-backend -> Browser: Set umbrella cookie
Browser -> Work App UI: open Notes/Calendar/Library/Projects/Infinity
Work App UI -> flocci-work-apps-srv: POST /auth/umbrella/bootstrap (with credentials)
flocci-work-apps-srv -> flocci-backend: GET /api/auth/session + X-Flocci-Service-Token
flocci-backend -> flocci-work-apps-srv: normalized user identity
flocci-work-apps-srv -> its DBs: upsert user/org/membership if needed
flocci-work-apps-srv -> Work App UI: local accessToken + refreshToken + org
```

### B. Subsequent Visits To Any Work App

```text
Browser already has umbrella cookie
UI loads
UI -> flocci-work-apps-srv: POST /auth/umbrella/bootstrap
flocci-work-apps-srv -> flocci-backend: validate umbrella session
flocci-work-apps-srv -> UI: product-local tokens
UI proceeds without re-registration or re-login
```

### C. Global Logout

```text
UI -> flocci-work-apps-srv: POST /auth/umbrella/logout
flocci-work-apps-srv -> flocci-backend: DELETE /api/auth/session + service token
flocci-backend -> browser response path: clear umbrella cookies
UI clears local product tokens
Future bootstrap attempts return 401 until user logs in again
```

## Rollout Guidance For Other Applications

If another product wants to depend directly on `flocci-backend`, it should implement:

1. browser login entry points pointing at `flocci-backend`
2. cookie-based session reuse with `credentials: 'include'`
3. a silent bootstrap endpoint in its own backend, if it needs product-local tokens
4. global logout by calling `DELETE /api/auth/session` either directly or through a trusted product backend

If another product does not need product-local tenancy or JWT minting, it may consume `flocci-backend` directly and skip a bridge backend entirely.

## Recommended Future Enhancements

1. Replace static shared service token with signed service JWT or mTLS for stronger internal trust.
2. Add audit logging for session introspection and logout propagation.
3. Add rate limiting specific to session introspection endpoints.
4. Add a dedicated machine-oriented introspection response schema version.
5. Add central forgot-password and password reset APIs for the custom email/password store if Work Apps will fully delegate recovery there.

## Operational Checklist

Before enabling a new dependent application:

1. Set `COOKIE_DOMAIN` correctly.
2. Confirm central login sets either `session_token` or `supabase_session`.
3. Provision `WORK_APPS_SERVICE_TOKEN` or equivalent shared token.
4. Verify `GET /api/auth/session` works in browser mode and trusted service mode.
5. Verify `DELETE /api/auth/session` clears umbrella cookies.
6. Verify dependent app can bootstrap silently after central login.
