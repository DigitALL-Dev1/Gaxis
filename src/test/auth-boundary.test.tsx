import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { AuthBoundary } from "@/components/lumen/AuthBoundary";
import { useAdminAuth, type AdminDetails } from "@/lib/lumen/admin-auth";
import { useUserAuth, type SignedInUser } from "@/lib/lumen/user-auth";
const admin: AdminDetails = {
  id: "admin_001",
  name: "System Administrator",
  email: "admin@example.com",
  role: "super_admin",
  status: "active",
  created_at: "2026-10-20T00:00:00Z",
};

const routing = vi.hoisted(() => ({ path: "/dashboard", navigate: vi.fn() }));
let root: Root | undefined;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
async function renderBoundary(text: string) {
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <AuthBoundary>
        <span>{text}</span>
      </AuthBoundary>,
    );
  });
  return container;
}
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => routing.navigate,
  useRouterState: () => routing.path,
}));
vi.mock("@/components/lumen/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="workspace-shell">{children}</div>
  ),
}));
vi.mock("@/components/lumen/common", () => ({ LoadingState: () => <span>Loading</span> }));

beforeEach(() => {
  routing.path = "/dashboard";
  routing.navigate.mockReset();
  useAdminAuth.setState({ admin: null });
  useUserAuth.setState({ user: null });
  vi.spyOn(useUserAuth.getState(), "restore").mockResolvedValue();
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  vi.restoreAllMocks();
});

describe("Frontend session boundary", () => {
  it("leaves the token verification page public without racing a session restore", async () => {
    routing.path = "/verify-login";
    const container = await renderBoundary("Verify login link");
    expect(container.textContent).toContain("Verify login link");
    expect(useUserAuth.getState().restore).not.toHaveBeenCalled();
    expect(routing.navigate).not.toHaveBeenCalled();
  });
  it("hides private content and sends a signed-out visitor to login", async () => {
    const container = await renderBoundary("Private document");
    expect(container.textContent).not.toContain("Private document");
    expect(routing.navigate).toHaveBeenCalledWith({ to: "/login", replace: true });
    expect(container.querySelector('[data-testid="workspace-shell"]')).toBeNull();
  });
  it("renders the public login without the workspace shell", async () => {
    routing.path = "/login";
    const container = await renderBoundary("Login form");
    expect(container.textContent).toContain("Login form");
    expect(container.querySelector('[data-testid="workspace-shell"]')).toBeNull();
  });
  it("renders the authenticated administrator after a successful password check", async () => {
    useAdminAuth.setState({ admin });
    const container = await renderBoundary("Workspace content");
    expect(container.textContent).toContain("Workspace content");
    expect(useAdminAuth.getState().admin).toEqual(admin);
  });
  it("sends a signed-in administrator to the dashboard", async () => {
    routing.path = "/login";
    useAdminAuth.setState({ admin: admin });
    await renderBoundary("Login form");
    expect(routing.navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true });
  });
  it("restores a registered user and applies backend module access", async () => {
    const user: SignedInUser = {
      id: "507f1f77bcf86cd799439011",
      full_name: "John Smith",
      email: "john@example.com",
      gaxis_user_id: null,
      status: "active",
      roles: [{ id: "507f1f77bcf86cd799439012", code: "DOCUMENT_OWNER", name: "Document Owner" }],
      reader_class: { id: "507f1f77bcf86cd799439013", code: "EMPLOYEE", name: "Employee" },
      permissions: ["documents.prepare"],
      modules: ["dashboard", "profile", "prepare"],
    };
    vi.mocked(useUserAuth.getState().restore).mockImplementation(async () => {
      useUserAuth.setState({ user });
    });
    const container = await renderBoundary("User workspace");
    expect(container.textContent).toContain("User workspace");
    expect(useUserAuth.getState().user).toEqual(user);
  });
});
