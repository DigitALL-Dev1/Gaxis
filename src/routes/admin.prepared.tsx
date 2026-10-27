import { createFileRoute } from "@tanstack/react-router";
import { MyPreparedDocuments } from "@/components/lumen/PreparedDocuments";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/admin/prepared")({
  head: pageHead("My Prepared Documents", "Your document submissions and version history."),
  component: () => (
    <RoleGate need="prepared">
      <MyPreparedDocuments />
    </RoleGate>
  ),
});
