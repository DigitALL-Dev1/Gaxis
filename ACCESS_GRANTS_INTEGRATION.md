# Access Grants Management

Open **Access Grants** (`/admin/grants`) after signing in with `access_grants.manage` (the existing `grants.manage` alias is also supported). The screen uses FastAPI and MongoDB for listing, viewing, requesting, approving, rejecting, revoking, renewing and monitoring expiring grants. Approval status and effective access status are separate columns. User-specific filtering and an **Expiring within 7 days** view use their respective endpoints.

## Authority setup

The previous backend had no divisional manager mapping. Family management now supports **Assign Grant Approvers**, persisted as `grant_approver_user_ids`. Only callers with `document_families.manage` or the development Basic administrator can configure it. Eligible assignees are active users with an active `MANAGER` or `DIVISIONAL_MANAGER` role and grant management permission. The backend validates these conditions when saving assignments.

- Ordinary disclosures require a registered manager assigned as grant approver for **every** selected document family. Split requests across families if different managers are responsible.
- Families with codes `X1`, `COMMERCIAL`, `COSTING` or `CLIENT_DATA` require the registered `CEO` role. A request containing any such family requires CEO approval for the entire request.
- `SYSTEM_ADMIN`, family ownership, document releaser assignment and the development Basic login do not confer disclosure approval authority. Basic administrators can submit and revoke requests but cannot approve or reject them.
- All new requests start pending, including requests submitted by an authorised approver. An explicit approval records the approver and activates access when the start date arrives.

Configure ordinary families under Document Families → Assign Grant Approvers. Ensure approvers have grant management permission. Searching users and creating requests also requires a permission accepted by the Users API (`users.read`, or its existing management/create/update alternatives); approvers without user-search permission can still act on existing requests.

## API contract

All paths below are under `/api/v1/lumen` and use the shared cookie/Basic authenticated client. The backend derives action identities from the session. It rejects caller-supplied actor fields rather than trusting them.

| Method | Path                                             | Purpose                                                                              |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| POST   | `/access-grants`                                 | Create pending request                                                               |
| GET    | `/access-grants`                                 | List full records with current status and action capabilities                        |
| GET    | `/access-grants/{id}`                            | Grant details, approval evidence and renewal history                                 |
| GET    | `/users/{id}/access-grants`                      | User's grants                                                                        |
| GET    | `/access-grants/eligible-documents?user_id={id}` | Approved documents eligible for the selected user, reader class and maximum duration |
| POST   | `/access-grants/{id}/approve`                    | Approve initial request, renewal or legacy reapproval; no actor body                 |
| POST   | `/access-grants/{id}/reject`                     | `{ "rejection_reason": "..." }`                                                      |
| POST   | `/access-grants/{id}/revoke`                     | `{ "revocation_reason": "..." }`                                                     |
| POST   | `/access-grants/{id}/renew`                      | `{ "new_expiry_date": "ISO date", "reason": "..." }`                                 |
| GET    | `/access-grants/expiring?days=7`                 | Active approved grants approaching expiry                                            |

Create sends `user_id`, `document_ids`, `reason`, `start_date` and `expiry_date`. Dates use ISO UTC timestamps; the UI converts local calendar input to an explicit UTC timestamp, and responses include a UTC offset. Successful writes return the enriched grant record with `_id`, approval/access states and server-computed capabilities. Static eligible/expiring routes are registered before the ID route. The old client's `expires_at` and `/expiring-soon` fields/routes are replaced with the actual contract. There is no arbitrary grant status/date PATCH endpoint.

## Restrictions and immediate enforcement

Recipients must be active existing users with active reader classes that need document-specific grants, or be external users. Users and reader classes come from their APIs. After selecting a recipient, the backend supplies the eligible document choices. Only active, current approved D2/D3 documents in active families are eligible. The reader's classification, document audience and family exclusions apply. Contractors, consultants and subcontractors cannot receive HR-family access. D4 and pending versions are excluded.

Expiry is mandatory and strictly later than the start and current time. The exact interval, including partial days, cannot exceed 90 days or a smaller reader-class maximum. New requests accept today's calendar start date but reject dates more than one day in the past. Approval rechecks recipient/class/document eligibility and the current approver's roles and assignments.

Scheduled approved grants are stored as pending until their start, but effective access is calculated from approval, start, expiry and revocation on every request. No background status job is required. The library, version metadata, file delivery and media checks require a valid explicit grant for external users, even if a reader class is incorrectly configured for role-default access. Approval evidence is bound to the reader class and approved families; moving a document into an unapproved family or escalating it into a CEO-sensitive family does not inherit a manager's old authority.

Revocation takes effect immediately in subsequent API requests. A file already downloaded cannot be recalled. Frontend status is informational and refreshes from the backend. UI actions confirm approval/revocation, require rejection/revocation/renewal reasons, disable repeat requests while saving, retain input on failure and display backend errors.

## Renewal and legacy grants

A renewal stores a pending `renewal` proposal on the same grant. It does **not** change the currently approved validity. Its proposed expiry must extend the existing expiry and fall within the recipient's maximum duration measured from the renewal request. The appropriate current approver must explicitly approve it. Approval atomically installs the new interval; rejection retains the existing interval. Expired grants provide no access while their renewal is pending. Revocation cancels a pending renewal. Decisions and cancelled renewals remain in `renewal_history`.

Grant transitions use an atomic MongoDB revision comparison. A competing decision returns 409 and cannot overwrite another approval, rejection or revocation.

Legacy approved records from the previous permissive implementation lack the new authority evidence (`approval_policy_version`, `approval_authority`, `approved_family_ids`). They provide no access until a fresh authorised approval. The UI marks them **Fresh approval required** and exposes reapproval to the correct approver when their dates and current eligibility remain valid. Expired records can request renewal; otherwise invalid legacy requests should be revoked and replaced. This integration does not silently migrate or approve live records.

## Runtime and checks

Restart the backend on port 8001 to load the updated routes and reader checks. Keep the existing MongoDB, frontend origin and cookie configuration. No live grant, user, family or role data is written by the automated checks.

Backend: `python -W ignore::DeprecationWarning -m unittest discover -s tests -q` from `backend`.

Frontend: `npm.cmd test -- --maxWorkers=1`, `npx.cmd tsc --noEmit`, and `npm.cmd run build` from `frontend`.

Tests cover manager/CEO versus admin authority, bootstrap requests, family assignment, HR/D4/inactive exclusions, UTC and exact duration limits, pending and scheduled access, expiry, immediate revocation, fresh renewal approval, legacy reapproval, stale decisions, user/expiring routes, frontend confirmations, error retention and the actual request bodies.
