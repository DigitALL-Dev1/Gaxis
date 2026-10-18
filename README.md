# GAXIS-Lumen — GREEN Limited

Frontend prototype for controlled document publication, access, reading and acknowledgement.

Run `npm install` followed by `npm run dev`. Use `npm run build` for a production build and `npm test` for workflow tests.

Includes all eleven screens from the brief, 18 sample document versions, six training materials, role switching, external grants and CSV audit export. Switch demo roles from the profile menu; use **Reset demo data** to restore sample records. Prepare as Document Owner, then switch to Releaser to approve. Approving a matching reference supersedes its previous current version.

Uses React, TypeScript, Vite, Zustand, Mantine and Tabler Icons. The existing Lovable TanStack router and shared UI components are retained for project compatibility. No backend, real authentication, file processing or integrations are implemented. Files retain their name only; the reader and media player simulate content. Browser-local state persists in localStorage. Roles and grants demonstrate behavior and provide no production security.

Administration forms maintain demo reference data; they do not provision identities or alter hard-coded role permissions. Safety and induction playback requires 90% accumulated simulated playback before acknowledgement.

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
