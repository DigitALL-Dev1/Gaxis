import { createFileRoute } from "@tanstack/react-router";
import { MediaLibrary } from "@/components/lumen/workflows";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/media")({
  head: pageHead("Media Library", "GREEN Limited knowledge and document access."),
  component: () => (
    <RoleGate need="media">
      <MediaLibrary />
    </RoleGate>
  ),
});
