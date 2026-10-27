import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  approveAccessGrant,
  createAccessGrant,
  getAccessGrant,
  getEligibleGrantDocuments,
  getExpiringGrants,
  listAccessGrants,
  rejectAccessGrant,
  renewAccessGrant,
  revokeAccessGrant,
} from "@/lib/lumen/access-grants-api";
import { useAdminAuth } from "@/lib/lumen/admin-auth";
import { useUserAuth } from "@/lib/lumen/user-auth";
const fetchMock = vi.fn();
beforeEach(() => {
  useAdminAuth.getState().signOut();
  useUserAuth.getState().clearLocalSession();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

it("matches the real grant routes, date fields and session-bound actor contract", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  const body = {
    user_id: "david",
    document_ids: ["safety"],
    reason: "Induction",
    start_date: "2026-10-25T00:00:00Z",
    expiry_date: "2026-11-24T00:00:00Z",
  };
  await createAccessGrant(body);
  await listAccessGrants();
  await getAccessGrant("grant/id");
  await listAccessGrants("user/id");
  await getEligibleGrantDocuments("user/id");
  await approveAccessGrant("grant");
  await rejectAccessGrant("grant", "Declined");
  await revokeAccessGrant("grant", "Contract ended");
  await renewAccessGrant("grant", body.expiry_date, "Project extended");
  await getExpiringGrants(7);
  expect(
    fetchMock.mock.calls.map(([url, options]) => [url.split("/api/v1/lumen")[1], options.method]),
  ).toEqual([
    ["/access-grants", "POST"],
    ["/access-grants", "GET"],
    ["/access-grants/grant%2Fid", "GET"],
    ["/users/user%2Fid/access-grants", "GET"],
    ["/access-grants/eligible-documents?user_id=user%2Fid", "GET"],
    ["/access-grants/grant/approve", "POST"],
    ["/access-grants/grant/reject", "POST"],
    ["/access-grants/grant/revoke", "POST"],
    ["/access-grants/grant/renew", "POST"],
    ["/access-grants/expiring?days=7", "GET"],
  ]);
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual(body);
  expect(fetchMock.mock.calls[5]![1].body).toBeUndefined();
  expect(JSON.parse(fetchMock.mock.calls[6]![1].body)).toEqual({ rejection_reason: "Declined" });
  expect(JSON.parse(fetchMock.mock.calls[7]![1].body)).toEqual({
    revocation_reason: "Contract ended",
  });
  expect(JSON.parse(fetchMock.mock.calls[8]![1].body)).toEqual({
    new_expiry_date: body.expiry_date,
    reason: "Project extended",
  });
  for (const [, options] of fetchMock.mock.calls) expect(options.credentials).toBe("include");
});

it("displays disclosure authority and validation failures returned by the backend", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ detail: "CEO approval is required" }),
  });
  await expect(approveAccessGrant("grant")).rejects.toThrow("CEO approval is required");
});
