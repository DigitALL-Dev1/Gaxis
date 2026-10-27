import { createFileRoute } from "@tanstack/react-router";
import { DocumentDetails } from "@/components/lumen/DocumentDetails";
import { PageHeader, Panel, RoleGate } from "@/components/lumen/common";
import { pageHead } from "@/lib/lumen/head";

export const Route = createFileRoute("/d/$id")({
  head: pageHead("Document Details", "Approved document metadata and version details."),
  component: DocumentRoute,
});
function DocumentRoute() {
  const { id } = Route.useParams();
  return (
    <RoleGate need="library">
      <PageHeader title="Document Details" />
      <Panel>
        <div className="p-6">
          <DocumentDetails key={id} documentId={id} />
        </div>
      </Panel>
    </RoleGate>
  );
}
