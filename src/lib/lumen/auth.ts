import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ROLE_USERS, ROLES, type Grant, type Role } from "./data";
import { grantStatus } from "./store";
import { ROLE_NAV } from "./access";

export type LoginMethod = "Google Workspace" | "Email login link";
export interface DemoIdentity {
  name: string;
  email: string;
  role: Role;
}
export interface DemoSession extends DemoIdentity {
  method: LoginMethod;
  verifiedAt: string;
}

/** Demonstration of an M1 response; replace with a server-verified identity integration. */
export function validateDemoIdentity(
  email: string,
  method: LoginMethod,
  grants: Grant[],
  now = new Date(),
): { identity: DemoIdentity; modules: number } | { error: string } {
  const normalized = email.trim().toLowerCase();
  const role = ROLES.find((r) => ROLE_USERS[r].email.toLowerCase() === normalized);
  if (!role)
    return {
      error: "This account is not in the demo M1 directory. Choose one of the demo accounts below.",
    };
  if (method === "Google Workspace" && role === "External Reviewer")
    return { error: "External reviewers must use an email login link." };
  if (
    role === "External Reviewer" &&
    !grants.some(
      (g) =>
        g.email.toLowerCase() === normalized &&
        g.docIds.length > 0 &&
        grantStatus(g, now) === "Active",
    )
  )
    return {
      error:
        "This reviewer has no active document access grant. Ask an administrator to review access.",
    };
  return { identity: { ...ROLE_USERS[role], role }, modules: ROLE_NAV[role].length };
}

export const useDemoAuth = create<{
  session: DemoSession | null;
  signIn: (identity: DemoIdentity, method: LoginMethod) => void;
  signOut: () => void;
}>()(
  persist(
    (set) => ({
      session: null,
      signIn: (identity, method) =>
        set({ session: { ...identity, method, verifiedAt: new Date().toISOString() } }),
      signOut: () => set({ session: null }),
    }),
    {
      name: "gaxis-lumen-demo-session",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
    },
  ),
);
