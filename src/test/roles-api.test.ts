import { apiBase } from "@/lib/lumen/api-base";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminAuth, getAdminAuthorization } from "@/lib/lumen/admin-auth";
import {
  createRole,
  getRole,
  listRoles,
  updateRole,
  updateRoleStatus,
} from "@/lib/lumen/roles-api";

const fetchMock = vi.fn();
beforeEach(async () => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock
    .mockReset()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ email: "admin@example.com" }) });
  await useAdminAuth.getState().signIn("admin@example.com", "test-password");
  fetchMock.mockReset();
});
afterEach(() => {
  useAdminAuth.getState().signOut();
  vi.unstubAllGlobals();
});

describe("Roles API", () => {
  it("uses the backend roles endpoints with PUT edits and PATCH status", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ _id: "role-id" }) });
    const role = {
      role_name: "Manager",
      role_code: "MANAGER",
      description: "Team oversight",
      permissions: ["team.read"],
    };
    await listRoles();
    await createRole(role);
    await getRole("role/id");
    await updateRole("role-id", role);
    await updateRoleStatus("role-id", false);
    expect(
      fetchMock.mock.calls.map(([url, options]) => [url.split("/api/v1")[1], options.method]),
    ).toEqual([
      ["/roles", "GET"],
      ["/roles", "POST"],
      ["/roles/role%2Fid", "GET"],
      ["/roles/role-id", "PUT"],
      ["/roles/role-id/status", "PATCH"],
    ]);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.headers.Authorization).toBe(getAdminAuthorization());
    }
    expect(fetchMock.mock.calls[0]![0]).toBe(`${apiBase()}/api/v1/roles`);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual(role);
    expect(JSON.parse(fetchMock.mock.calls[4]![1].body)).toEqual({ is_active: false });
  });

  it("surfaces duplicate role codes and expires rejected admin sessions", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: "Role code already exists" }),
    });
    await expect(updateRole("id", { role_code: "MANAGER" })).rejects.toThrow("already exists");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(listRoles()).rejects.toThrow("Sign in again");
    expect(useAdminAuth.getState().admin).toBeNull();
  });
});
