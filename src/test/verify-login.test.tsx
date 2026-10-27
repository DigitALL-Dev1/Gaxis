import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyLoginPage } from "@/components/lumen/VerifyLoginPage";
import { useUserAuth } from "@/lib/lumen/user-auth";

const routing = vi.hoisted(() => ({ token: "secret" as string | undefined, navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => routing.navigate,
}));
const fetchMock = vi.fn();
beforeEach(() => {
  useUserAuth.getState().clearLocalSession();
  routing.token = "secret";
  routing.navigate.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({
      user_id: "user",
      full_name: "Zain Israr",
      email: "zain@example.com",
      status: "active",
      roles: [{ code: "MANAGER", name: "Manager" }],
      reader_class: { code: "EMPLOYEE", name: "Employee" },
      permissions: ["documents.read", "team.progress.read"],
    }),
  });
  window.history.replaceState(null, "", "/verify-login?token=secret");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Login link callback", () => {
  const callback = () => (
    <MantineProvider env="test">
      <VerifyLoginPage token={routing.token} />
    </MantineProvider>
  );

  it("reads the fragment token used by emailed links", async () => {
    routing.token = undefined;
    window.history.replaceState({ key: "callback" }, "", "/verify-login#token=email-secret");
    render(callback());
    await waitFor(() => expect(routing.navigate).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ token: "email-secret" });
    expect(window.location.hash).toBe("");
    expect(window.history.state).toEqual({ key: "callback" });
  });

  it("resumes verification if the callback remounts after the URL token was removed", async () => {
    routing.token = undefined;
    window.history.replaceState(null, "", "/verify-login#token=remount-secret");
    let finish!: () => void;
    const response = await fetchMock.getMockImplementation()!();
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(response);
        }),
    );
    const first = render(callback());
    expect(window.location.hash).toBe("");
    first.unmount();
    render(callback());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    finish();
    await waitFor(() =>
      expect(routing.navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("restores the cookie session when the cleaned callback is reloaded", async () => {
    routing.token = undefined;
    window.history.replaceState(null, "", "/verify-login");
    render(callback());
    await waitFor(() =>
      expect(routing.navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true }),
    );
    expect(fetchMock.mock.calls[0]![0]).toContain("/api/v1/auth/me");
  });

  it("shows missing-link guidance only when no token or authenticated session exists", async () => {
    routing.token = undefined;
    window.history.replaceState(null, "", "/verify-login");
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Not authenticated" }),
    });
    render(callback());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Open the complete link from your email",
    );
    expect(routing.navigate).not.toHaveBeenCalled();
  });

  it("verifies once under StrictMode, removes the URL secret and opens the dashboard", async () => {
    render(
      <StrictMode>
        <MantineProvider env="test">
          <VerifyLoginPage token={routing.token} />
        </MantineProvider>
      </StrictMode>,
    );
    await waitFor(() =>
      expect(routing.navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("");
    expect(useUserAuth.getState().user?.full_name).toBe("Zain Israr");
  });

  it("shows expired-link errors without entering the workspace", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: "This sign-in link has expired" }),
    });
    render(
      <MantineProvider env="test">
        <VerifyLoginPage token={routing.token} />
      </MantineProvider>,
    );
    expect(await screen.findByText("This sign-in link has expired")).toBeInTheDocument();
    expect(routing.navigate).not.toHaveBeenCalled();
    expect(useUserAuth.getState().user).toBeNull();
  });
});
