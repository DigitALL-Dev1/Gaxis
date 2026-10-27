import { createFileRoute } from "@tanstack/react-router";
import { AccessGrantsManagement } from "@/components/lumen/AccessGrantsManagement";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/admin/grants")({
  head: pageHead("Access Grants", "GREEN Limited knowledge and document access."),
  component: () => (
    <RoleGate need="grants">
      <AccessGrantsManagement />
    </RoleGate>
  ),
});
