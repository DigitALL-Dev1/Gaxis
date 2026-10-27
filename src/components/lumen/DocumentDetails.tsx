import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Group, Loader, Modal, Stack, Table, Text } from "@mantine/core";
import {
  documentStatus,
  getDocument,
  getDocumentVersion,
  listDocumentVersions,
  getDocumentReviews,
  type DocumentReview,
  type ApiDocument,
  type ApiDocumentVersion,
} from "@/lib/lumen/documents-api";
import { DocumentFilePreview } from "./DocumentFilePreview";

export function DocumentStatus({ status }: { status: string }) {
  return (
    <Badge
      color={
        status === "UNDER_REVIEW"
          ? "yellow"
          : status === "RETURNED_FOR_CORRECTION"
            ? "orange"
            : ["APPROVED_CURRENT", "RELEASED"].includes(status)
              ? "green"
              : "gray"
      }
    >
      {documentStatus(status)}
    </Badge>
  );
}

export function DocumentDetails({ documentId }: { documentId: string }) {
  const [document, setDocument] = useState<ApiDocument | null>(null);
  const [versions, setVersions] = useState<ApiDocumentVersion[]>([]);
  const [version, setVersion] = useState<ApiDocumentVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versionError, setVersionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviews, setReviews] = useState<DocumentReview[]>([]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [record, history] = await Promise.all([
        getDocument(documentId),
        listDocumentVersions(documentId),
      ]);
      setDocument(record);
      setVersions(history);
      setReviews(record.can_view_reviews ? await getDocumentReviews(documentId) : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load document details.");
    } finally {
      setLoading(false);
    }
  }, [documentId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <Stack>
      <Group justify="flex-end">
        <Button variant="default" disabled={loading || busy} onClick={() => void refresh()}>
          Refresh details
        </Button>
      </Group>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      {loading ? (
        <Group role="status">
          <Loader size="sm" />
          <Text>Loading document details…</Text>
        </Group>
      ) : (
        !error &&
        document && (
          <>
            <Text fw={600} size="lg">
              {document.title}
            </Text>
            <Text>
              <strong>Reference:</strong> {document.reference}
            </Text>
            <Text>
              <strong>Family:</strong> {document.family_name}
            </Text>
            <Text>
              <strong>Document Owner:</strong> {document.owner_name}
            </Text>
            <Text>
              <strong>Classification:</strong> {document.classification}
            </Text>
            <Text>
              <strong>Reader classes:</strong>{" "}
              {document.reader_classes?.map((reader) => reader.class_name).join(", ") ||
                "Not specified"}
            </Text>
            <Text>
              <strong>Acknowledgement:</strong>{" "}
              {document.acknowledgement_required ? "Required" : "Not required"}
            </Text>
            <Text fw={600}>Current approved version</Text>
            {document.current_approved_version ? (
              <Group>
                <Text>v{document.current_approved_version.version_number}</Text>
                <DocumentStatus status={document.current_approved_version.status} />
                <Text size="sm">
                  Released by{" "}
                  {document.current_approved_version.releaser_name ||
                    document.current_approved_version.released_by}{" "}
                  on{" "}
                  {document.current_approved_version.released_at
                    ? new Date(document.current_approved_version.released_at).toLocaleString()
                    : "Unknown date"}
                </Text>
              </Group>
            ) : (
              <Text c="dimmed">No approved version yet.</Text>
            )}
            {reviews.length > 0 && (
              <>
                <Text fw={600}>Approval history</Text>
                {reviews.map((review) => (
                  <Stack key={review.version_id} gap={4}>
                    <Text>
                      Version {review.version_number}:{" "}
                      {review.decision === "RELEASED"
                        ? "Approved & Current at release"
                        : "Returned for Correction"}
                    </Text>
                    <Text size="sm">
                      {review.reviewer_name} · {new Date(review.reviewed_at).toLocaleString()}
                    </Text>
                    {review.self_review_override && (
                      <Text size="sm" c="orange">
                        Admin override
                      </Text>
                    )}
                    <Text>{review.review_comments || "No review comments."}</Text>
                  </Stack>
                ))}
              </>
            )}
            {document.pending_versions.length > 0 && (
              <>
                <Text fw={600}>Pending review</Text>
                {document.pending_versions.map((entry) => (
                  <Group key={entry._id}>
                    <Text>v{entry.version_number}</Text>
                    <DocumentStatus status={entry.status} />
                    <Text size="sm">{entry.change_summary}</Text>
                  </Group>
                ))}
              </>
            )}
            <Text fw={600}>Document versions</Text>
            {versionError && (
              <Alert color="red" role="alert">
                {versionError}
              </Alert>
            )}
            <Table.ScrollContainer minWidth={600}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    {["Version", "Status", "File", "Prepared", "Actions"].map((label) => (
                      <Table.Th key={label}>{label}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {versions.map((entry) => (
                    <Table.Tr key={entry._id}>
                      <Table.Td>{entry.version_number}</Table.Td>
                      <Table.Td>
                        <DocumentStatus status={entry.status} />
                      </Table.Td>
                      <Table.Td>{entry.file_name}</Table.Td>
                      <Table.Td>{new Date(entry.prepared_at).toLocaleString()}</Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="subtle"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setVersionError("");
                            try {
                              setVersion(await getDocumentVersion(entry._id));
                            } catch (cause) {
                              setVersionError(
                                cause instanceof Error
                                  ? cause.message
                                  : "Unable to load this version.",
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          View version
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </>
        )
      )}
      <Modal
        opened={version !== null}
        onClose={() => setVersion(null)}
        title="Version details"
        centered
        size="lg"
      >
        {version && (
          <Stack gap="sm">
            <Text fw={600}>Version {version.version_number}</Text>
            <DocumentStatus status={version.status} />
            <Text>
              <strong>File:</strong> {version.file_name}
            </Text>
            <Text>
              <strong>Size:</strong> {(version.file_size / (1024 * 1024)).toFixed(2)} MB
            </Text>
            <Text>
              <strong>Change summary:</strong> {version.change_summary || "Initial issue"}
            </Text>
            {version.review && (
              <Alert
                color={version.review.decision === "RETURNED" ? "orange" : "green"}
                title={`Review by ${version.review.reviewer_name}`}
              >
                {version.review.review_comments || "Approved without comments."}
              </Alert>
            )}
            <DocumentFilePreview version={version} />
            <Text size="xs" style={{ overflowWrap: "anywhere" }}>
              <strong>SHA-256:</strong> {version.checksum_sha256}
            </Text>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
