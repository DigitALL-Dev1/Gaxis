import { createFileRoute } from "@tanstack/react-router";
import { TeamCompletion } from "@/components/lumen/workflows";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/manage/team")({
  head: pageHead("Team Completion", "GREEN Limited knowledge and document access."),
  component: () => (
    <RoleGate need="team">
      <TeamCompletion />
    </RoleGate>
  ),
});
