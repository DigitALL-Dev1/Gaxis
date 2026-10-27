import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentLibrary } from "@/components/lumen/DocumentLibrary";
import { DocumentDetails } from "@/components/lumen/DocumentDetails";
import { MyPreparedDocuments, ReleaseQueue } from "@/components/lumen/PreparedDocuments";
import {
  getDocument,
  getDocumentVersion,
  listDocumentVersions,
  listDocuments,
  listMyPreparedDocuments,
  getReleaseQueue,
  getReviewDetails,
  releaseDocumentVersion,
  returnDocumentVersion,
  getDocumentFile,
  getDocumentReviews,
  type ApiDocument,
  type ApiDocumentVersion,
} from "@/lib/lumen/documents-api";

vi.setConfig({ testTimeout: 20000 });
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/lib/lumen/documents-api", async (original) => ({
  ...(await original<typeof import("@/lib/lumen/documents-api")>()),
  getDocument: vi.fn(),
  getDocumentVersion: vi.fn(),
  listDocumentVersions: vi.fn(),
  listDocuments: vi.fn(),
  listMyPreparedDocuments: vi.fn(),
  getReleaseQueue: vi.fn(),
  getReviewDetails: vi.fn(),
  releaseDocumentVersion: vi.fn(),
  returnDocumentVersion: vi.fn(),
  getDocumentFile: vi.fn(),
  getDocumentReviews: vi.fn(),
}));
const approved: ApiDocumentVersion = {
  _id: "approved",
  document_id: "doc-id",
  version_number: "1.0",
  status: "APPROVED_CURRENT",
  file_name: "approved.pdf",
  file_type: "application/pdf",
  file_size: 1024,
  checksum_sha256: "abc123",
  change_summary: "Initial issue",
  prepared_by: "owner",
  prepared_at: "2026-10-25T00:00:00Z",
  released_by: "reviewer",
  released_at: "2026-10-25T00:00:00Z",
  superseded_at: null,
};
const pending: ApiDocumentVersion = {
  ...approved,
  _id: "pending",
  version_number: "2.0",
  status: "UNDER_REVIEW",
  file_name: "revised.pdf",
  released_by: null,
  released_at: null,
  change_summary: "Revised procedure",
};
const document: ApiDocument = {
  _id: "doc-id",
  title: "Safety policy",
  reference: "HSE-POL-001",
  family_id: "family",
  family_name: "Safety",
  owner_user_id: "owner",
  owner_name: "Sarah",
  classification: "D2",
  reader_class_ids: ["class"],
  acknowledgement_required: true,
  is_active: true,
  current_version_id: approved._id,
  current_approved_version: approved,
  latest_version: pending,
  pending_versions: [pending],
  status: "UNDER_REVIEW",
  can_prepare_revision: false,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listDocuments).mockResolvedValue([
    document,
    { ...document, _id: "unapproved", title: "Unapproved policy", current_approved_version: null },
  ]);
  vi.mocked(listMyPreparedDocuments).mockResolvedValue([document]);
  vi.mocked(getReleaseQueue).mockResolvedValue([{ document, version: pending }]);
  vi.mocked(getReviewDetails).mockResolvedValue({
    document,
    version: pending,
    preparer_name: "Sarah",
    can_release: true,
    can_return: true,
  });
  vi.mocked(getDocumentFile).mockResolvedValue(
    new Blob(["%PDF-test"], { type: "application/pdf" }),
  );
  vi.mocked(getDocumentReviews).mockResolvedValue([]);
  vi.mocked(releaseDocumentVersion).mockResolvedValue({
    message: "Released",
    document_id: document._id,
    version_id: pending._id,
    version_number: "2.0",
    status: "APPROVED_CURRENT",
  });
  vi.mocked(returnDocumentVersion).mockResolvedValue({
    message: "Returned",
    document_id: document._id,
    version_id: pending._id,
    version_number: "2.0",
    status: "RETURNED_FOR_CORRECTION",
  });
  URL.createObjectURL = vi.fn(() => "blob:test-document");
  URL.revokeObjectURL = vi.fn();
  vi.mocked(getDocument).mockResolvedValue(document);
  vi.mocked(listDocumentVersions).mockResolvedValue([pending, approved]);
  vi.mocked(getDocumentVersion).mockResolvedValue(pending);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function show(element: ReactNode) {
  render(<MantineProvider env="test">{element}</MantineProvider>);
}

