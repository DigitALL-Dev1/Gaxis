# Document Families Management Integration

Open Document Families (`/admin/families`) in the Admin sidebar. The screen lists Family Name, Family Code, Description, Document Owner, Document Releasers, Status and Actions.

## Backend API

The default API origin is `http://127.0.0.1:8001`, configurable through frontend `VITE_API_BASE_URL`.

Restart the backend process after these Python changes so it loads the new admin checks, assignment validation and `active_only` query. A running instance serving the earlier schema will not enforce these changes until restarted.

| Action                    | Method | Path                                             |
| ------------------------- | ------ | ------------------------------------------------ |
| List families             | GET    | `/api/v1/lumen/document-families`                |
| Create family             | POST   | `/api/v1/lumen/document-families`                |
| View details              | GET    | `/api/v1/lumen/document-families/{id}`           |
| Edit name and description | PATCH  | `/api/v1/lumen/document-families/{id}`           |
| Activate/deactivate       | PATCH  | `/api/v1/lumen/document-families/{id}/status`    |
| Assign or clear owner     | PATCH  | `/api/v1/lumen/document-families/{id}/owner`     |
| Assign multiple releasers | PATCH  | `/api/v1/lumen/document-families/{id}/releasers` |

The actual backend route uses singular `/owner`. This is the route used by the frontend. Owner requests send `owner_user_id` (including null to clear); releaser requests send `releaser_user_ids` (including an empty array to clear).

## Management behavior

- View, Edit and assignment actions load the latest family details.
- Create can assign an owner and multiple releasers in the same request. Both assignments are optional and can be set later.
- Edit changes the name and description. Family codes are read-only after creation, matching the backend update model. Assignment actions update responsibilities separately.
- Saves and status changes refresh the API list. Failed requests retain current values and show backend validation messages.
- Names resolve from the Users API. Dropdown eligibility joins user `role_ids` with roles from `/api/v1/roles`, using `DOCUMENT_OWNER` or `DOCUMENT_RELEASER` codes. Both users and their matching roles must be active.
- Existing assignments remain visible even if a user becomes ineligible. Assignment forms offer only eligible users and explicitly replace the current assignment on save.
- The route uses the document families permission gate. The full list, detail and mutations require the `document_families.manage` cookie permission or development administrator Basic credentials. The API client uses the shared admin session and clears rejected sessions on 401.
- Backend validation rejects wrong-role, inactive-user and inactive-role assignments. Creation normalizes family codes before duplicate checking and records the authenticated admin as creator.

## Active families in document preparation

Prepare Document loads `/api/v1/lumen/document-families?active_only=true` and offers only active API families. This active catalog remains readable without admin credentials for preparation; the full management list requires admin access.

The upload endpoint checks the selected family and its current owner again at submission. A deactivated family is cleared and submission is blocked. Loading errors and an empty catalog disable submission and provide a Refresh families action. There is no fallback to hardcoded family options.

Document uploads and the pending review list now use backend APIs. Preparation offers active families assigned to the logged-in owner, and the upload endpoint rechecks ownership and submit permission. See DOCUMENT_MANAGEMENT_INTEGRATION.md. Independent approval, returns, authenticated previews and review history are integrated; see DOCUMENT_RELEASE_INTEGRATION.md.

## Verification

- Frontend management/API: `npm.cmd test -- src/test/document-families-api.test.ts src/test/document-families-management.test.tsx src/test/users-api.test.ts`
- Preparation: `npm.cmd test -- src/test/prepare-families.test.tsx`
- Backend: `python -m unittest discover -s tests -v`
- Production build: `npm.cmd run build`

Automated mutations use mocked databases and do not change live families. For a manual end-to-end check, create an approved test family with an active Document Owner and two Document Releasers, refresh, view the details, edit its description, and update assignments. Deactivate it and confirm it disappears from Prepare Document. Reactivate it to make it available again.

## Disclosure approvers

Assign Grant Approvers configures `grant_approver_user_ids` separately from document owners and releasers. Only active managers with grant management permission are eligible. These assignments authorise ordinary external disclosures; sensitive families still require CEO approval. See ACCESS_GRANTS_INTEGRATION.md.
