import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentFamiliesManagement } from "@/components/lumen/DocumentFamiliesManagement";
import { RoleGate } from "@/components/lumen/common";
import { useAdminAuth } from "@/lib/lumen/admin-auth";
import { useUserAuth } from "@/lib/lumen/user-auth";
import {
  createDocumentFamily,
  getDocumentFamily,
  loadDocumentFamilies,
  updateDocumentFamily,
  updateFamilyOwner,
  updateFamilyReleasers,
  updateFamilyStatus,
  type ApiDocumentFamily,
} from "@/lib/lumen/document-families-api";
import { listUsers, type ApiUser, type ApiRole } from "@/lib/lumen/users-api";
import { listRoles } from "@/lib/lumen/roles-api";

vi.setConfig({ testTimeout: 20000 });
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/lib/lumen/document-families-api", () => ({
  createDocumentFamily: vi.fn(),
  getDocumentFamily: vi.fn(),
  loadDocumentFamilies: vi.fn(),
  updateDocumentFamily: vi.fn(),
  updateFamilyOwner: vi.fn(),
  updateFamilyReleasers: vi.fn(),
  updateFamilyStatus: vi.fn(),
}));
vi.mock("@/lib/lumen/users-api", () => ({ listUsers: vi.fn() }));
vi.mock("@/lib/lumen/roles-api", () => ({ listRoles: vi.fn() }));
const roles: ApiRole[] = [
  { _id: "owner-role", role_code: "DOCUMENT_OWNER", role_name: "Document Owner", is_active: true },
  {
    _id: "releaser-role",
    role_code: "DOCUMENT_RELEASER",
    role_name: "Document Releaser",
    is_active: true,
  },
  { _id: "old-role", role_code: "DOCUMENT_OWNER", role_name: "Old Owner", is_active: false },
].map((role) => ({ ...role, description: "", permissions: [], created_at: "", updated_at: "" }));
const users: ApiUser[] = [
  { _id: "sarah", full_name: "Sarah", role_ids: ["owner-role"], status: "ACTIVE" },
  { _id: "michael", full_name: "Michael", role_ids: ["releaser-role"], status: "ACTIVE" },
  { _id: "nida", full_name: "Nida", role_ids: ["releaser-role"], status: "active" },
  { _id: "wrong", full_name: "Wrong Role", role_ids: ["employee-role"], status: "ACTIVE" },
  { _id: "inactive", full_name: "Inactive Owner", role_ids: ["owner-role"], status: "INACTIVE" },
  { _id: "old", full_name: "Inactive Role", role_ids: ["old-role"], status: "ACTIVE" },
].map((user) => ({
  ...user,
  email: `${user._id}@example.com`,
  gaxis_user_id: null,
  user_type: "EMPLOYEE",
  reader_class_id: "class",
  department: null,
  created_by: "admin",
  created_at: "",
  updated_at: "",
}));
const family: ApiDocumentFamily = {
  _id: "family-id",
  family_name: "HR & Induction",
  family_code: "HR",
  description: "HR documents",
  owner_user_id: "sarah",
  releaser_user_ids: ["michael"],
  is_active: true,
  created_by: "admin",
  created_at: "",
  updated_at: "",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadDocumentFamilies).mockResolvedValue([family]);
  vi.mocked(getDocumentFamily).mockResolvedValue(family);
  vi.mocked(listUsers).mockResolvedValue(users);
  vi.mocked(listRoles).mockResolvedValue(roles);
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
});
function renderPage() {
  render(
    <MantineProvider env="test">
      <DocumentFamiliesManagement />
    </MantineProvider>,
  );
}

