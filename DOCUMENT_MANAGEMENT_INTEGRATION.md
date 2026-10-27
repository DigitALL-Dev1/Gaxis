# Document Management Integration

## Screens

- Prepare Document (`/admin/prepare`) uploads a new document using the current registered owner, or the assigned family owner when a development administrator submits on their behalf.
- My Prepared Documents (`/admin/prepared`) lists the current user's database submissions, showing latest submitted status separately from the current approved version. The development administrator can inspect all preparations.
- Document Library (`/library`) lists only permitted current approved versions. Search, family/classification filters, table/grid views and metadata use API records.
- Document Details (`/d/{id}`) and the preparation details modal load current metadata, approved/pending versions, history and individual version details. They never render sample text as if it were the uploaded file.
- Release Queue (`/admin/release`) now reads actual pending versions for assigned releasers. Reviewers open uploaded files, confirm approval or return versions with comments; all decisions use backend APIs. See DOCUMENT_RELEASE_INTEGRATION.md.

## API routes

| Method | Path                                    | Behavior                                |
| ------ | --------------------------------------- | --------------------------------------- |
| POST   | `/api/v1/lumen/documents/prepare`       | New document and UNDER_REVIEW version   |
| GET    | `/api/v1/lumen/documents/my-prepared`   | Current user's prepared documents       |
| GET    | `/api/v1/lumen/documents/review-queue`  | Pending versions for assigned releasers |
| GET    | `/api/v1/lumen/documents`               | Permitted approved library              |
| GET    | `/api/v1/lumen/documents/{id}`          | Authorized document metadata            |
| GET    | `/api/v1/lumen/documents/{id}/versions` | Authorized version history              |
| GET    | `/api/v1/lumen/document-versions/{id}`  | Authorized individual version metadata  |
| POST   | `/api/v1/lumen/documents/{id}/versions` | Revised file submitted as UNDER_REVIEW  |

The revision route and review-queue list were added because they were missing. Static routes precede document-ID routes, and duplicate reader metadata route registrations were removed. Document IDs are MongoDB IDs; identity comes from the cookie session, never a caller-supplied user ID.

## Multipart upload contract

A new document sends `title`, `reference`, `family_id`, `owner_user_id`, `classification`, `reader_class_ids` (comma-separated database IDs), `version_number`, `acknowledgement_required` (true/false), optional `change_summary`, and `file`.

A revision sends `owner_user_id`, `version_number`, required `change_summary`, and `file`, plus optional `title`, `classification`, `reader_class_ids` and `acknowledgement_required`. Those fields are saved as proposed version metadata and are applied only upon release. It does not change the approved metadata or `current_version_id` during review. The browser supplies the multipart boundary; the API client does not set Content-Type manually.

Both return `document_id`, `version_id`, `version_number`, `status: UNDER_REVIEW` and a message. Successful new uploads open My Prepared Documents. Revised uploads refresh the list. Errors retain entered values and the selected file.

## Permissions and validation

- `documents.prepare`: preparation form and My Prepared Documents.
- `documents.submit`: required in addition to prepare for either upload endpoint. The form remains available without it, but Submit for Approval is disabled.
- `documents.read`: approved library. Reader-class classification, audience, family exclusions and time-limited grants are independently enforced on the backend.
- `documents.review` or `documents.release`: assigned-family review queue and pending metadata. `documents.release` is required to publish. Ordinary owners/preparers cannot decide their own reviews. Administrators can explicitly override this restriction; those decisions are marked in review history. See DOCUMENT_RELEASE_INTEGRATION.md.

Families and reader classes come from their APIs. The preparation dropdown includes only active families assigned to the current owner; Basic administrators choose an assigned family and submit as that eligible registered owner. The backend rechecks active ownership and active owner permissions. Being a releaser does not confer preparation authority.

D2/D3 only, a title and normalized reference of at least five characters, at least one active reader class, a numeric dotted version (for example 1.0), and a non-empty PDF/DOC/DOCX file are required. The MIME type and extension must match. Both frontend and backend enforce 100 * 1024 * 1024 bytes (100 MB).

New references and version numbers use unique MongoDB indexes. A per-document upload reservation prevents concurrent revised uploads; one pending version per document is allowed. Revisions require a change summary and a distinct version number. While a revision is under review, the prior approved pointer remains unchanged. Ordinary readers receive only the current approved version, even when a pending revision exists, and cannot query pending version metadata directly.

Uploads are written in chunks to `UPLOAD_DIR` (default `backend/uploads` when starting there), with generated storage names and SHA-256 checksums. Empty, oversized and failed version writes clean up the file; a failed initial version also removes its newly inserted document record. Storage keys are omitted from metadata responses.

## Runtime and verification

Restart the backend on port 8001 to load these routes and checks. Keep the SMTP, frontend-origin and cookie configuration from AUTH_INTEGRATION.md. Set `UPLOAD_DIR` to the intended backend storage directory. Existing duplicate references/version numbers need resolving before the unique indexes can be created.

Frontend: `npm.cmd test -- --maxWorkers=1`, `npx.cmd tsc --noEmit`, `npm.cmd run build`.
Backend: `python -m unittest discover -s tests -v`.

Backend tests use cookie sessions, fake Mongo collections and real multipart uploads to temporary directories. They validate persisted files, ownership, submit permission, cleanup, revisions, upload conflicts, reader exclusions/grants and approved-only employee access. Frontend tests cover multipart requests, API IDs, active assigned options, field/file errors, revisions, current/pending separation, details and the independent review queue. No live documents or account records are changed by those tests.

Authenticated document files are served by the version file API. PDF files preview inline; Word files download for review. Reading evidence and acknowledgements remain separate integrations.
