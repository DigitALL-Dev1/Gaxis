import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  ROLE_USERS,
  ROLES,
  FAMILIES,
  READER_CLASSES,
  SEED_ASSIGNMENTS,
  SEED_AUDIT,
  SEED_DOCS,
  SEED_GRANTS,
  type Assignment,
  type AuditEvent,
  type Doc,
  type Grant,
  type Role,
} from "./data";

interface State {
  directory: Record<string, { name: string; detail: string }[]>;
  addDirectoryEntry: (section: string, entry: { name: string; detail: string }) => void;
  role: Role;
  docs: Doc[];
  assignments: Assignment[];
  grants: Grant[];
  audit: AuditEvent[];
  mediaProgress: Record<string, { watched: number; acknowledged: boolean }>;
  setRole: (r: Role) => void;
  log: (action: string, doc: string, version: string, status?: "Success" | "Denied") => void;
  prepare: (doc: Omit<Doc, "id" | "status" | "preparedBy" | "submittedDate">) => Doc;
  release: (id: string) => { ok: boolean; error?: string };
  returnDoc: (id: string, note: string) => { ok: boolean; error?: string };
  setProgress: (docId: string, p: number) => void;
  acknowledge: (docId: string) => void;
  addGrant: (g: Omit<Grant, "id" | "revoked">) => void;
  revokeGrant: (id: string) => void;
  setMedia: (id: string, watched: number, acknowledged?: boolean) => void;
  reset: () => void;
}

const seed = () => ({
  directory: {
    Users: ROLES.map((r) => ({ name: ROLE_USERS[r].name, detail: ROLE_USERS[r].email })),
    Roles: ROLES.map((r) => ({ name: r, detail: "Simulated frontend role" })),
    "Reader Classes": READER_CLASSES.map((r) => ({ name: r, detail: "Document audience group" })),
    "Document Families": FAMILIES.map((r) => ({ name: r, detail: "Controlled document family" })),
    "Classification Settings": [
      { name: "D2", detail: "Internal controlled documents" },
      { name: "D3", detail: "Restricted controlled documents" },
      { name: "D4", detail: "Excluded from Release 1" },
    ],
  },
  docs: SEED_DOCS,
  assignments: SEED_ASSIGNMENTS,
  grants: SEED_GRANTS,
  audit: SEED_AUDIT,
  mediaProgress: {},
});
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

