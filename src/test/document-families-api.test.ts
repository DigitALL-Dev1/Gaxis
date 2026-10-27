import { apiBase } from "@/lib/lumen/api-base";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminAuthorization, useAdminAuth } from "@/lib/lumen/admin-auth";
import {
  createDocumentFamily,
  getDocumentFamily,
  loadDocumentFamilies,
  loadActiveDocumentFamilies,
  updateDocumentFamily,
  updateFamilyOwner,
  updateFamilyReleasers,
  updateFamilyStatus,
} from "@/lib/lumen/document-families-api";

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

describe("Document families API", () => {
  it("uses authenticated backend routes, including the singular owner route", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ _id: "id" }) });
    await loadDocumentFamilies();
    await createDocumentFamily({
      family_code: "HR",
      family_name: "HR & Induction",
      owner_user_id: "sarah",
      releaser_user_ids: ["michael", "nida"],
    });
    await getDocumentFamily("family/id");
    await updateDocumentFamily("id", { family_name: "HR" });
    await updateFamilyOwner("id", { owner_user_id: null });
    await updateFamilyReleasers("id", { releaser_user_ids: ["michael", "nida"] });
    await updateFamilyStatus("id", { is_active: false });
    expect(
      fetchMock.mock.calls.map(([url, options]) => [url.split("/api/v1/lumen")[1], options.method]),
    ).toEqual([
      ["/document-families", "GET"],
      ["/document-families", "POST"],
      ["/document-families/family%2Fid", "GET"],
      ["/document-families/id", "PATCH"],
      ["/document-families/id/owner", "PATCH"],
      ["/document-families/id/releasers", "PATCH"],
      ["/document-families/id/status", "PATCH"],
    ]);
    for (const [, options] of fetchMock.mock.calls)
      expect(options.headers.Authorization).toBe(getAdminAuthorization());
    expect(JSON.parse(fetchMock.mock.calls[4]![1].body)).toEqual({ owner_user_id: null });
    expect(JSON.parse(fetchMock.mock.calls[5]![1].body)).toEqual({
      releaser_user_ids: ["michael", "nida"],
    });
  });

  it("loads only active preparation choices without admin credentials", async () => {
    useAdminAuth.getState().signOut();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        { _id: "active", is_active: true },
        { _id: "inactive", is_active: false },
      ],
    });
    expect(await loadActiveDocumentFamilies()).toEqual([{ _id: "active", is_active: true }]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${apiBase()}/api/v1/lumen/document-families?active_only=true`,
      { credentials: "omit", cache: "no-store" },
    );
  });

  it("surfaces backend validation messages and expires rejected admin sessions", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail: [{ msg: "Invalid releaser" }] }),
    });
    await expect(updateFamilyReleasers("id", { releaser_user_ids: ["wrong"] })).rejects.toThrow(
      "Invalid releaser",
    );
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(loadDocumentFamilies()).rejects.toThrow("Sign in again");
    expect(useAdminAuth.getState().admin).toBeNull();
  });
});
