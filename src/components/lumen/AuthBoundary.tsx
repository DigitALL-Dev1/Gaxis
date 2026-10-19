import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useDemoAuth } from "@/lib/lumen/auth";
import { useLumen } from "@/lib/lumen/store";
import { AppShell } from "./AppShell";
import { LoadingState } from "./common";

export function AuthBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const session = useDemoAuth((s) => s.session);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const publicPage = path === "/login";
  useEffect(() => {
    let active = true;
    void Promise.all([useLumen.persist.rehydrate(), useDemoAuth.persist.rehydrate()]).then(() => {
      const saved = useDemoAuth.getState().session;
      if (saved) useLumen.getState().setRole(saved.role);
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    if (!session && !publicPage) void navigate({ to: "/login", replace: true });
    if (session && publicPage)
      void navigate({
        to: session.role === "External Reviewer" ? "/library" : "/dashboard",
        replace: true,
      });
  }, [ready, session, publicPage, navigate]);
  if (!ready || (!session && !publicPage) || (session && publicPage))
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
