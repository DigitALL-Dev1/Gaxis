# User Management Integration

Admin login -> User Management (`/admin/system`) -> GET users -> users table -> View / Edit / Activate / Deactivate.

The table displays Name, Email, Roles, Reader Class, Status and Actions. Role and reader class names come from database records loaded through their APIs. New and changed assignments use their database IDs; only active options are available for assignment. Existing inactive assignments remain visible when editing.

## API contracts

| Action | Method | Endpoint |
| --- | --- | --- |
| Admin login | POST | `/api/v1/auth/login` |
| List users | GET | `/api/v1/lumen/users` |
| Create user | POST | `/api/v1/lumen/users` |
| View user | GET | `/api/v1/lumen/users/{id}` |
| Edit user and assignments | PATCH | `/api/v1/lumen/users/{id}` |
| Assign roles | PATCH | `/api/v1/lumen/users/{id}/roles` |
| Assign reader class | PATCH | `/api/v1/lumen/users/{id}/reader-class` |
| Activate/deactivate | PATCH | `/api/v1/lumen/users/{id}/status` |
| Load role options | GET | `/api/v1/roles` |
| Load reader class options | GET | `/api/v1/lumen/reader-classes` |

User, role and reader class management endpoints accept the development administrator's in-memory Basic credentials, or a registered user's HttpOnly cookie with the required permissions. User Management uses `users.create`, `users.read`, `users.update` and the existing `users.manage` permission. Roles and Reader Classes require their separate manage permissions. A 401 clears local identity and returns to Login. Registered user reloads refresh their profile through `/auth/me`; the development Basic login still requires signing in again after reload.

The backend checks `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD`. Missing configuration returns 503. Configure these in the backend environment; credentials do not belong in this guide.

## Run locally

1. Configure MongoDB and admin credentials in the backend environment, plus `FRONTEND_ORIGINS` for the actual frontend origin.
2. From `backend`, run `python main.py` (port 8001).
3. Set frontend `VITE_API_BASE_URL` to the backend origin if needed; its default is `http://127.0.0.1:8001`.
4. From `frontend`, run `npm.cmd run dev` and open the URL printed by Vite.
5. Choose Administrator sign in, then open User Management.

Users are created with ACTIVE status. Updates replace the displayed record only after the backend succeeds. Failed requests show an error and retain existing values. Refresh retries list loading. Creating users requires at least one active role and reader class.

The Roles and Reader Classes tabs display reference records. Open Roles Management (`/admin/roles`) in the sidebar to create, view, edit, activate or deactivate roles. The user form loads role options from the same API; active roles are available for assignment.

## Roles Management

The roles screen displays Role Name, Role Code, Description, Permissions, Status and Actions. Create and Edit open a form; View fetches the latest role details. Enter permission codes on separate lines or separated by commas. Duplicate entries are removed. Blank permissions save an empty array.

| Action | Method | Endpoint |
| --- | --- | --- |
| List roles | GET | `/api/v1/roles` |
| Create role | POST | `/api/v1/roles` |
| View role | GET | `/api/v1/roles/{id}` |
| Edit role | PUT | `/api/v1/roles/{id}` |
| Activate/deactivate | PATCH | `/api/v1/roles/{id}/status` |

Status updates send `{"is_active": true}` or `{"is_active": false}`. Successful saves and status changes refresh the list. Failed saves retain the form values and show the backend error. These paths and methods match the backend router in `backend/api/roles.py`, mounted at `/api/v1` in `backend/main.py`.

To verify the assignment flow, create an active role, navigate to User Management, and open Create User. The role should appear in the Roles dropdown with its database ID used on save. Deactivate the role, return to User Management, and confirm it cannot be newly assigned.

## Reader Classes Management

Open Reader Classes Management (`/admin/reader-classes`) in the sidebar. The table displays Class Name, Class Code, Access Basis, Document Allowlist Required, Expiry Required, Maximum Grant Days, Status and Actions. View fetches full details, including allowed classifications and excluded families.

| Action | Method | Endpoint |
| --- | --- | --- |
| List reader classes | GET | `/api/v1/lumen/reader-classes` |
| Create reader class | POST | `/api/v1/lumen/reader-classes` |
| View reader class | GET | `/api/v1/lumen/reader-classes/{id}` |
| Edit reader class | PATCH | `/api/v1/lumen/reader-classes/{id}` |
| Activate/deactivate | PATCH | `/api/v1/lumen/reader-classes/{id}/status` |

The API origin is `http://127.0.0.1:8001` by default. All requests use the shared administrator authorization and error handling. Saves and status changes refresh the list; failures preserve existing values and show an error.

Class codes are set on creation and read-only when editing, matching the backend update model. Access basis choices are Role Default, Named Allowlist and Admin Appointment. When expiry is required, maximum grant days must be an integer from 1 to 90. Turning expiry off sends `requires_expiry: false` and `max_grant_days: null`. The backend preserves that explicit null when applying updates. Editing leaves allowed classifications and excluded families unchanged.

The current database already contains Employee, Contractor and Consultant, Subcontractor, External Reviewer and System Administrator. These records are loaded from the API; the frontend does not create or seed them. User Management loads reader classes from the same endpoint, offers only active records for new assignment, and submits their MongoDB IDs. Existing inactive assignments remain visible when editing users.

To check assignment behavior, create an active reader class, return to User Management, and open Create User. Confirm it appears in the Reader class dropdown. Deactivate it, return to User Management, and confirm it is unavailable for new assignment.

## Verification

- Frontend: `npm.cmd test -- src/test/users-api.test.ts src/test/user-management.test.tsx src/test/admin-auth.test.ts src/test/auth-boundary.test.tsx`
- Frontend production build: `npm.cmd run build`
- Roles frontend tests: `npm.cmd test -- src/test/roles-api.test.ts src/test/roles-management.test.tsx`
- Reader classes frontend tests: `npm.cmd test -- src/test/reader-classes-api.test.ts src/test/reader-classes-management.test.tsx src/test/user-management.test.tsx`
- Backend: `python -m unittest discover -s tests -v`

Tests mock network/database operations; they do not modify live users. For a live check, sign in against the configured backend, view an existing user, edit an approved test account, then deactivate and reactivate it. Confirm that names and assignments persist after Refresh.
