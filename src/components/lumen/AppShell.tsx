import { canUseModule } from "@/lib/lumen/permissions";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Search, Menu, ChevronDown, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_MODULES } from "@/lib/lumen/access";
import { NAV } from "@/lib/lumen/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAdminAuth } from "@/lib/lumen/admin-auth";
import { displayRole, useUserAuth } from "@/lib/lumen/user-auth";

function initials(n: string) {
  return n
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const admin = useAdminAuth((s) => s.admin);
  const signedInUser = useUserAuth((s) => s.user);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV.filter((n) =>
    admin
      ? ADMIN_MODULES.includes(n.key)
      : signedInUser
        ? canUseModule(signedInUser.permissions, n.key)
        : false,
  );
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="bg-brand grid size-10 place-items-center rounded-xl text-sm font-bold text-primary-foreground">
          G
        </div>
        <div className="leading-tight">
          <div className="text-[11px] font-semibold tracking-[0.2em] text-primary">
            GREEN · GAXIS
          </div>
          <div className="text-base font-semibold">Lumen</div>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <div key={g}>
            <div className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {g}
            </div>
            {items
              .filter((i) => i.group === g)
              .map((i) => {
                const active =
                  path === i.to ||
                  path.startsWith(i.to + "/") ||
                  (i.key === "library" && path.startsWith("/d/"));
                return (
                  <Link
                    key={i.to}
                    to={i.to}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-muted",
                    )}
                  >
                    <i.icon className="size-4" />
                    <span className="flex-1">{i.label}</span>
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const admin = useAdminAuth((s) => s.admin);
  const signedInUser = useUserAuth((s) => s.user);
  const user = admin
    ? { name: admin.name, email: admin.email }
    : signedInUser
      ? { name: signedInUser.full_name, email: signedInUser.email }
      : { name: "", email: "" };
  const roleLabel = admin ? "System Administrator" : signedInUser ? displayRole(signedInUser) : "";

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar lg:block">
        <SidebarNav />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </Button>
          {(admin || (signedInUser && canUseModule(signedInUser.permissions, "library"))) && (
            <form
              className="relative max-w-md flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ to: "/library", search: { q } });
              }}
            >
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search documents by title or reference…"
                className="h-10 bg-muted/60 pl-9"
              />
            </form>
          )}
          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                  <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                    {initials(user.name)}
                  </span>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block text-sm font-medium">{user.name}</span>
                    <span className="block text-xs text-muted-foreground">{roleLabel}</span>
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      if (admin) useAdminAuth.getState().signOut();
                      else await useUserAuth.getState().signOut();
                      await navigate({ to: "/login", replace: true });
                    } catch {
                      toast.error("Could not sign out on the server. Please try again.");
                    }
                  }}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
