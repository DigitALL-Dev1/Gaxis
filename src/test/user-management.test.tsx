import { useAdminAuth } from "@/lib/lumen/admin-auth";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserManagement } from "@/components/lumen/UserManagement";
import {
  createUser,
  getUser,
  loadUserManagement,
  updateUser,
  updateUserStatus,
  type ApiUser,
} from "@/lib/lumen/users-api";

vi.mock("@/lib/lumen/users-api", () => ({
  createUser: vi.fn(),
  getUser: vi.fn(),
  loadUserManagement: vi.fn(),
  updateUser: vi.fn(),
  updateUserStatus: vi.fn(),
}));
const role = {
  _id: "a".repeat(24),
  role_code: "DOCUMENT_OWNER",
  role_name: "Document Owner",
  description: "Prepares controlled documents",
  created_at: "2026-10-21T00:00:00Z",
  updated_at: "2026-10-21T00:00:00Z",
  permissions: ["documents.read"],
  is_active: true,
};
const reader = {
  _id: "b".repeat(24),
  class_code: "EMPLOYEE",
  class_name: "Employee",
  description: "Company employees",
  excluded_families: [],
  created_at: "2026-10-21T00:00:00Z",
  updated_at: "2026-10-21T00:00:00Z",
  access_basis: "ROLE_DEFAULT",
  allowed_classifications: ["D2", "D3"],
  requires_expiry: false,
  max_grant_days: null,
  requires_document_allowlist: false,
  is_active: true,
};
const data = { users: [], roles: [role], readerClasses: [reader] };
const existingUser: ApiUser = {
  _id: "c".repeat(24),
  full_name: "John Smith",
  email: "john@example.com",
  role_ids: [role._id],
  reader_class_id: reader._id,
  status: "ACTIVE",
  user_type: "EMPLOYEE",
  department: "Engineering",
  gaxis_user_id: null,
  created_by: "admin",
  created_at: "2026-10-21T00:00:00Z",
  updated_at: "2026-10-21T00:00:00Z",
};

beforeEach(() => {
  useAdminAuth.setState({
    admin: {
      id: "admin",
      name: "Admin",
      email: "admin@example.com",
      role: "super_admin",
      status: "active",
      created_at: "",
    },
  });
  vi.mocked(loadUserManagement).mockReset().mockResolvedValue(data);
  vi.mocked(createUser).mockReset();
  vi.mocked(getUser).mockReset();
  vi.mocked(updateUser).mockReset();
  vi.mocked(updateUserStatus).mockReset();
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
  useAdminAuth.getState().signOut();
  vi.unstubAllGlobals();
});

function renderPage() {
  render(
    <MantineProvider env="test">
      <UserManagement />
    </MantineProvider>,
  );
}

async function fillForm() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Create user" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Create user" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/Full name/), { target: { value: "John Smith" } });
  fireEvent.change(within(dialog).getByLabelText(/Email address/), {
    target: { value: "john@example.com" },
  });
  fireEvent.click(within(dialog).getByRole("combobox", { name: /Roles/ }));
  fireEvent.click(await screen.findByRole("option", { name: "Document Owner" }));
  fireEvent.click(within(dialog).getByRole("combobox", { name: /Reader class/ }));
  fireEvent.click(await screen.findByRole("option", { name: "Employee" }));
  return dialog;
}

