import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentUploadForm } from "@/components/lumen/DocumentPreparation";
import { loadActiveDocumentFamilies } from "@/lib/lumen/document-families-api";
import { listReaderClasses } from "@/lib/lumen/reader-classes-api";
import {
  prepareDocument,
  uploadDocumentRevision,
  MAX_DOCUMENT_SIZE,
  type ApiDocument,
} from "@/lib/lumen/documents-api";
import { useUserAuth, type SignedInUser } from "@/lib/lumen/user-auth";
import { useAdminAuth } from "@/lib/lumen/admin-auth";

vi.setConfig({ testTimeout: 20000 });
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/lib/lumen/document-families-api", () => ({ loadActiveDocumentFamilies: vi.fn() }));
vi.mock("@/lib/lumen/reader-classes-api", () => ({ listReaderClasses: vi.fn() }));
vi.mock("@/lib/lumen/documents-api", async (original) => ({
  ...(await original<typeof import("@/lib/lumen/documents-api")>()),
  prepareDocument: vi.fn(),
  uploadDocumentRevision: vi.fn(),
}));
const user: SignedInUser = {
  id: "owner-user",
  full_name: "Sarah",
  email: "sarah@example.com",
  gaxis_user_id: null,
  status: "active",
  roles: [],
  reader_class: { id: "class", code: "EMPLOYEE", name: "Employee" },
  permissions: ["documents.prepare", "documents.submit"],
  modules: [],
};
const family = {
  _id: "family-id",
  family_name: "API Safety",
  family_code: "SAFETY",
  description: "",
  owner_user_id: user.id,
  releaser_user_ids: [],
  is_active: true,
  created_by: "admin",
  created_at: "",
  updated_at: "",
};
const reader = {
  _id: "reader-id",
  class_code: "EMPLOYEE",
  class_name: "API Employee",
  description: "",
  access_basis: "ROLE_DEFAULT",
  allowed_classifications: ["D2", "D3"],
  requires_expiry: false,
  max_grant_days: null,
  requires_document_allowlist: false,
  excluded_families: [],
  is_active: true,
  created_at: "",
  updated_at: "",
};
const saved = {
  message: "Document prepared successfully",
  document_id: "doc-id",
  version_id: "version-id",
  version_number: "1.0",
  status: "UNDER_REVIEW",
};
const onSaved = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  useAdminAuth.getState().signOut();
  useUserAuth.setState({ user });
  vi.mocked(loadActiveDocumentFamilies).mockResolvedValue([
    family,
    {
      ...family,
      _id: "other",
      family_name: "Someone else's family",
      owner_user_id: "another-user",
    },
  ]);
  vi.mocked(listReaderClasses).mockResolvedValue([
    reader,
    { ...reader, _id: "inactive", class_name: "Inactive reader", is_active: false },
  ]);
  vi.mocked(prepareDocument).mockResolvedValue(saved);
  vi.mocked(uploadDocumentRevision).mockResolvedValue({ ...saved, version_number: "2.0" });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useUserAuth.setState({ user: null });
});
function renderForm(document?: ApiDocument) {
  return render(
    <MantineProvider env="test">
      <DocumentUploadForm {...(document ? { document } : {})} onSaved={onSaved} />
    </MantineProvider>,
  );
}
async function fillForm(
  view: ReturnType<typeof render>,
  file = new File(["%PDF-sample"], "policy.pdf", { type: "application/pdf" }),
) {
  await screen.findByLabelText(/Document title/);
  fireEvent.change(screen.getByLabelText(/Document title/), { target: { value: "Safety policy" } });
  fireEvent.change(screen.getByLabelText(/Document reference/), {
    target: { value: "HSE-POL-001" },
  });
  fireEvent.click(screen.getByRole("combobox", { name: /Document family/ }));
  expect(screen.queryByRole("option", { name: "Someone else's family" })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole("option", { name: "API Safety" }));
  fireEvent.click(screen.getByRole("combobox", { name: /Reader classes/ }));
  expect(screen.queryByRole("option", { name: "Inactive reader" })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole("option", { name: "API Employee" }));
  fireEvent.change(view.container.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });
}

