import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminAuthorization, useAdminAuth } from "@/lib/lumen/admin-auth";
import {
  createUser,
  getUser,
  loadUserManagement,
  updateUser,
  updateUserRoles,
  updateUserReaderClass,
  updateUserStatus,
} from "@/lib/lumen/users-api";

const fetchMock = vi.fn();
const admin = {
  id: "admin_001",
  name: "Admin",
  email: "admin@example.com",
  role: "super_admin",
  status: "active",
};
const newUser = {
  full_name: "John Smith",
  email: "john@example.com",
  role_ids: ["role-id"],
  reader_class_id: "class-id",
  status: "active" as const,
};

beforeEach(async () => {
  useAdminAuth.getState().signOut();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => admin });
  await useAdminAuth.getState().signIn("admin@example.com", "test-only-value");
  fetchMock.mockReset();
});
afterEach(() => {
  useAdminAuth.getState().signOut();
  vi.unstubAllGlobals();
});

describe("User management API integration", () => {
  it("loads users, roles, and classes using per-request admin credentials", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    expect(await loadUserManagement()).toEqual({ users: [], roles: [], readerClasses: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(url).toMatch(/\/api\/v1\/(lumen\/users|roles|lumen\/reader-classes)$/);
      expect(options.credentials).toBe("omit");
      expect(options.headers.Authorization).toBe(getAdminAuthorization());
    }
  });
  it("posts selected reference IDs without client-supplied creator metadata", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ _id: "new-id", ...newUser, created_by: "admin_001" }),
    });
    const saved = await createUser(newUser);
    expect(saved._id).toBe("new-id");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/lumen/users"),
      expect.objectContaining({ method: "POST", body: JSON.stringify(newUser) }),
    );
  });
  it("surfaces duplicate-email validation to the form", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ detail: "This email or GAXIS user ID already exists" }),
    });
    await expect(createUser(newUser)).rejects.toThrow("already exists");
  });
  it("clears admin credentials if the backend rejects them", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    await expect(createUser(newUser)).rejects.toThrow("Sign in again");
    expect(useAdminAuth.getState().admin).toBeNull();
    expect(() => getAdminAuthorization()).toThrow();
  });
  it("calls the user detail, edit, role, reader class and status APIs", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ _id: "user-id" }) });
    await getUser("user-id");
    await updateUser("user-id", { full_name: "Updated name", role_ids: ["role-id"] });
    await updateUserRoles("user-id", ["role-id"]);
    await updateUserReaderClass("user-id", "class-id");
    await updateUserStatus("user-id", "INACTIVE");
    expect(
      fetchMock.mock.calls.map(([url, options]) => [url.split("/api/v1")[1], options.method]),
    ).toEqual([
      ["/lumen/users/user-id", "GET"],
      ["/lumen/users/user-id", "PATCH"],
      ["/lumen/users/user-id/roles", "PATCH"],
      ["/lumen/users/user-id/reader-class", "PATCH"],
      ["/lumen/users/user-id/status", "PATCH"],
    ]);
    expect(JSON.parse(fetchMock.mock.calls[4]![1].body)).toEqual({ status: "INACTIVE" });
  });
});
