# GAXIS-Lumen — GREEN Limited

Frontend for controlled document preparation, publication and access management.

Start at `/login` to request an email sign-in link for a registered user, or use the separate development administrator login. User verification creates a revocable HttpOnly cookie session; reload calls `/api/v1/auth/me` to refresh permissions from MongoDB. Menus, dashboard modules and route gates use permission codes. Backend API dependencies enforce those permissions independently. See [authentication setup](AUTH_INTEGRATION.md) for SMTP, frontend origins, cookies and validation. Copy `.env.example` to `.env` to configure `VITE_API_BASE_URL`.

Run `npm install` followed by `npm run dev`. Use `npm run build` for a production build and `npm test` for workflow tests.

User, role, reader class, family and document management use FastAPI and MongoDB. Prepare Document sends real multipart uploads (PDF, DOC or DOCX, up to 100 MB) for assigned families. My Prepared Documents shows version history and pending status separately from the approved version. The library shows only permitted approved documents. The release queue supports authenticated file review, independent approval and returns for correction. Released revisions supersede the previous approved version. See [document integration](DOCUMENT_MANAGEMENT_INTEGRATION.md).

Access Grants Management uses database users, eligible approved documents and explicit CEO/divisional-manager disclosure approval. It supports pending requests, rejection, revocation, renewal and expiry monitoring. Configure ordinary family grant approvers in Document Families. See [access grants integration](ACCESS_GRANTS_INTEGRATION.md).

Document details display actual metadata, review history and authenticated file previews (PDF inline, Word download). The dashboard uses API summaries and approved documents. Media Library provides permission-filtered playback, playback progress, captions/transcripts and media processing review; Prepare Media uploads controlled video and audio for the existing independent release workflow. My Reading, Team Progress and Audit Logs remain unintegrated. See [media integration](MEDIA_INTEGRATION.md) and [frontend module review](FRONTEND_MODULE_REVIEW.md).

Uses React, TypeScript, Vite, Zustand, Mantine and the existing Lovable TanStack router. Production identity integration with GAXIS M1 remains separate. Restart the backend after Python changes to load the latest session, permission and upload routes.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3eacd12f-1a58-4aa5-958a-a5352308d531).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
