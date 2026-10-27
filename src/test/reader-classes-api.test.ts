import { apiBase } from "@/lib/lumen/api-base";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminAuth, getAdminAuthorization } from "@/lib/lumen/admin-auth";
import {
  createReaderClass,
  getReaderClass,
  listReaderClasses,
  updateReaderClass,
  updateReaderClassStatus,
} from "@/lib/lumen/reader-classes-api";

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

describe("Reader Classes API", () => {
  it("calls the authenticated backend endpoints and sends null when expiry is removed", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ _id: "class-id" }) });
    const details = {
      class_name: "Contractor",
      class_code: "CONTRACTOR",
      description: "External reader",
      access_basis: "NAMED_ALLOWLIST",
      requires_document_allowlist: true,
      requires_expiry: true,
      max_grant_days: 90,
    };
    await listReaderClasses();
    await createReaderClass(details);
    await getReaderClass("class/id");
    await updateReaderClass("class-id", { requires_expiry: false, max_grant_days: null });
    await updateReaderClassStatus("class-id", false);
    expect(
      fetchMock.mock.calls.map(([url, options]) => [url.split("/api/v1")[1], options.method]),
    ).toEqual([
      ["/lumen/reader-classes", "GET"],
      ["/lumen/reader-classes", "POST"],
      ["/lumen/reader-classes/class%2Fid", "GET"],
      ["/lumen/reader-classes/class-id", "PATCH"],
      ["/lumen/reader-classes/class-id/status", "PATCH"],
    ]);
    expect(fetchMock.mock.calls[0]![0]).toBe(`${apiBase()}/api/v1/lumen/reader-classes`);
    for (const [, options] of fetchMock.mock.calls)
      expect(options.headers.Authorization).toBe(getAdminAuthorization());
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual(details);
    expect(JSON.parse(fetchMock.mock.calls[3]![1].body)).toEqual({
      requires_expiry: false,
      max_grant_days: null,
    });
    expect(JSON.parse(fetchMock.mock.calls[4]![1].body)).toEqual({ is_active: false });
  });

  it("surfaces backend errors and clears a rejected admin session", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: "Class code already exists" }),
    });
    await expect(updateReaderClass("id", { class_name: "Employee" })).rejects.toThrow(
      "already exists",
    );
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(listReaderClasses()).rejects.toThrow("Sign in again");
    expect(useAdminAuth.getState().admin).toBeNull();
  });
});
