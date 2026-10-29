import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { toast } from "sonner";
import { PageHeader, Panel, StatusBadge } from "./common";
import { MediaPlayer } from "./MediaPlayer";
import {
  getMediaCaptions,
  getMediaProcessingStatus,
  getMediaTranscript,
  listMedia,
  requestMediaProcessing,
  reviewMediaCaptions,
  type MediaAsset,
  type MediaProcessingStatus,
} from "@/lib/lumen/media-api";
import { useUserAuth } from "@/lib/lumen/user-auth";

function durationLabel(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "External reference";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function humanStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function MediaLibrary() {
  const user = useUserAuth((state) => state.user);
  const canManage = !!user?.permissions.some((permission) =>
    ["documents.prepare", "documents.release"].includes(permission),
  );
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<MediaAsset | null>(null);
  const [processing, setProcessing] = useState<MediaAsset | null>(null);
  const [processingData, setProcessingData] = useState<MediaProcessingStatus | null>(null);
  const [processingLoading, setProcessingLoading] = useState(false);
  const [processingError, setProcessingError] = useState("");
  const [captionReview, setCaptionReview] = useState<MediaAsset | null>(null);
  const [webvtt, setWebvtt] = useState("WEBVTT\n\n");
  const [transcript, setTranscript] = useState("");
  const [captionError, setCaptionError] = useState("");
  const [captionNotice, setCaptionNotice] = useState("");
  const [captionSaving, setCaptionSaving] = useState(false);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMedia(await listMedia());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load media.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = media.filter((asset) =>
    `${asset.title} ${asset.original_file_name ?? ""} ${asset.media_type}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  async function showProcessing(asset: MediaAsset) {
    setProcessing(asset);
    setProcessingData(null);
    setProcessingError("");
    setProcessingLoading(true);
    try {
      setProcessingData(await getMediaProcessingStatus(asset._id));
    } catch (cause) {
      setProcessingError(
        cause instanceof Error ? cause.message : "Unable to load processing details.",
      );
    } finally {
      setProcessingLoading(false);
    }
  }

  async function retryProcessing(asset: MediaAsset) {
    setWorkingId(asset._id);
    setProcessingError("");
    try {
      await requestMediaProcessing(asset._id);
      toast.success("Media processing queued.");
      await refresh();
      await showProcessing(asset);
    } catch (cause) {
      setProcessingError(
        cause instanceof Error ? cause.message : "Unable to request media processing.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function submitCaptionReview() {
    if (!captionReview || captionSaving) return;
    setCaptionError("");
    if (!webvtt.trimStart().startsWith("WEBVTT") || !webvtt.includes("-->")) {
      setCaptionError("Enter corrected WebVTT content with at least one caption cue.");
      return;
    }
    if (!transcript.trim()) {
      setCaptionError("Enter the corrected transcript.");
      return;
    }
    setCaptionSaving(true);
    try {
      await reviewMediaCaptions(captionReview._id, {
        language_code: "en",
        webvtt,
        transcript,
        corrected: true,
      });
      toast.success("Human-reviewed captions and transcript saved.");
      setCaptionReview(null);
      setWebvtt("WEBVTT\n\n");
      setTranscript("");
    } catch (cause) {
      setCaptionError(cause instanceof Error ? cause.message : "Unable to save caption review.");
    } finally {
      setCaptionSaving(false);
    }
  }

  async function loadCaptionDraft() {
    if (!captionReview) return;
    setCaptionError("");
    setCaptionNotice("");
    setCaptionLoading(true);
    const [captionResult, transcriptResult] = await Promise.allSettled([
      getMediaCaptions(captionReview._id),
      getMediaTranscript(captionReview._id),
    ]);
    if (captionResult.status === "fulfilled") setWebvtt(captionResult.value.webvtt);
    if (transcriptResult.status === "fulfilled") setTranscript(transcriptResult.value);
    if (captionResult.status === "rejected" || transcriptResult.status === "rejected") {
      setCaptionNotice(
        "An existing draft was unavailable. You can still enter corrected captions and transcript manually.",
      );
    }
    setCaptionLoading(false);
  }

  return (
    <>
      <PageHeader
        crumb="Workspace / Media"
        title="Media Library"
        description="Browse permitted approved media. Playback progress is recorded for hosted media; external references do not create playback evidence."
      />
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          {filtered.length} media items
        </Text>
        <Group>
          <TextInput
            aria-label="Search media"
            placeholder="Search title or file name"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <Button
            variant="default"
            disabled={loading || !!playing || !!captionReview || !!processing}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </Group>
      </Group>
      {error && (
        <Alert color="red" role="alert" mb="md">
          {error}
        </Alert>
      )}
      {loading ? (
        <Group role="status">
          <Loader size="sm" />
          <Text>Loading permitted media…</Text>
        </Group>
      ) : (
        !error &&
        (filtered.length === 0 ? (
          <Panel>
            <Text p="xl" ta="center" c="dimmed">
              No permitted media matches your search.
            </Text>
          </Panel>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
            {filtered.map((asset) => (
              <Panel key={asset._id}>
                <Stack p="md" gap="sm">
                  <Group justify="space-between" align="start">
                    <div>
                      <Text fw={600}>{asset.title}</Text>
                      <Text size="sm" c="dimmed">
                        {asset.media_type} · {durationLabel(asset.duration_seconds)}
                      </Text>
                    </div>
                    <StatusBadge status={humanStatus(asset.processing_status)} />
                  </Group>
                  {asset.description && <Text size="sm">{asset.description}</Text>}
                  <Text size="xs" c="dimmed">
                    {asset.original_file_name ?? asset.external_url ?? "External media"} ·{" "}
                    {humanStatus(asset.licence_status)}
                  </Text>
                  {asset.link_health && (
                    <Text size="sm" c={asset.link_health === "HEALTHY" ? "green" : "orange"}>
                      External link: {humanStatus(asset.link_health)}
                    </Text>
                  )}
                  <Group>
                    <Button
                      disabled={
                        asset.licence_status !== "REFERENCE_ONLY" &&
                        asset.processing_status !== "COMPLETED"
                      }
                      onClick={() => setPlaying(asset)}
                    >
                      {asset.licence_status === "REFERENCE_ONLY" ? "Open reference" : "Play"}
                    </Button>
                    {canManage && (
                      <Button variant="default" onClick={() => void showProcessing(asset)}>
                        Processing
                      </Button>
                    )}
                    {canManage && asset.captions_required && (
                      <Button
                        variant="default"
                        onClick={() => {
                          setCaptionError("");
                          setCaptionNotice("");
                          setWebvtt("WEBVTT\n\n");
                          setTranscript("");
                          setCaptionReview(asset);
                        }}
                      >
                        Review captions
                      </Button>
                    )}
                  </Group>
                </Stack>
              </Panel>
            ))}
          </SimpleGrid>
        ))
      )}

      <Modal
        opened={playing !== null}
        onClose={() => setPlaying(null)}
        title={playing?.title ?? "Media playback"}
        size="xl"
        centered
      >
        {playing && <MediaPlayer key={playing._id} media={playing} />}
      </Modal>

      <Modal
        opened={processing !== null}
        onClose={() => {
          setProcessing(null);
          setProcessingData(null);
        }}
        title={`Processing · ${processing?.title ?? ""}`}
        size="lg"
        centered
      >
        <Stack>
          {processingError && (
            <Alert color="red" role="alert">
              {processingError}
            </Alert>
          )}
          {processingLoading ? (
            <Group role="status">
              <Loader size="sm" />
              <Text>Loading processing status…</Text>
            </Group>
          ) : processingData ? (
            <>
              <Text>Current status: {humanStatus(processingData.processing_status)}</Text>
              {processingData.human_caption_review_required && (
                <Text>Human caption and transcript review is required before release.</Text>
              )}
              {processingData.jobs.length === 0 ? (
                <Text c="dimmed">No processing jobs have been recorded.</Text>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Job</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Progress</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {processingData.jobs.map((job) => (
                      <Table.Tr key={job._id}>
                        <Table.Td>{job.job_type}</Table.Td>
                        <Table.Td>{humanStatus(job.status)}</Table.Td>
                        <Table.Td>
                          {Math.floor(job.progress_percentage)}%
                          {job.error_message && (
                            <Text size="xs" c="red">
                              {job.error_message}
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
              {processingData.processing_status === "FAILED" && processing && (
                <Button
                  loading={workingId === processing._id}
                  onClick={() => void retryProcessing(processing)}
                >
                  Retry processing
                </Button>
              )}
            </>
          ) : null}
        </Stack>
      </Modal>

      <Modal
        opened={captionReview !== null}
        onClose={() => setCaptionReview(null)}
        title={`Review captions · ${captionReview?.title ?? ""}`}
        size="xl"
        centered
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Correct the generated or supplied English WebVTT and transcript. Reviewed captions
            become immutable after release.
          </Text>
          {captionError && (
            <Alert color="red" role="alert">
              {captionError}
            </Alert>
          )}
          {captionNotice && (
            <Alert color="yellow" role="status">
              {captionNotice}
            </Alert>
          )}
          <Button
            variant="default"
            loading={captionLoading}
            disabled={captionLoading || captionSaving}
            onClick={() => void loadCaptionDraft()}
          >
            Load existing draft
          </Button>
          <Textarea
            label="WebVTT captions"
            description="Include WEBVTT and timestamp cues."
            value={webvtt}
            onChange={(event) => setWebvtt(event.currentTarget.value)}
            minRows={8}
            autosize
            disabled={captionSaving}
          />
          <Textarea
            label="Transcript"
            value={transcript}
            onChange={(event) => setTranscript(event.currentTarget.value)}
            minRows={8}
            autosize
            disabled={captionSaving}
          />
          <Button loading={captionSaving} onClick={() => void submitCaptionReview()}>
            Save human-reviewed captions
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
