import { createFileRoute } from "@tanstack/react-router";
import { DocumentLibrary } from "@/components/lumen/DocumentLibrary";
import { RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/library")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search["q"] === "string" ? { q: search["q"] } : {},
  head: pageHead("Document Library", "Browse permitted approved documents."),
  component: LibraryPage,
});
function LibraryPage() {
  const search = Route.useSearch();
  return (
    <RoleGate need="library">
      <DocumentLibrary initialQuery={search.q ?? ""} />
    </RoleGate>
  );
}
