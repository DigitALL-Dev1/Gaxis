import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaPreparation } from "@/components/lumen/MediaPreparation";
import { loadActiveDocumentFamilies } from "@/lib/lumen/document-families-api";
import { listReaderClasses } from "@/lib/lumen/reader-classes-api";
import { listMedia, prepareMedia } from "@/lib/lumen/media-api";
import { useUserAuth, type SignedInUser } from "@/lib/lumen/user-auth";
import { useAdminAuth } from "@/lib/lumen/admin-auth";

vi.mock("@/lib/lumen/document-families-api", () => ({
  loadActiveDocumentFamilies: vi.fn(),
}));
vi.mock("@/lib/lumen/reader-classes-api", () => ({ listReaderClasses: vi.fn() }));
vi.mock("@/lib/lumen/media-api", async (original) => ({
  ...(await original<typeof import("@/lib/lumen/media-api")>()),
  listMedia: vi.fn(),
  prepareMedia: vi.fn(),
}));
vi.setConfig({ testTimeout: 20000 });

const user: SignedInUser = {
  id: "owner-user",
  full_name: "Sarah",
  email: "sarah@example.com",
  gaxis_user_id: null,
  status: "active",
  roles: [],
  reader_class: { id: "class", code: "EMPLOYEE", name: "Employee" },
  permissions: ["documents.prepare"],
  modules: [],
};
const family = {
  _id: "family-id",
  family_code: "SAFETY",
  family_name: "Site Safety",
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
  class_name: "Employee",
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

beforeEach(() => {
  vi.resetAllMocks();
  useAdminAuth.getState().signOut();
  useUserAuth.setState({ user });
  vi.mocked(loadActiveDocumentFamilies).mockResolvedValue([family]);
  vi.mocked(listReaderClasses).mockResolvedValue([reader]);
  vi.mocked(listMedia).mockResolvedValue([]);
  vi.mocked(prepareMedia).mockResolvedValue({
    message: "Media uploaded successfully",
    media_asset_id: "asset-id",
    document_id: "document-id",
    version_id: "version-id",
    processing_status: "QUEUED",
    publication_status: "UNDER_REVIEW",
  });
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

describe("Media preparation", () => {
  it("submits selected family, reader-class IDs and the media file as multipart form data", async () => {
    const view = render(
      <MantineProvider env="test">
        <MediaPreparation />
      </MantineProvider>,
    );

    await screen.findByLabelText(/Media title/);
    fireEvent.change(screen.getByLabelText(/Media title/), {
      target: { value: "Site induction" },
    });
    fireEvent.change(screen.getByLabelText(/Controlled item reference/), {
      target: { value: "HSE-VID-001" },
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Document family" }));
    fireEvent.click(await screen.findByRole("option", { name: "Site Safety" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Reader classes" }));
    fireEvent.click(await screen.findByRole("option", { name: "Employee" }));
    const file = new File(["video"], "induction.mp4", { type: "video/mp4" });
    fireEvent.change(view.container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    fireEvent.submit(view.container.querySelector("form")!);
    await waitFor(() => expect(prepareMedia).toHaveBeenCalledTimes(1));

    const body = vi.mocked(prepareMedia).mock.calls[0]![0];
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("title")).toBe("Site induction");
    expect(body.get("reference")).toBe("HSE-VID-001");
    expect(body.get("family_id")).toBe("family-id");
    expect(body.get("reader_class_ids")).toBe("reader-id");
    expect(body.get("media_type")).toBe("VIDEO");
    expect(body.get("licence_status")).toBe("OWNED");
    expect(body.get("file")).toBe(file);
  });
});
