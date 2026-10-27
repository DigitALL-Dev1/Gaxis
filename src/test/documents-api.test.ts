import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminAuth } from "@/lib/lumen/admin-auth";
import { useUserAuth } from "@/lib/lumen/user-auth";
import {
  getDocument,
  getDocumentVersion,
  listDocuments,
  listDocumentVersions,
  listMyPreparedDocuments,
  listReviewQueue,
  prepareDocument,
  uploadDocumentRevision,
  validateDocumentFile,
  getReleaseQueue,
  getReviewDetails,
  releaseDocumentVersion,
  returnDocumentVersion,
  getDocumentReviews,
  getDocumentFile,
} from "@/lib/lumen/documents-api";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  useAdminAuth.getState().signOut();
  useUserAuth.getState().clearLocalSession();
});
afterEach(() => vi.unstubAllGlobals());

describe("Document API contracts", () => {
  it("uses the actual review routes, JSON comments and authenticated binary delivery", async () => {
    const file = new Blob(["%PDF-test"], { type: "application/pdf" });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}), blob: async () => file });
    await getReleaseQueue();
    await getReviewDetails("pending/id");
    await releaseDocumentVersion("pending", "Approved after review");
    await returnDocumentVersion("pending", "Please correct classification");
    await getDocumentReviews("document");
    expect(await getDocumentFile("pending")).toBe(file);
    expect(
      fetchMock.mock.calls.map(([url, options]) => [url.split("/api/v1/lumen")[1], options.method]),
    ).toEqual([
      ["/release-queue", "GET"],
      ["/release-queue/pending%2Fid", "GET"],
      ["/document-versions/pending/release", "POST"],
      ["/document-versions/pending/return", "POST"],
      ["/documents/document/reviews", "GET"],
      ["/document-versions/pending/file", "GET"],
    ]);
    expect(JSON.parse(fetchMock.mock.calls[2]![1].body)).toEqual({
      review_comments: "Approved after review",
    });
    expect(JSON.parse(fetchMock.mock.calls[3]![1].body)).toEqual({
      review_comments: "Please correct classification",
    });
    for (const [, options] of fetchMock.mock.calls) expect(options.credentials).toBe("include");
  });
  it("uses cookie-authenticated multipart uploads and all actual metadata endpoints", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const body = new FormData();
    body.append("file", new File(["%PDF-test"], "policy.pdf", { type: "application/pdf" }));
    await prepareDocument(body);
    await uploadDocumentRevision("doc/id", body);
    await listMyPreparedDocuments();
    await listDocuments();
    await getDocument("doc-id");
    await listDocumentVersions("doc-id");
    await getDocumentVersion("version-id");
    await listReviewQueue();
    expect(
      fetchMock.mock.calls.map(([url, options]) => [url.split("/api/v1/lumen")[1], options.method]),
    ).toEqual([
      ["/documents/prepare", "POST"],
      ["/documents/doc%2Fid/versions", "POST"],
      ["/documents/my-prepared", "GET"],
      ["/documents", "GET"],
      ["/documents/doc-id", "GET"],
      ["/documents/doc-id/versions", "GET"],
      ["/document-versions/version-id", "GET"],
      ["/documents/review-queue", "GET"],
    ]);
    expect(fetchMock.mock.calls[0]![1].body).toBe(body);
    expect(fetchMock.mock.calls[0]![1].headers["Content-Type"]).toBeUndefined();
    for (const [, options] of fetchMock.mock.calls) expect(options.credentials).toBe("include");
  });

  it("surfaces upload errors without hiding the original backend validation", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => ({ detail: "Maximum document file size is 100 MB" }),
    });
    await expect(prepareDocument(new FormData())).rejects.toThrow("100 MB");
  });

  it("rejects missing, empty and unsupported files locally", () => {
    expect(validateDocumentFile(null)).toBeTruthy();
    expect(validateDocumentFile(new File([], "empty.pdf"))).toContain("empty");
    expect(validateDocumentFile(new File(["x"], "unsafe.exe"))).toContain("PDF");
    expect(validateDocumentFile(new File(["%PDF-test"], "valid.PDF"))).toBeNull();
  });
});
