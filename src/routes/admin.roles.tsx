import { createFileRoute } from "@tanstack/react-router";
import { RolesManagement } from "@/components/lumen/RolesManagement";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/admin/roles")({
  head: pageHead("Roles Management", "Manage user roles and permissions."),
  component: () => (
    <RoleGate need="roles">
      <RolesManagement />
    </RoleGate>
  ),
});
