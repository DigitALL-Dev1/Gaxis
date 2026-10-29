import { createFileRoute } from "@tanstack/react-router";
import { MediaPreparation } from "@/components/lumen/MediaPreparation";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/admin/media/prepare")({
  head: pageHead("Prepare Media", "Submit video and audio for controlled review."),
  component: () => (
    <RoleGate need="mediaPrepare">
      <MediaPreparation />
    </RoleGate>
  ),
});
