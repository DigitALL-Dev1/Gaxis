import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RolesManagement } from "@/components/lumen/RolesManagement";
import {
  createRole,
  getRole,
  listRoles,
  updateRole,
  updateRoleStatus,
  type ApiRole,
} from "@/lib/lumen/roles-api";

vi.setConfig({ testTimeout: 20000 });

vi.mock("@/lib/lumen/roles-api", () => ({
  createRole: vi.fn(),
  getRole: vi.fn(),
  listRoles: vi.fn(),
  updateRole: vi.fn(),
  updateRoleStatus: vi.fn(),
}));
const role: ApiRole = {
  _id: "a".repeat(24),
  role_name: "Manager",
  role_code: "MANAGER",
  description: "Team oversight",
  permissions: ["team.read"],
  is_active: true,
  created_at: "2026-10-25",
  updated_at: "2026-10-25",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listRoles).mockResolvedValue([role]);
  vi.mocked(getRole).mockResolvedValue(role);
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
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
  Reflect.deleteProperty(document, "fonts");
  vi.unstubAllGlobals();
});
function renderPage() {
  render(
    <MantineProvider env="test">
      <RolesManagement />
    </MantineProvider>,
  );
}
async function openCreate() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Create role" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Create role" }));
  return screen.getByRole("dialog");
}

describe("Roles management", () => {
  it("displays the requested columns and fetches details when viewing", async () => {
    renderPage();
    await screen.findByText("MANAGER");
    for (const name of [
      "Role Name",
      "Role Code",
      "Description",
      "Permissions",
      "Status",
      "Actions",
    ]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(
      within(await screen.findByRole("dialog")).getByText("Team oversight"),
    ).toBeInTheDocument();
    expect(getRole).toHaveBeenCalledWith(role._id);
  });

  it("creates a role with permission codes and refreshes the list", async () => {
    const created = {
      ...role,
      role_name: "Document Owner",
      role_code: "DOCUMENT_OWNER",
    };
    vi.mocked(createRole).mockResolvedValue(created);
    vi.mocked(listRoles).mockResolvedValueOnce([role]).mockResolvedValue([created]);
    renderPage();
    const dialog = await openCreate();
    fireEvent.change(within(dialog).getByLabelText(/Role name/), {
      target: { value: "Document Owner" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Role code/), {
      target: { value: "DOCUMENT_OWNER" },
    });
    fireEvent.change(within(dialog).getByLabelText("Description"), {
      target: { value: "Prepares documents" },
    });
    fireEvent.change(within(dialog).getByLabelText("Permissions"), {
      target: { value: "documents.read, documents.prepare\ndocuments.read" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create role" }));
    await waitFor(() =>
      expect(createRole).toHaveBeenCalledWith({
        role_name: "Document Owner",
        role_code: "DOCUMENT_OWNER",
        description: "Prepares documents",
        permissions: ["documents.read", "documents.prepare"],
      }),
    );
    await waitFor(() => expect(listRoles).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("DOCUMENT_OWNER")).toBeInTheDocument();
  });

  it("loads an edit form and preserves values on save errors before retrying", async () => {
    vi.mocked(updateRole)
      .mockRejectedValueOnce(new Error("Role code already exists"))
      .mockResolvedValueOnce({ ...role, role_name: "Team Manager" });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect(getRole).toHaveBeenCalledWith(role._id);
    fireEvent.change(within(dialog).getByLabelText(/Role name/), {
      target: { value: "Team Manager" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Role code already exists")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Role name/)).toHaveValue("Team Manager");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(listRoles).toHaveBeenCalledTimes(2));
    expect(updateRole).toHaveBeenLastCalledWith(role._id, {
      role_name: "Team Manager",
      role_code: "MANAGER",
      description: role.description,
      permissions: role.permissions,
    });
  });

  it("deactivates and activates roles and refreshes persisted status", async () => {
    let active = true;
    vi.mocked(listRoles).mockImplementation(async () => [{ ...role, is_active: active }]);
    vi.mocked(updateRoleStatus).mockImplementation(async (_id, status) => {
      active = status;
      return { ...role, is_active: status };
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Activate" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Deactivate" })).toBeEnabled());
    expect(updateRoleStatus).toHaveBeenNthCalledWith(1, role._id, false);
    expect(updateRoleStatus).toHaveBeenNthCalledWith(2, role._id, true);
    expect(listRoles).toHaveBeenCalledTimes(3);
  });

  it("keeps status when an update fails and allows retry", async () => {
    vi.mocked(updateRoleStatus).mockRejectedValue(new Error("Update failed"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("Update failed")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeEnabled();
  });

  it("shows a list error and refreshes to an empty state", async () => {
    vi.mocked(listRoles)
      .mockRejectedValueOnce(new Error("Backend unavailable"))
      .mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText("Backend unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText(/No roles yet/)).toBeInTheDocument();
  });
});
