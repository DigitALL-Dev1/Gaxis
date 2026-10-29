import { createFileRoute } from "@tanstack/react-router";
import { MediaLibrary } from "@/components/lumen/MediaLibrary";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/media")({
  head: pageHead("Media Library", "Browse and play permitted training media."),
  component: () => (
    <RoleGate need="media">
      <MediaLibrary />
    </RoleGate>
  ),
});
