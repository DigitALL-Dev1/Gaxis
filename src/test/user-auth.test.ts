import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserAuth } from "@/lib/lumen/user-auth";

const profile = {
  user_id: "507f1f77bcf86cd799439011",
  full_name: "Zain Israr",
  email: "zain@example.com",
  status: "active",
  roles: [{ code: "MANAGER", name: "Manager" }],
  reader_class: { code: "EMPLOYEE", name: "Employee" },
  permissions: ["documents.read", "team.progress.read"],
};
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  useUserAuth.getState().clearLocalSession();
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("User cookie session", () => {
  it("requests an email link using the actual backend endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ message: "Check your email" }) });
    expect(await useUserAuth.getState().requestLink(" ZAIN@example.com ")).toBe("Check your email");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/auth/request-login-link"),
      {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "zain@example.com" }),
      },
    );
  });

  it("verifies with POST, normalizes the actual response and derives modules from permissions", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => profile });
    const user = await useUserAuth.getState().verifyToken("secret");
    expect(user.full_name).toBe("Zain Israr");
    expect(user.modules.sort()).toEqual(["dashboard", "profile", "library"].sort());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/verify-login-token"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ token: "secret" }),
      }),
    );
    expect(localStorage.getItem("lumen_user")).toBeNull();
  });

  it("deduplicates verification so React effects cannot consume the token twice", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => profile });
    const first = useUserAuth.getState().verifyToken("same-secret");
    const second = useUserAuth.getState().verifyToken("same-secret");
    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores forged local storage and refreshes current server permissions on reload", async () => {
    localStorage.setItem("lumen_user", JSON.stringify({ permissions: ["roles.manage"] }));
    fetchMock.mockResolvedValue({ ok: true, json: async () => profile });
    await useUserAuth.getState().restore();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/auth/me"), {
      credentials: "include",
      cache: "no-store",
    });
    expect(useUserAuth.getState().user?.permissions).toEqual(profile.permissions);
    expect(localStorage.getItem("lumen_user")).toBeNull();
  });

  it("clears expired sessions and rejects invalid login links", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Expired login link" }),
    });
    await expect(useUserAuth.getState().verifyToken("expired")).rejects.toThrow(
      "Expired login link",
    );
    await useUserAuth.getState().restore();
    expect(useUserAuth.getState().user).toBeNull();
  });

  it("revokes the server session before clearing local identity", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => profile });
    await useUserAuth.getState().verifyToken("secret");
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ detail: "Logout failed" }) });
    await expect(useUserAuth.getState().signOut()).rejects.toThrow("Logout failed");
    expect(useUserAuth.getState().user).not.toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ message: "Signed out" }) });
    await useUserAuth.getState().signOut();
    expect(useUserAuth.getState().user).toBeNull();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});