export const useLumen = create<State>()(
  persist(
    (set, get) => ({
      role: "Administrator",
      ...seed(),
      addDirectoryEntry: (section, entry) => {
        set((s) => ({
          directory: { ...s.directory, [section]: [...(s.directory[section] ?? []), entry] },
        }));
        get().log("Configuration Added", `${section}: ${entry.name}`, "—");
      },
      setRole: (role) => set({ role }),
      // Append-only: events are only ever prepended, never edited or removed.
      log: (action, doc, version, status = "Success") =>
        set((s) => ({
          audit: [
            {
              id: uid(),
              user: ROLE_USERS[s.role].name,
              action,
              doc,
              version,
              ts: new Date().toISOString(),
              status,
            },
            ...s.audit,
          ],
        })),
      prepare: (input) => {
        const doc: Doc = {
          ...input,
          id: "doc-" + uid(),
          status: "Under Review",
          preparedBy: ROLE_USERS[get().role].name,
          submittedDate: today(),
        };
        set((s) => ({ docs: [doc, ...s.docs] }));
        get().log("Submitted for Release", doc.title, doc.version);
        return doc;
      },
      release: (id) => {
        const s = get();
        const doc = s.docs.find((x) => x.id === id);
        if (!doc) return { ok: false, error: "Document not found" };
        if (!["Administrator", "Releaser"].includes(s.role) || doc.status !== "Under Review")
          return { ok: false, error: "Only a releaser can approve a pending submission." };
        const me = ROLE_USERS[s.role].name;
        if (doc.preparedBy === me) {
          s.log("Release Blocked (two-person rule)", doc.title, doc.version, "Denied");
          return {
            ok: false,
            error:
              "Two-person rule: you prepared this document, so another releaser must approve it.",
          };
        }
        const superseded = s.docs.filter(
          (x) => x.ref === doc.ref && x.id !== id && x.status === "Approved & Current",
        );
        set({
          docs: s.docs.map((x) =>
            x.id === id
              ? { ...x, status: "Approved & Current", publishedDate: today() }
              : superseded.some((p) => p.id === x.id)
                ? { ...x, status: "Superseded" }
                : x,
          ),
        });
        get().log("Document Published", doc.title, doc.version);
        superseded.forEach((p) => get().log("Document Superseded", p.title, p.version));
        return { ok: true };
      },
      returnDoc: (id, note) => {
        const s = get();
        const doc = s.docs.find((x) => x.id === id);
        if (!doc) return { ok: false, error: "Document not found" };
        if (
          !["Administrator", "Releaser"].includes(s.role) ||
          doc.status !== "Under Review" ||
          !note.trim()
        )
          return { ok: false, error: "A pending submission and correction note are required." };
        if (doc.preparedBy === ROLE_USERS[s.role].name)
          return { ok: false, error: "Two-person rule: you cannot review your own submission." };
        set({
          docs: s.docs.map((x) =>
            x.id === id ? { ...x, status: "Returned for Correction", returnNote: note } : x,
          ),
        });
        get().log("Returned for Correction", doc.title, doc.version);
        return { ok: true };
      },
      setProgress: (docId, p) =>
        set((s) => {
          const exists = s.assignments.some((a) => a.docId === docId);
          if (!exists) return {};
          return {
            assignments: s.assignments.map((a) =>
              a.docId === docId ? { ...a, progress: Math.max(a.progress, p) } : a,
            ),
          };
        }),
      acknowledge: (docId) => {
        const s = get();
        const doc = s.docs.find((x) => x.id === docId);
        if (
          !doc ||
          doc.status !== "Approved & Current" ||
          s.assignments.find((a) => a.docId === docId)?.acknowledged
        )
          return;
        const exists = s.assignments.some((a) => a.docId === docId);
        const ackAt = new Date().toISOString();
        set({
          assignments: exists
            ? s.assignments.map((a) =>
                a.docId === docId ? { ...a, progress: 100, acknowledged: true, ackAt } : a,
              )
            : [
                ...s.assignments,
                { docId, assignedDate: today(), progress: 100, acknowledged: true, ackAt },
              ],
        });
        if (doc) get().log("Document Acknowledged", doc.title, doc.version);
      },
      addGrant: (g) => {
        const days = daysBetween(g.start, g.expiry);
        if (!Number.isFinite(days) || days < 0 || days > MAX_GRANT_DAYS || !g.docIds.length) return;
        set((s) => ({ grants: [{ ...g, id: uid(), revoked: false }, ...s.grants] }));
        const docs = get().docs;
        g.docIds.forEach((id) => {
          const d = docs.find((x) => x.id === id);
          if (d) get().log(`Access Granted (${g.name})`, d.title, d.version);
        });
      },
      revokeGrant: (id) => {
        const g = get().grants.find((x) => x.id === id);
        set((s) => ({ grants: s.grants.map((x) => (x.id === id ? { ...x, revoked: true } : x)) }));
        if (g) get().log(`Access Revoked (${g.name})`, `${g.docIds.length} document(s)`, "—");
      },
      setMedia: (id, watched, acknowledged) =>
        set((s) => {
          const cur = s.mediaProgress[id] ?? { watched: 0, acknowledged: false };
          return {
            mediaProgress: {
              ...s.mediaProgress,
              [id]: {
                watched: Math.max(cur.watched, watched),
                acknowledged: acknowledged ?? cur.acknowledged,
              },
            },
          };
        }),
      reset: () => set({ ...seed() }),
    }),
    {
      name: "gaxis-lumen-demo",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

export const MAX_GRANT_DAYS = 90;
export function grantStatus(
  g: Grant,
  now = new Date(),
): "Active" | "Expired" | "Revoked" | "Scheduled" {
  if (g.revoked) return "Revoked";
  if (new Date(g.start + "T00:00:00") > now) return "Scheduled";
  return new Date(g.expiry + "T23:59:59") < now ? "Expired" : "Active";
}
export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
