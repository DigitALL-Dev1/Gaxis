import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Group, Loader, Modal, Stack, Table, Text, Textarea } from "@mantine/core";
import { toast } from "sonner";
import { PageHeader, Panel } from "./common";
import { DocumentStatus } from "./DocumentDetails";
import { DocumentFilePreview } from "./DocumentFilePreview";
import {
  getReleaseQueue,
  getReviewDetails,
  releaseDocumentVersion,
  returnDocumentVersion,
  type QueueEntry,
  type ReviewDetails,
} from "@/lib/lumen/documents-api";

export function ReleaseQueue() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<ReviewDetails | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [comments, setComments] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const reviewRequest = useRef(0);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEntries(await getReleaseQueue());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the release queue.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function openReview(id: string) {
    const requestId = ++reviewRequest.current;
    setSelected(id);
    setDetails(null);
    setComments("");
    setReviewError("");
    setReviewLoading(true);
    try {
      const result = await getReviewDetails(id);
      if (reviewRequest.current === requestId) setDetails(result);
    } catch (cause) {
      if (reviewRequest.current === requestId)
        setReviewError(cause instanceof Error ? cause.message : "Unable to load this review.");
    } finally {
      if (reviewRequest.current === requestId) setReviewLoading(false);
    }
  }
  async function decide(release: boolean) {
    if (!details || busy) return;
    if (!release && !comments.trim()) {
      setReviewError("Review comments are required when returning a document for correction.");
      return;
    }
    setBusy(true);
    setReviewError("");
    try {
      await (release ? releaseDocumentVersion : returnDocumentVersion)(
        details.version._id,
        comments.trim(),
      );
      toast.success(
        release ? "Document approved and released." : "Document returned for correction.",
      );
      setConfirm(false);
      setSelected(null);
      setDetails(null);
      await refresh();
    } catch (cause) {
      setConfirm(false);
      setReviewError(cause instanceof Error ? cause.message : "Unable to save this decision.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        crumb="Publishing / Release"
        title="Release Queue"
        description="Review documents assigned to your families before independent publication."
      />
      <Group justify="space-between" mb="md">
        <Text>{entries.length} pending versions</Text>
        <Button variant="default" disabled={loading || !!selected} onClick={() => void refresh()}>
          Refresh
        </Button>
      </Group>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      {loading ? (
        <Loader aria-label="Loading release queue" />
      ) : (
        !error && (
          <Panel>
            {entries.length === 0 ? (
              <Text p="xl">No documents are awaiting review.</Text>
            ) : (
              <Table.ScrollContainer minWidth={950}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      {[
                        "Document Title",
                        "Reference",
                        "Version",
                        "Family",
                        "Prepared By",
                        "Submitted Date",
                        "Status",
                        "Actions",
                      ].map((label) => (
                        <Table.Th key={label}>{label}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {entries.map(({ document, version }) => (
                      <Table.Tr key={version._id}>
                        <Table.Td>{document.title}</Table.Td>
                        <Table.Td>{document.reference}</Table.Td>
                        <Table.Td>{version.version_number}</Table.Td>
                        <Table.Td>{document.family_name}</Table.Td>
                        <Table.Td>{version.preparer_name || document.owner_name}</Table.Td>
                        <Table.Td>{new Date(version.prepared_at).toLocaleString()}</Table.Td>
                        <Table.Td>
                          <DocumentStatus status={version.status} />
                        </Table.Td>
                        <Table.Td>
                          <Button size="xs" onClick={() => void openReview(version._id)}>
                            Review
                          </Button>
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
        opened={selected !== null}
        onClose={() => {
          if (!busy) {
            ++reviewRequest.current;
            setSelected(null);
          }
        }}
        title="Document review"
        size="xl"
        closeOnClickOutside={false}
        closeOnEscape={!busy}
        withCloseButton={!busy}
      >
        <Stack>
          {reviewLoading && <Loader aria-label="Loading review details" />}
          {reviewError && (
            <Alert color="red" role="alert">
              {reviewError}
            </Alert>
          )}
          {!reviewLoading && !details && selected && (
            <Button onClick={() => void openReview(selected)}>Retry review</Button>
          )}
          {details && (
            <>
              <Text fw={600} size="lg">
                {details.document.title}
              </Text>
              <Text>
                {details.document.reference} · Version {details.version.version_number}
              </Text>
              <DocumentStatus status={details.version.status} />
              <Text>Document Owner: {details.document.owner_name}</Text>
              <Text>Prepared By: {details.preparer_name}</Text>
              <Text>
                Family: {details.document.family_name} · Classification:{" "}
                {details.document.classification}
              </Text>
              <Text>
                Reader classes:{" "}
                {details.document.reader_classes?.map((reader) => reader.class_name).join(", ") ||
                  "Not specified"}
              </Text>
              <Text>Change summary: {details.version.change_summary || "Initial issue"}</Text>
              {details.self_review_override && (
                <Alert color="orange">
                  You are reviewing your own document as Administrator. This decision will be
                  recorded as an Admin override.
                </Alert>
              )}
              <DocumentFilePreview version={details.version} />
              <Textarea
                label="Review comments"
                value={comments}
                maxLength={10000}
                onChange={(event) => setComments(event.currentTarget.value)}
                disabled={busy}
                description="Required when returning a document for correction."
                minRows={3}
              />
              {!details.can_release && !details.can_return && (
                <Alert>
                  Approval is unavailable for this version. An eligible administrator or assigned
                  reviewer must review it.
                </Alert>
              )}
              <Group>
                <Button disabled={busy || !details.can_release} onClick={() => setConfirm(true)}>
                  Approve &amp; Release
                </Button>
                <Button
                  color="orange"
                  variant="outline"
                  disabled={busy || !details.can_return}
                  loading={busy && !confirm}
                  onClick={() => void decide(false)}
                >
                  Return for Correction
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
      <Modal
        opened={confirm}
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
        title="Confirm approval"
        centered
        closeOnClickOutside={false}
        closeOnEscape={!busy}
        withCloseButton={!busy}
      >
        <Stack>
          <Text>
            {details?.self_review_override && <>This decision uses the Administrator override. </>}
            Release version {details?.version.version_number} of {details?.document.title}? It will
            become the current published version and replace the previous approved version.
          </Text>
          <Group>
            <Button variant="default" disabled={busy} onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void decide(true)}>
              Confirm &amp; Release
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
