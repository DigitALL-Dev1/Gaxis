import { createFileRoute } from "@tanstack/react-router";
import { ExternalAccess } from "@/components/lumen/workflows";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/admin/grants")({
  head: pageHead("External Access", "GREEN Limited knowledge and document access."),
  component: () => (
    <RoleGate need="grants">
      <ExternalAccess />
    </RoleGate>
  ),
});
