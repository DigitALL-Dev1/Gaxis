import { createFileRoute } from "@tanstack/react-router";
import { ReaderClassesManagement } from "@/components/lumen/ReaderClassesManagement";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/admin/reader-classes")({
  head: pageHead("Reader Classes Management", "Manage reader eligibility and expiry rules."),
  component: () => (
    <RoleGate need="readerClasses">
      <ReaderClassesManagement />
    </RoleGate>
  ),
});
