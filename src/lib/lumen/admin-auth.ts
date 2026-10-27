import { create } from "zustand";

export interface AdminDetails {
  id: string;
  name: string;
  email: string;
  role: "super_admin";
  status: "active";
  created_at: string;
}

const base = (import.meta.env["VITE_API_BASE_URL"] ?? "http://127.0.0.1:8001").replace(/\/$/, "");
let authorization = "";

export function getAdminAuthorization() {
  if (!authorization) throw new Error("Sign in again to manage users.");
  return authorization;
}

// Development UI state only. Refreshing the page clears the administrator.
export const useAdminAuth = create<{
  admin: AdminDetails | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}>()((set) => ({
  admin: null,
  signIn: async (email, password) => {
    authorization = "";
    set({ admin: null });
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    if (response.status === 401) throw new Error("Invalid email or password.");
    if (response.status === 503) throw new Error("Development administrator login is disabled.");
    if (!response.ok) throw new Error("Unable to sign in. Check the backend and try again.");
    const data = await response.json();
    
    // Create admin object from response
    const admin: AdminDetails = {
      id: "admin_dev",
      name: "Development Admin",
      email: data.email,
      role: "super_admin",
      status: "active",
      created_at: new Date().toISOString()
    };
    
    const bytes = new TextEncoder().encode(`${email.trim().toLowerCase()}:${password}`);
    authorization = `Basic ${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))}`;
    set({ admin });
  },
  signOut: () => {
    authorization = "";
    set({ admin: null });
  },
}));
