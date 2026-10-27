import { createFileRoute } from "@tanstack/react-router";
import { DocumentFamiliesManagement } from "@/components/lumen/DocumentFamiliesManagement";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/admin/families")({
  head: pageHead("Document Families", "GREEN Limited knowledge and document access."),
  component: () => (
    <RoleGate need="families">
      <DocumentFamiliesManagement />
    </RoleGate>
  ),
});
