import { createFileRoute } from "@tanstack/react-router";
import { PrepareDocument } from "@/components/lumen/DocumentPreparation";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/admin/prepare")({
  head: pageHead("Prepare Document", "GREEN Limited knowledge and document access."),
  component: () => (
    <RoleGate need="prepare">
      <PrepareDocument />
    </RoleGate>
  ),
});