describe("Document families management", () => {
  it("assigns grant approvers from active managers with grant management permission", async () => {
    vi.mocked(listRoles).mockResolvedValue([
      ...roles,
      {
        ...roles[0]!,
        _id: "manager-role",
        role_code: "MANAGER",
        permissions: ["access_grants.manage"],
      },
    ]);
    vi.mocked(listUsers).mockResolvedValue([
      ...users,
      { ...users[0]!, _id: "zain", full_name: "Zain", role_ids: ["manager-role"] },
    ]);
    vi.mocked(updateDocumentFamily).mockResolvedValue({
      ...family,
      grant_approver_user_ids: ["zain"],
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Assign Grant Approvers" }));
    const field = await screen.findByRole("combobox", { name: "Divisional Grant Approvers" });
    fireEvent.click(field);
    fireEvent.click(await screen.findByRole("option", { name: /Zain/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save assignment" }));
    await waitFor(() =>
      expect(updateDocumentFamily).toHaveBeenCalledWith(family._id, {
        grant_approver_user_ids: ["zain"],
      }),
    );
  });
  it("shows the table and fetches full family details", async () => {
    renderPage();
    await screen.findByText("HR & Induction");
    for (const name of [
      "Family Name",
      "Family Code",
      "Description",
      "Document Owner",
      "Document Releasers",
      "Status",
      "Actions",
    ])
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(within(await screen.findByRole("dialog")).getByText("Sarah")).toBeInTheDocument();
    expect(getDocumentFamily).toHaveBeenCalledWith(family._id);
  });

  it("filters users by active roles and creates with multiple releasers", async () => {
    vi.mocked(createDocumentFamily).mockResolvedValue(family);
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create family" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create family" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Family Name/), {
      target: { value: family.family_name },
    });
    fireEvent.change(within(dialog).getByLabelText(/Family Code/), { target: { value: "hr" } });
    fireEvent.click(within(dialog).getByRole("combobox", { name: "Document Owner" }));
    expect(await screen.findByRole("option", { name: /Sarah/ })).toBeInTheDocument();
    for (const name of [/Michael/, /Wrong Role/, /Inactive Owner/, /Inactive Role/])
      expect(screen.queryByRole("option", { name })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Sarah/ }));
    fireEvent.click(within(dialog).getByRole("combobox", { name: "Document Releasers" }));
    expect(screen.queryByRole("option", { name: /Sarah/ })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("option", { name: /Michael/ }));
    fireEvent.click(within(dialog).getByRole("combobox", { name: "Document Releasers" }));
    fireEvent.click(await screen.findByRole("option", { name: /Nida/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create family" }));
    await waitFor(() =>
      expect(createDocumentFamily).toHaveBeenCalledWith({
        family_name: family.family_name,
        family_code: "HR",
        description: "",
        owner_user_id: "sarah",
        releaser_user_ids: ["michael", "nida"],
        is_active: true,
      }),
    );
    await waitFor(() => expect(loadDocumentFamilies).toHaveBeenCalledTimes(2));
  });

  it("edits metadata without modifying existing assignments", async () => {
    vi.mocked(updateDocumentFamily).mockResolvedValue({ ...family, family_name: "Updated HR" });
    vi.mocked(loadDocumentFamilies)
      .mockResolvedValueOnce([family])
      .mockResolvedValue([{ ...family, family_name: "Updated HR" }]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Family Code/)).toHaveAttribute("readonly");
    fireEvent.change(within(dialog).getByLabelText(/Family Name/), {
      target: { value: "Updated HR" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateDocumentFamily).toHaveBeenCalledWith(family._id, {
        family_name: "Updated HR",
        description: family.description,
      }),
    );
    expect(await screen.findByText("Updated HR")).toBeInTheDocument();
    expect(updateFamilyOwner).not.toHaveBeenCalled();
  });

  it("uses the dedicated owner and multiple-releaser assignment APIs", async () => {
    vi.mocked(updateFamilyOwner).mockResolvedValue(family);
    vi.mocked(updateFamilyReleasers).mockResolvedValue({
      ...family,
      releaser_user_ids: ["michael", "nida"],
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Assign Owner" }));
    let dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save assignment" }));
    await waitFor(() =>
      expect(updateFamilyOwner).toHaveBeenCalledWith(family._id, { owner_user_id: "sarah" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Assign Releasers" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Assign Releasers" }));
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("combobox", { name: "Document Releasers" }));
    fireEvent.click(await screen.findByRole("option", { name: /Nida/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save assignment" }));
    await waitFor(() =>
      expect(updateFamilyReleasers).toHaveBeenCalledWith(family._id, {
        releaser_user_ids: ["michael", "nida"],
      }),
    );
  });

  it("retains form values on backend errors", async () => {
    vi.mocked(updateDocumentFamily).mockRejectedValue(new Error("Family name rejected"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Family name rejected")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Family Name/)).toHaveValue(family.family_name);
  });

  it("refreshes status changes and preserves status on a failed update", async () => {
    vi.mocked(updateFamilyStatus)
      .mockRejectedValueOnce(new Error("Status rejected"))
      .mockResolvedValueOnce({ ...family, is_active: false });
    vi.mocked(loadDocumentFamilies)
      .mockResolvedValueOnce([family])
      .mockResolvedValue([{ ...family, is_active: false }]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("Status rejected")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Activate" })).toBeEnabled());
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("prevents non-admin roles from mounting family management", () => {
    useAdminAuth.getState().signOut();
    useUserAuth.setState({ user: null });
    render(
      <MantineProvider env="test">
        <RoleGate need="system">
          <DocumentFamiliesManagement />
        </RoleGate>
      </MantineProvider>,
    );
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(loadDocumentFamilies).not.toHaveBeenCalled();
  });
});
