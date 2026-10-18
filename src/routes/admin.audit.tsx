import { createFileRoute } from "@tanstack/react-router";
import { AuditLogs } from "@/components/lumen/workflows";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/admin/audit")({
  head: pageHead("Audit Logs", "GREEN Limited knowledge and document access."),
  component: () => (
    <RoleGate need="audit">
      <AuditLogs />
    </RoleGate>
  ),
});
