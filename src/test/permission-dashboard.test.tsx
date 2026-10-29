import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canUseModule, modulesForPermissions } from "@/lib/lumen/permissions";
import { useUserAuth, type SignedInUser } from "@/lib/lumen/user-auth";
import { useAdminAuth } from "@/lib/lumen/admin-auth";
import { RoleGate } from "@/components/lumen/common";
import { UserDashboard } from "@/routes/dashboard";
import { SidebarNav } from "@/components/lumen/AppShell";

vi.setConfig({ testTimeout: 20000 });
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useRouterState: () => "/dashboard",
}));
const user: SignedInUser = {
  id: "user",
  full_name: "Zain Israr",
  email: "zain@example.com",
  status: "active",
  gaxis_user_id: null,
  roles: [{ id: "role", code: "MANAGER", name: "Manager" }],
  reader_class: { id: "class", code: "EMPLOYEE", name: "Employee" },
  permissions: ["documents.read", "team.progress.read"],
  modules: ["system", "roles"],
};
beforeEach(() => {
  useAdminAuth.getState().signOut();
  useUserAuth.setState({ user });
});
afterEach(cleanup);

describe("Permission-based dashboard and routes", () => {
  it("removes the demo modules even when the backend returns their permissions", () => {
    expect(
      modulesForPermissions([
        "team.progress.read",
        "media.read",
        "documents.acknowledge",
        "audit.read",
      ]),
    ).toEqual(["dashboard", "profile"]);
    useAdminAuth.setState({
      admin: {
        id: "admin",
        name: "Administrator",
        email: "admin@example.com",
        role: "super_admin",
        status: "active",
        created_at: "",
      },
    });
    render(<SidebarNav />);
    for (const name of ["My Reading", "Team Progress", "Audit Logs"])
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Media Library" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Prepare Media" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Access Grants" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Release Queue" })).toBeInTheDocument();
  });
  it("maps each permission independently, with no management access inferred from roles", () => {
    expect(modulesForPermissions(user.permissions).sort()).toEqual(
      ["dashboard", "library", "media", "profile"].sort(),
    );
    expect(canUseModule(["documents.prepare"], "mediaPrepare")).toBe(true);
    expect(canUseModule([], "roles")).toBe(false);
    expect(canUseModule(["roles.manage"], "roles")).toBe(true);
    expect(canUseModule(["roles.manage"], "system")).toBe(false);
    expect(canUseModule(["reader_classes.manage"], "readerClasses")).toBe(true);
    expect(canUseModule(["users.create"], "system")).toBe(true);
    expect(canUseModule(["access_grants.manage"], "grants")).toBe(true);
    expect(canUseModule(["documents.review"], "release")).toBe(true);
    expect(canUseModule(["documents.prepare"], "release")).toBe(false);
  });

  it("shows the Manager example with only permitted modules", () => {
    render(
      <MantineProvider env="test">
        <UserDashboard user={user} />
      </MantineProvider>,
    );
    expect(screen.getByText("Welcome, Zain Israr")).toBeInTheDocument();
    expect(screen.getByText("Manager · Employee")).toBeInTheDocument();
    for (const name of ["Document Library", "Media Library", "My Profile"])
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    for (const name of [
      "User Management",
      "Roles Management",
      "Reader Classes Management",
      "Prepare Document",
      "Release Queue",
    ])
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
  });

  it("uses permissions for the sidebar even if incoming module names are forged", () => {
    render(<SidebarNav />);
    for (const name of ["Dashboard", "Document Library", "Media Library", "My Profile"])
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Roles Management" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "User Management" })).not.toBeInTheDocument();
  });

  it("shows Access Denied for unauthorized direct navigation and permits exact matches", () => {
    const view = render(
      <RoleGate need="roles">
        <p>Restricted role editor</p>
      </RoleGate>,
    );
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(screen.queryByText("Restricted role editor")).not.toBeInTheDocument();
    useUserAuth.setState({
      user: { ...user, roles: [{ id: "admin", code: "SYSTEM_ADMIN", name: "Administrator" }] },
    });
    view.rerender(
      <RoleGate need="roles">
        <p>Restricted role editor</p>
      </RoleGate>,
    );
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    useUserAuth.setState({ user: { ...user, permissions: ["roles.manage"] } });
    view.rerender(
      <RoleGate need="roles">
        <p>Restricted role editor</p>
      </RoleGate>,
    );
    expect(screen.getByText("Restricted role editor")).toBeInTheDocument();
  });
});
