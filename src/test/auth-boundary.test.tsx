import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { AuthBoundary } from "@/components/lumen/AuthBoundary";
import { useDemoAuth } from "@/lib/lumen/auth";
import { useLumen } from "@/lib/lumen/store";
import { ROLE_USERS } from "@/lib/lumen/data";

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
  useDemoAuth.getState().signOut();
  vi.spyOn(useLumen.persist, "rehydrate").mockResolvedValue(undefined);
  vi.spyOn(useDemoAuth.persist, "rehydrate").mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  vi.restoreAllMocks();
});

describe("Frontend session boundary", () => {
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
  it("restores the verified role before showing private content", async () => {
    useLumen.getState().setRole("Administrator");
    useDemoAuth.getState().signIn({ ...ROLE_USERS.Employee, role: "Employee" }, "Google Workspace");
    const container = await renderBoundary("Workspace content");
    expect(container.textContent).toContain("Workspace content");
    expect(useLumen.getState().role).toBe("Employee");
  });
  it("sends a signed-in external reviewer to the permitted library", async () => {
    routing.path = "/login";
    useDemoAuth
      .getState()
      .signIn(
        { ...ROLE_USERS["External Reviewer"], role: "External Reviewer" },
        "Email login link",
      );
    await renderBoundary("Login form");
    expect(routing.navigate).toHaveBeenCalledWith({ to: "/library", replace: true });
  });
});
