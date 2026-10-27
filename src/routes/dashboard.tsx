import { useMemo, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, RoleGate } from "@/components/lumen/common";
import { DashboardOverview } from "@/components/lumen/DashboardOverview";
import { NAV } from "@/lib/lumen/navigation";
import { ADMIN_MODULES, type NavKey } from "@/lib/lumen/access";
import { canUseModule } from "@/lib/lumen/permissions";
import { displayRole, useUserAuth, type SignedInUser } from "@/lib/lumen/user-auth";
import { useAdminAuth } from "@/lib/lumen/admin-auth";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/dashboard")({
  head: pageHead("Dashboard", "Your documents, pending reviews and administration workspace."),
  component: () => (
    <RoleGate need="dashboard">
      <Dashboard />
    </RoleGate>
  ),
});

function WorkspaceLinks({ modules }: { modules: readonly NavKey[] }) {
  return (
    <Panel title="Your workspace">
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {NAV.filter((item) => item.key !== "dashboard" && modules.includes(item.key)).map(
          (item) => (
            <Button key={item.to} asChild variant="outline" className="justify-start">
              <Link to={item.to}>
                <item.icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          ),
        )}
      </div>
    </Panel>
  );
}

export function UserDashboard({ user, children }: { user: SignedInUser; children?: ReactNode }) {
  const modules = NAV.filter((item) => canUseModule(user.permissions, item.key)).map(
    (item) => item.key,
  );
  return (
    <>
      <PageHeader
        crumb="Dashboard"
        title={`Welcome, ${user.full_name}`}
        description={displayRole(user)}
      />
      {children}
      <WorkspaceLinks modules={modules} />
    </>
  );
}

function Dashboard() {
  const admin = useAdminAuth((state) => state.admin);
  const user = useUserAuth((state) => state.user);
  const modules = useMemo(
    () =>
      admin
        ? ADMIN_MODULES
        : NAV.filter((item) => user && canUseModule(user.permissions, item.key)).map(
            (item) => item.key,
          ),
    [admin, user],
  );
  if (user && !admin)
    return (
      <UserDashboard user={user}>
        <DashboardOverview modules={modules} />
      </UserDashboard>
    );
  return (
    <>
      <PageHeader
        crumb="Dashboard"
        title={`Welcome, ${admin?.name ?? "Administrator"}`}
        description="Your documents, reviews and administration workspace."
      />
      <DashboardOverview modules={modules} />
      <WorkspaceLinks modules={modules} />
    </>
  );
}
