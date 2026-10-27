import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAdminAuth } from "@/lib/lumen/admin-auth";
import { useUserAuth } from "@/lib/lumen/user-auth";
import { AppShell } from "./AppShell";
import { LoadingState } from "./common";

export function AuthBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const admin = useAdminAuth((s) => s.admin);
  const user = useUserAuth((s) => s.user);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const loginPage = path === "/login";
  const verificationPage = path === "/verify-login";
  const publicPage = loginPage || verificationPage;
  useEffect(() => {
    if (verificationPage) {
      setReady(true);
      return;
    }
    let active = true;
    void useUserAuth
      .getState()
      .restore()
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [verificationPage]);
  useEffect(() => {
    if (!ready) return;
    if (!admin && !user && !publicPage) void navigate({ to: "/login", replace: true });
    if ((admin || user) && loginPage)
      void navigate({
        to: "/dashboard",
        replace: true,
      });
  }, [ready, admin, user, publicPage, loginPage, navigate]);
  if (!ready || (!admin && !user && !publicPage) || ((admin || user) && loginPage))
    return (
      <div
        className="grid min-h-screen place-items-center bg-background"
        role="status"
        aria-label="Loading workspace"
      >
        <LoadingState />
      </div>
    );
  if (publicPage) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