describe("Database document views", () => {
  it("shows only the approved pointer in the library and excludes unapproved documents", async () => {
    show(<DocumentLibrary />);
    await screen.findByText("Safety policy");
    expect(screen.getByText("1.0")).toBeInTheDocument();
    expect(screen.getByText("Approved & Current")).toBeInTheDocument();
    expect(screen.queryByText("Unapproved policy")).not.toBeInTheDocument();
    expect(screen.queryByText("Under Review")).not.toBeInTheDocument();
    expect(screen.queryByText("2.0")).not.toBeInTheDocument();
  });

  it("displays pending and approved versions separately in My Prepared Documents", async () => {
    show(<MyPreparedDocuments />);
    await screen.findByText("Safety policy");
    expect(screen.getByText("v2.0")).toBeInTheDocument();
    expect(screen.getByText("v1.0")).toBeInTheDocument();
    expect(screen.getByText("Under Review")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Approve|Release document/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View preparation details" }));
    expect(
      await within(screen.getByRole("dialog")).findByText("Current approved version"),
    ).toBeInTheDocument();
    expect(getDocument).toHaveBeenCalledWith(document._id);
  });

  it("loads version details using the specific version API", async () => {
    show(<DocumentDetails documentId={document._id} />);
    await screen.findByText("revised.pdf");
    fireEvent.click(screen.getAllByRole("button", { name: "View version" })[0]!);
    expect(await screen.findByText("Version 2.0")).toBeInTheDocument();
    expect(getDocumentVersion).toHaveBeenCalledWith(pending._id);
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("loads actual pending versions and keeps decisions inside the review screen", async () => {
    show(<ReleaseQueue />);
    await screen.findByText("Safety policy");
    expect(getReleaseQueue).toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /Approve|Publish|Release document/ }),
    ).not.toBeInTheDocument();
  });

  it("previews the submitted file and requires confirmation before releasing", async () => {
    vi.mocked(getReviewDetails).mockResolvedValue({
      document,
      version: pending,
      preparer_name: "Sarah",
      can_release: true,
      can_return: true,
      admin_review: true,
      self_review_override: true,
    });
    show(<ReleaseQueue />);
    fireEvent.click(await screen.findByRole("button", { name: "Review" }));
    expect(await screen.findByText("Change summary: Revised procedure")).toBeInTheDocument();
    await screen.findByTitle("Document preview");
    expect(
      screen.getByText(/This decision will be recorded as an Admin override/),
    ).toBeInTheDocument();
    expect(getReviewDetails).toHaveBeenCalledWith(pending._id);
    expect(getDocumentFile).toHaveBeenCalledWith(pending._id);
    fireEvent.change(screen.getByLabelText("Review comments"), {
      target: { value: "Ready to publish" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve & Release" }));
    expect(await screen.findByText("Confirm approval")).toBeInTheDocument();
    expect(releaseDocumentVersion).not.toHaveBeenCalled();
    vi.mocked(getReleaseQueue).mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Release" }));
    await waitFor(() =>
      expect(releaseDocumentVersion).toHaveBeenCalledWith(pending._id, "Ready to publish"),
    );
    expect(await screen.findByText("No documents are awaiting review.")).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-document");
  });

  it("requires return comments and keeps backend errors visible for retry", async () => {
    show(<ReleaseQueue />);
    fireEvent.click(await screen.findByRole("button", { name: "Review" }));
    fireEvent.click(await screen.findByRole("button", { name: "Return for Correction" }));
    expect(
      await screen.findByText(/Review comments are required when returning/),
    ).toBeInTheDocument();
    expect(returnDocumentVersion).not.toHaveBeenCalled();
    vi.mocked(returnDocumentVersion).mockRejectedValueOnce(
      new Error("This version is no longer awaiting review"),
    );
    fireEvent.change(screen.getByLabelText("Review comments"), {
      target: { value: "Fix classification" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Return for Correction" }));
    expect(
      await screen.findByText("This version is no longer awaiting review"),
    ).toBeInTheDocument();
    expect(returnDocumentVersion).toHaveBeenCalledWith(pending._id, "Fix classification");
    expect(screen.getByLabelText("Review comments")).toHaveValue("Fix classification");
  });

  it("disables decisions for a preparer and allows a reviewer without release permission to return", async () => {
    vi.mocked(getReviewDetails).mockResolvedValueOnce({
      document,
      version: pending,
      preparer_name: "Sarah",
      can_release: false,
      can_return: false,
    });
    show(<ReleaseQueue />);
    fireEvent.click(await screen.findByRole("button", { name: "Review" }));
    expect(await screen.findByRole("button", { name: "Approve & Release" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Return for Correction" })).toBeDisabled();
    cleanup();
    vi.mocked(getReviewDetails).mockResolvedValueOnce({
      document,
      version: pending,
      preparer_name: "Sarah",
      can_release: false,
      can_return: true,
    });
    show(<ReleaseQueue />);
    fireEvent.click(await screen.findByRole("button", { name: "Review" }));
    expect(await screen.findByRole("button", { name: "Approve & Release" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Return for Correction" })).toBeEnabled();
  });

  it("shows the owner's returned comments and approval history", async () => {
    const review = {
      decision: "RETURNED" as const,
      review_comments: "Please correct classification",
      reviewed_by: "reviewer",
      reviewer_name: "Michael",
      reviewed_at: "2026-10-25T01:00:00Z",
      version_id: pending._id,
      version_number: pending.version_number,
    };
    vi.mocked(getDocument).mockResolvedValue({ ...document, can_view_reviews: true });
    vi.mocked(getDocumentReviews).mockResolvedValue([review]);
    show(<DocumentDetails documentId={document._id} />);
    expect(await screen.findByText("Please correct classification")).toBeInTheDocument();
    expect(screen.getByText("Approval history")).toBeInTheDocument();
    expect(getDocumentReviews).toHaveBeenCalledWith(document._id);
  });

  it("prevents duplicate decisions and modal closing while a request is processing", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof returnDocumentVersion>>) => void;
    vi.mocked(returnDocumentVersion).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    show(<ReleaseQueue />);
    fireEvent.click(await screen.findByRole("button", { name: "Review" }));
    await screen.findByLabelText("Review comments");
    fireEvent.change(screen.getByLabelText("Review comments"), { target: { value: "Fix title" } });
    fireEvent.click(screen.getByRole("button", { name: "Return for Correction" }));
    expect(screen.getByRole("button", { name: "Approve & Release" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Return for Correction" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Return for Correction" }));
    expect(returnDocumentVersion).toHaveBeenCalledTimes(1);
    resolve({
      message: "Returned",
      document_id: document._id,
      version_id: pending._id,
      version_number: "2.0",
      status: "RETURNED_FOR_CORRECTION",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
