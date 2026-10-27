import { create } from "zustand";
import { apiBase } from "./api-base";
import { modulesForPermissions } from "./permissions";
import { useAdminAuth } from "./admin-auth";

export interface SignedInUser {
  id: string;
  full_name: string;
  email: string;
  gaxis_user_id: string | null;
  status: "active";
  roles: { id: string; code: string; name: string }[];
  reader_class: { id: string; code: string; name: string };
  permissions: string[];
  modules: string[];
}

export function displayRole(user: SignedInUser) {
  return [user.roles.map((role) => role.name).join(", "), user.reader_class.name]
    .filter(Boolean)
    .join(" · ");
}

function removeLegacyIdentity() {
  try {
    localStorage.removeItem("lumen_user");
  } catch {
    /* Storage availability never establishes identity. */
  }
}

let verification: { token: string; promise: Promise<SignedInUser> } | null = null;
let generation = 0;
let restoring: Promise<void> | null = null;

// A callback remount must join the same request after its URL secret is removed.
export function resumeLoginVerification() {
  return verification?.promise ?? null;
}

interface ProfileResponse {
  user_id: string;
  full_name: string;
  email: string;
  gaxis_user_id?: string | null;
  status: string;
  roles: { id?: string; code: string; name: string }[];
  reader_class: { id?: string; code: string; name: string };
  permissions: string[];
}

function normalizeProfile(data: ProfileResponse): SignedInUser {
  if (data.status.toLowerCase() !== "active" || !data.user_id || !Array.isArray(data.permissions)) {
    throw new Error("An active user session is required.");
  }
  const permissions = data.permissions.filter((value) => typeof value === "string");
  return {
    id: data.user_id,
    full_name: data.full_name,
    email: data.email,
    gaxis_user_id: data.gaxis_user_id ?? null,
    status: "active",
    roles: data.roles.map((role) => ({ ...role, id: role.id ?? "" })),
    reader_class: { ...data.reader_class, id: data.reader_class.id ?? "" },
    permissions,
    modules: modulesForPermissions(permissions),
  };
}

async function authRequest(path: string, body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}/api/v1/auth${path}`, {
      ...(body !== undefined
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new Error("Cannot reach the backend. Please try again.");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      typeof error?.detail === "string"
        ? error.detail
        : "Unable to complete sign in. Please try again.",
    );
  }
  return response.json();
}

export const useUserAuth = create<{
  user: SignedInUser | null;
  requestLink: (email: string) => Promise<string>;
  verifyToken: (token: string) => Promise<SignedInUser>;
  restore: () => Promise<void>;
  clearLocalSession: () => void;
  signOut: () => Promise<void>;
}>()((set, get) => ({
  user: null,
  requestLink: async (email) =>
    (await authRequest("/request-login-link", { email: email.trim().toLowerCase() })).message,
  verifyToken: (token) => {
    if (verification?.token === token) return verification.promise;
    const current = ++generation;
    const promise = (async () => {
      const user = normalizeProfile(await authRequest("/verify-login-token", { token }));
      if (generation !== current) throw new Error("Sign-in was cancelled. Please try again.");
      useAdminAuth.getState().signOut();
      set({ user });
      removeLegacyIdentity();
      return user;
    })();
    verification = { token, promise };
    return promise;
  },
  restore: () => {
    if (restoring) return restoring;
    const current = generation;
    removeLegacyIdentity();
    restoring = (async () => {
      try {
        const user = normalizeProfile(await authRequest("/me"));
        if (current === generation) set({ user });
      } catch {
        if (current === generation) set({ user: null });
      } finally {
        restoring = null;
      }
    })();
    return restoring;
  },
  clearLocalSession: () => {
    generation++;
    verification = null;
    set({ user: null });
    removeLegacyIdentity();
  },
  signOut: async () => {
    await authRequest("/logout", {});
    get().clearLocalSession();
  },
}));