describe("Database-backed user management screen", () => {
  it("loads API reader classes for assignment and excludes inactive classes", async () => {
    vi.mocked(loadUserManagement).mockResolvedValue({
      ...data,
      readerClasses: [
        { ...reader, class_name: "API Vendor", _id: "d".repeat(24) },
        { ...reader, class_name: "Archived Vendor", is_active: false },
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: "Create user" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("combobox", { name: /Reader class/ }),
    );
    expect(await screen.findByRole("option", { name: "API Vendor" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Archived Vendor" })).not.toBeInTheDocument();
  }, 20000);
  it("shows the requested table columns and loads user details from the API", async () => {
    vi.mocked(loadUserManagement).mockResolvedValue({ ...data, users: [existingUser] });
    vi.mocked(getUser).mockResolvedValue(existingUser);
    renderPage();
    await screen.findByText("john@example.com");
    for (const name of ["Name", "Email", "Roles", "Reader Class", "Status", "Actions"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const dialog = await screen.findByRole("dialog");
    expect(getUser).toHaveBeenCalledWith(existingUser._id);
    expect(within(dialog).getByText("Engineering")).toBeInTheDocument();
  }, 20000);
  it("saves edits and updates the displayed user", async () => {
    vi.mocked(loadUserManagement).mockResolvedValue({ ...data, users: [existingUser] });
    vi.mocked(getUser).mockResolvedValue(existingUser);
    vi.mocked(updateUser).mockResolvedValue({ ...existingUser, full_name: "John Updated" });
    renderPage();
    await screen.findByText("john@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Full name/), {
      target: { value: "John Updated" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith(existingUser._id, {
        full_name: "John Updated",
        email: existingUser.email,
        user_type: "EMPLOYEE",
        department: "Engineering",
      }),
    );
    expect(await screen.findByText("John Updated")).toBeInTheDocument();
  }, 20000);
  it("deactivates and reactivates users using the status API", async () => {
    vi.mocked(loadUserManagement).mockResolvedValue({ ...data, users: [existingUser] });
    vi.mocked(updateUserStatus).mockImplementation(async (_id, status) => ({
      ...existingUser,
      status,
    }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("Inactive")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("row", { name: /John Smith/ })).getByText("Active"),
      ).toBeInTheDocument(),
    );
    expect(updateUserStatus).toHaveBeenNthCalledWith(1, existingUser._id, "INACTIVE");
    expect(updateUserStatus).toHaveBeenNthCalledWith(2, existingUser._id, "ACTIVE");
  }, 20000);
  it("keeps the current status when the backend rejects an update", async () => {
    vi.mocked(loadUserManagement).mockResolvedValue({ ...data, users: [existingUser] });
    vi.mocked(updateUserStatus).mockRejectedValue(new Error("Status update failed"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("Status update failed")).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /John Smith/ })).getByText("Active"),
    ).toBeInTheDocument();
  }, 20000);
  it("creates a user using API option IDs and shows the saved record", async () => {
    vi.mocked(createUser).mockImplementation(async (body) => ({
      ...body,
      _id: "c".repeat(24),
      gaxis_user_id: null,
      user_type: body.user_type ?? "EMPLOYEE",
      department: body.department ?? null,
      status: "ACTIVE",
      created_by: "admin_001",
      created_at: "2026-10-21T00:00:00Z",
      updated_at: "2026-10-21T00:00:00Z",
    }));
    renderPage();
    const dialog = await fillForm();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create user" }));
    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith({
        full_name: "John Smith",
        email: "john@example.com",
        role_ids: [role._id],
        reader_class_id: reader._id,
        user_type: "EMPLOYEE",
        department: "",
      }),
    );
    expect(await screen.findByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("John Smith")).toBeInTheDocument();
  }, 60000);
  it("keeps form values and displays backend validation errors", async () => {
    vi.mocked(createUser).mockRejectedValue(new Error("This email already exists"));
    renderPage();
    const dialog = await fillForm();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create user" }));
    expect(await screen.findByText("This email already exists")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Full name/)).toHaveValue("John Smith");
  }, 20000);
  it("shows loading failures and lets the administrator retry", async () => {
    vi.mocked(loadUserManagement).mockRejectedValueOnce(new Error("Backend unavailable"));
    renderPage();
    expect(await screen.findByText("Backend unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create user" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create user" })).toBeEnabled());
  });
  it("does not permit creating users when no active assignment options exist", async () => {
    vi.mocked(loadUserManagement).mockResolvedValue({
      ...data,
      roles: [{ ...role, is_active: false }],
    });
    renderPage();
    expect(await screen.findByText(/Activate at least one role/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create user" })).toBeDisabled();
  });
});
