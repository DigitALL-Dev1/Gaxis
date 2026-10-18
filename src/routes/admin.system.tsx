import { createFileRoute } from "@tanstack/react-router";
import { Administration } from "@/components/lumen/workflows";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/admin/system")({
  head: pageHead("Administration", "GREEN Limited knowledge and document access."),
  component: () => (
    <RoleGate need="system">
      <Administration />
    </RoleGate>
  ),
});
