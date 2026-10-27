import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Group, Loader, Modal, Stack, Table, Text } from "@mantine/core";
import { PageHeader, Panel } from "./common";
import { DocumentDetails, DocumentStatus } from "./DocumentDetails";
import { DocumentUploadForm } from "./DocumentPreparation";
import {
  listMyPreparedDocuments,
  listReviewQueue,
  type ApiDocument,
} from "@/lib/lumen/documents-api";
import { useUserAuth } from "@/lib/lumen/user-auth";
import { useAdminAuth } from "@/lib/lumen/admin-auth";

function DocumentWorkList({ review = false }: { review?: boolean }) {
  const user = useUserAuth((state) => state.user);
  const admin = useAdminAuth((state) => state.admin);
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewed, setViewed] = useState<string | null>(null);
  const [revision, setRevision] = useState<ApiDocument | null>(null);
  const [revisionBusy, setRevisionBusy] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDocuments(await (review ? listReviewQueue() : listMyPreparedDocuments()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load documents.");
    } finally {
      setLoading(false);
    }
  }, [review]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <>
      <PageHeader
        crumb={review ? "Publishing / Release" : "Publishing / My documents"}
        title={review ? "Release Queue" : "My Prepared Documents"}
        description={
          review
            ? "Documents submitted for independent review."
            : "Your submitted versions and the current approved versions."
        }
      />
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          {documents.length} documents
        </Text>
        <Button
          variant="default"
          disabled={loading || !!viewed || !!revision}
          onClick={() => void refresh()}
        >
          Refresh
        </Button>
      </Group>
      {error && (
        <Alert color="red" role="alert" mb="md">
          {error}
        </Alert>
      )}
      {loading ? (
        <Group role="status">
          <Loader size="sm" />
          <Text>Loading documents…</Text>
        </Group>
      ) : (
        !error && (
          <Panel>
            {documents.length === 0 ? (
              <Text p="xl" ta="center" c="dimmed">
                {review ? "No documents are awaiting review." : "No prepared documents yet."}
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={900}>
                <Table verticalSpacing="md">
                  <Table.Thead>
                    <Table.Tr>
                      {[
                        "Title",
                        "Reference",
                        "Family",
                        "Latest submitted version",
                        "Current approved version",
                        "Actions",
                      ].map((label) => (
                        <Table.Th key={label}>{label}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {documents.map((document) => (
                      <Table.Tr key={document._id}>
                        <Table.Td>{document.title}</Table.Td>
                        <Table.Td>{document.reference}</Table.Td>
                        <Table.Td>{document.family_name}</Table.Td>
                        <Table.Td>
                          {document.latest_version && (
                            <Stack gap={4}>
                              <Text size="sm">v{document.latest_version.version_number}</Text>
                              <DocumentStatus status={document.latest_version.status} />
                              {document.latest_version.review?.review_comments && (
                                <Text size="sm">
                                  {document.latest_version.review.review_comments}
                                </Text>
                              )}
                            </Stack>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {document.current_approved_version
                            ? `v${document.current_approved_version.version_number}`
                            : "Not approved yet"}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Button
                              size="xs"
                              variant="subtle"
                              onClick={() => setViewed(document._id)}
                            >
                              View preparation details
                            </Button>
                            {!review &&
                              document.can_prepare_revision &&
                              (admin || user?.permissions.includes("documents.submit")) && (
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() =>
                                    setRevision({
                                      ...document,
                                      ...document.latest_version?.proposed_metadata,
                                    })
                                  }
                                >
                                  {document.latest_version?.status === "RETURNED_FOR_CORRECTION"
                                    ? "Correct and resubmit"
                                    : "Upload revised version"}
                                </Button>
                              )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Panel>
        )
      )}
      <Modal
        opened={viewed !== null}
        onClose={() => setViewed(null)}
        title="Document details"
        size="xl"
        centered
      >
        {viewed && <DocumentDetails key={viewed} documentId={viewed} />}
      </Modal>
      <Modal
        opened={revision !== null}
        onClose={() => {
          if (!revisionBusy) setRevision(null);
        }}
        title="Upload revised version"
        size="lg"
        centered
        closeOnClickOutside={false}
        closeOnEscape={!revisionBusy}
        withCloseButton={!revisionBusy}
      >
        {revision && (
          <DocumentUploadForm
            key={revision._id}
            document={revision}
            onBusyChange={setRevisionBusy}
            onSaved={() => {
              setRevision(null);
              void refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}
export function MyPreparedDocuments() {
  return <DocumentWorkList />;
}
export { ReleaseQueue } from "./ReleaseQueue";
