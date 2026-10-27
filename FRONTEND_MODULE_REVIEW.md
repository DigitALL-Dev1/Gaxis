# Frontend module review

The current release retains modules backed by the integrated authentication and management APIs.

| Retained module | Purpose |
| --- | --- |
| Dashboard | Permission-based shortcuts, API summaries and recently published documents |
| Document Library | Permitted approved documents and details |
| Prepare Document / My Prepared Documents | File uploads, metadata, revisions and preparation history |
| Release Queue | Review, approval, return for correction and review history |
| Access Grants | Requests, assigned approvers, decisions, renewal and revocation |
| User Management | Users and database role/reader-class assignments |
| Roles Management | Role definitions and permissions |
| Reader Classes Management | Reader eligibility rules |
| Document Families | Owners, releasers and grant approvers |
| My Profile | Actual authenticated user details |

| Removed module or control | Reason |
| --- | --- |
| My Reading | Sample acknowledgement workflow without its API integration |
| Media Library | Sample media records and playback workflow |
| Team Progress | Sample employee progress records |
| Audit Logs | Browser-generated sample audit activity |
| Notifications / Reset demo data | Operated on seeded browser data |

The removed screens are absent from navigation, permission mappings and generated routes. Their demo store, sample identities and seeded records have also been deleted. Backend APIs and audit recording remain available for future integrations. Dashboard failures are displayed per API, without sample-data fallbacks.
