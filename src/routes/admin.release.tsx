import { createFileRoute } from "@tanstack/react-router";
import { ReleaseQueue } from "@/components/lumen/ReleaseQueue";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/admin/release")({
  head: pageHead("Release Queue", "GREEN Limited knowledge and document access."),
  component: () => (
    <RoleGate need="release">
      <ReleaseQueue />
    </RoleGate>
  ),
});