describe("Document preparation with live API options", () => {
  it("posts selected database IDs, the current owner and real file as FormData", async () => {
    const view = renderForm();
    await fillForm(view);
    expect(screen.getByLabelText(/Document owner/)).toHaveValue("Sarah");
    fireEvent.submit(view.container.querySelector("form")!);
    await waitFor(() => expect(prepareDocument).toHaveBeenCalledTimes(1));
    const body = vi.mocked(prepareDocument).mock.calls[0]![0];
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("owner_user_id")).toBe(user.id);
    expect(body.get("family_id")).toBe(family._id);
    expect(body.get("reader_class_ids")).toBe(reader._id);
    expect(body.get("classification")).toBe("D2");
    expect(body.get("file")).toBeInstanceOf(File);
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it.each(["Document reference already exists", "Document with reference 'ABC-1' already exists"])(
    "retains values and provides revision guidance for duplicate errors: %s",
    async (detail) => {
      vi.mocked(prepareDocument).mockRejectedValue(new Error(detail));
      const view = renderForm();
      await fillForm(view);
      fireEvent.submit(view.container.querySelector("form")!);
      expect(await screen.findByText(detail)).toBeInTheDocument();
      expect(screen.getByLabelText(/Document title/)).toHaveValue("Safety policy");
      expect(screen.getByText("policy.pdf")).toBeInTheDocument();
      expect(screen.getByText("Document references must be unique.")).toBeInTheDocument();
      expect(screen.getByText(/If a version is already under review/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Open My Prepared Documents" })).toBeInTheDocument();
      expect(onSaved).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText(/Document reference/), {
        target: { value: "HSE-POL-002" },
      });
      expect(screen.queryByText("Document references must be unique.")).not.toBeInTheDocument();
    },
  );

  it("rejects oversized files before calling the API", async () => {
    const file = new File(["small"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: MAX_DOCUMENT_SIZE + 1 });
    const view = renderForm();
    await fillForm(view, file);
    fireEvent.submit(view.container.querySelector("form")!);
    expect(await screen.findByText("Maximum document file size is 100 MB.")).toBeInTheDocument();
    expect(prepareDocument).not.toHaveBeenCalled();
  });

  it("requires submit permission independently of preparation permission", async () => {
    useUserAuth.setState({ user: { ...user, permissions: ["documents.prepare"] } });
    renderForm();
    await screen.findByLabelText(/Document title/);
    expect(screen.getByRole("button", { name: "Submit for Approval" })).toBeDisabled();
    expect(screen.getByText(/submission requires documents.submit permission/)).toBeInTheDocument();
  });

  it("shows option failures and allows retry without hardcoded families", async () => {
    vi.mocked(loadActiveDocumentFamilies)
      .mockRejectedValueOnce(new Error("Families unavailable"))
      .mockResolvedValue([]);
    renderForm();
    expect(await screen.findByText("Families unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh options" }));
    expect(await screen.findByText(/No active document families are assigned/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for Approval" })).toBeDisabled();
  });

  it("requires a revised change summary and sends proposed metadata for review", async () => {
    const document: ApiDocument = {
      _id: "doc-id",
      title: "Safety policy",
      reference: "HSE-POL-001",
      family_id: family._id,
      family_name: family.family_name,
      owner_user_id: user.id,
      owner_name: user.full_name,
      classification: "D2",
      reader_class_ids: [reader._id],
      acknowledgement_required: true,
      is_active: true,
      current_version_id: "approved-id",
      current_approved_version: null,
      pending_versions: [],
      latest_version: null,
      status: "APPROVED_CURRENT",
      can_prepare_revision: true,
    };
    const view = renderForm(document);
    await screen.findByLabelText(/Version number/);
    fireEvent.change(screen.getByLabelText(/Version number/), { target: { value: "2.0" } });
    fireEvent.change(view.container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["%PDF-v2"], "revised.pdf", { type: "application/pdf" })] },
    });
    fireEvent.submit(view.container.querySelector("form")!);
    expect(
      await screen.findByText("A change summary is required for a revised version."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Change summary/), {
      target: { value: "Updated safety steps" },
    });
    fireEvent.submit(view.container.querySelector("form")!);
    await waitFor(() => expect(uploadDocumentRevision).toHaveBeenCalledTimes(1));
    const [id, body] = vi.mocked(uploadDocumentRevision).mock.calls[0]!;
    expect(id).toBe(document._id);
    expect(body.get("change_summary")).toBe("Updated safety steps");
    expect(body.get("version_number")).toBe("2.0");
    expect(body.get("classification")).toBe("D2");
    expect(body.get("title")).toBe("Safety policy");
  });
});
