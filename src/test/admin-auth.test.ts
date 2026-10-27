import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminAuthorization, useAdminAuth } from "@/lib/lumen/admin-auth";

const admin = {
  id: "admin_001",
  name: "Administrator",
  email: "admin@example.com",
  role: "super_admin",
  status: "active",
  created_at: "2026-10-20T00:00:00Z",
};
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  useAdminAuth.getState().signOut();
});
afterEach(() => vi.unstubAllGlobals());

describe("Simple administrator password check", () => {
  it("sends JSON without cookies or custom headers and keeps only public details", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => admin });
    await useAdminAuth.getState().signIn(" ADMIN@example.com ", "test-only-value");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/v1/auth/login"), {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "test-only-value" }),
    });
    expect(useAdminAuth.getState().admin).toEqual(expect.objectContaining({
      email: admin.email,
      role: "super_admin",
      status: "active",
    }));
    expect(JSON.stringify(useAdminAuth.getState().admin)).not.toContain("test-only-value");
    expect(getAdminAuthorization()).toBe(`Basic ${btoa("admin@example.com:test-only-value")}`);
  });
  it("rejects invalid credentials", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    await expect(useAdminAuth.getState().signIn("admin@example.com", "incorrect")).rejects.toThrow(
      "Invalid email or password",
    );
    expect(useAdminAuth.getState().admin).toBeNull();
  });
  it("signs out locally without any API request", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => admin });
    await useAdminAuth.getState().signIn("admin@example.com", "test-only-value");
    fetchMock.mockClear();
    useAdminAuth.getState().signOut();
    expect(useAdminAuth.getState().admin).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(() => getAdminAuthorization()).toThrow("Sign in again");
  });
});
