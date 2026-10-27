# User Login and Permission Integration

## Login and session flow

1. POST `/api/v1/auth/request-login-link` with `{ "email": "registered@example.com" }`.
2. The backend emails a 15-minute, single-use link to the registered active user's mailbox. Responses contain a generic message, never the login token or link. Delivery failures return an error and invalidate the generated token.
3. The link opens `/verify-login#token=...`. The callback also accepts existing query-style links, removes the secret from browser history and POSTs `{ "token": "..." }` to `/api/v1/auth/verify-login-token`.
4. Verification consumes the token atomically and returns the existing `user_id`, `full_name`, `email`, `roles`, `reader_class`, `permissions` and `status` response fields. It also sets an opaque HttpOnly cookie.
5. The frontend opens `/dashboard`. React effect replay shares the verification promise, so a token is consumed once.
6. Every app reload calls GET `/api/v1/auth/me`. Current account status, active role permissions and active reader class come from MongoDB. Local storage is never trusted as authentication; the old `lumen_user` entry is removed.
7. POST `/api/v1/auth/logout` revokes the server session and expires its cookie. If the request fails, the UI retains the identity and lets the user retry.

Login tokens and session secrets are stored as SHA-256 hashes. The cookie lasts eight hours, uses HttpOnly, SameSite=Lax and `/api` scope. HTTPS requests automatically set Secure; production can explicitly require it with `SESSION_COOKIE_SECURE=true`. Cookie mutations reject untrusted browser origins.

## Permissions and modules

| Permission | Module |
| --- | --- |
| `documents.read` | Document Library |
| `team.progress.read` | Team Progress |
| `documents.prepare` | Prepare Document |
| `documents.release` | Release Queue |
| `documents.acknowledge` | My Reading / document acknowledgement |
| `users.create`, `users.read`, `users.update`, or existing `users.manage` | User Management |
| `roles.manage` | Roles Management |
| `reader_classes.manage` | Reader Classes Management |
| `document_families.manage` | Document Families |
| `access_grants.manage` or existing `grants.manage` | Access Grants Management |
| `audit.read` | Audit Logs |
| `media.read` | Media Library |

Dashboard and My Profile are available to every authenticated user. Role and reader class names are display labels; menu visibility and route access use permissions. The frontend derives module names locally from the permission array and ignores any incoming or saved module list. User Management gates Create and Edit/Status actions separately.

For the Manager example with only `documents.read` and `team.progress.read`, the workspace shows Welcome, Zain Israr; Manager · Employee; Dashboard; Document Library; My Profile; and Sign out in the account menu. Other management modules are hidden. Direct unauthorized navigation renders Access Denied. Unauthenticated private navigation redirects to Login. Login and token verification are public pages.

Backend router dependencies independently check the current cookie session and database permissions. Identity cannot be established by supplying a user ID in a query or document preparation form. Existing content eligibility and family authorization checks still apply. Bootstrap administrator Basic credentials remain a separate development login with administrative access; they stay only in memory and are not persisted.

## Configuration

- Start from `backend/.env.example` without replacing existing secrets. Configure MongoDB, SMTP, `FRONTEND_BASE_URL` and exact `FRONTEND_ORIGINS` for the frontend's actual port.
- Restart the backend on port 8001 to load `/me`, `/logout`, sessions and permission checks. Previously issued plaintext-token links must be replaced by requesting a new link.
- Frontend `VITE_API_BASE_URL` defaults to `http://127.0.0.1:8001`. During loopback development, requests use the browser's localhost/127.0.0.1 hostname consistently so SameSite cookies work. Email callbacks default to `http://127.0.0.1:8081`; configure the actual frontend URL.
- In production use HTTPS with `SESSION_COOKIE_SECURE=true` and frontend/API origins on the same site (or proxy `/api` on the frontend origin), plus the exact CORS allowlist.

The dashboard and access gates use login APIs. Document preparation, the approved library, version details and the pending review list now use backend APIs; see DOCUMENT_MANAGEMENT_INTEGRATION.md. Unintegrated team progress, reading acknowledgement, media and audit screens have been removed from routes and navigation; their permissions do not expose modules until a real integration is implemented. Independent approval, returns, authenticated previews and review history are integrated; see DOCUMENT_RELEASE_INTEGRATION.md.

## Validation

Backend tests exercise login delivery with mocked SMTP, secret hashing, single-use/expired links, cookie flags, profile refresh, inactive users/roles/classes, logout revocation, CSRF origin checks, permission denial and actor ID spoofing. Frontend tests cover the actual request methods, session refresh, forged storage, StrictMode callback replay, the Manager dashboard, separate management gates and authorization boundaries. Tests never send real email or modify live accounts.

Run `python -m unittest discover -s tests -v` from backend and `npm.cmd test -- --maxWorkers=1` from frontend. Build with `npm.cmd run build`.
