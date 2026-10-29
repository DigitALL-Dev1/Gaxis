import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Group, Loader, Select, Stack, Text, Textarea } from "@mantine/core";
import {
  closeMediaPlayback,
  getMediaCaptions,
  getMediaRenditions,
  getMediaTranscript,
  mediaStreamUrl,
  reportMediaProgress,
  startMediaPlayback,
  type MediaAsset,
  type MediaPlaybackSession,
  type MediaRenditions,
} from "@/lib/lumen/media-api";

function formatTime(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function MediaPlayer({ media }: { media: MediaAsset }) {
  const playerRef = useRef<HTMLMediaElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const positionRef = useRef(0);
  const progressTask = useRef<Promise<MediaPlaybackSession | null> | null>(null);
  const ended = useRef(false);
  const [renditions, setRenditions] = useState<MediaRenditions | null>(null);
  const [session, setSession] = useState<MediaPlaybackSession | null>(null);
  const [quality, setQuality] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [captionUrl, setCaptionUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  const syncProgress = useCallback(
    async (event: "PLAY" | "HEARTBEAT" | "PAUSE" | "SEEK" | "ENDED") => {
      if (progressTask.current) await progressTask.current;
      const sessionId = sessionIdRef.current;
      if (!sessionId) return null;
      const task = reportMediaProgress(sessionId, playerRef.current?.currentTime ?? 0, event)
        .then((result) => {
          setSession(result);
          return result;
        })
        .catch((cause) => {
          setError(cause instanceof Error ? cause.message : "Unable to save playback progress.");
          setPlaying(false);
          return null;
        });
      progressTask.current = task;
      const result = await task;
      if (progressTask.current === task) progressTask.current = null;
      return result;
    },
    [],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setRenditions(null);
    setSession(null);
    setCaptionUrl(null);
    setTranscript(null);
    sessionIdRef.current = null;
    ended.current = false;

    void (async () => {
      try {
        const options = await getMediaRenditions(media._id);
        if (!active) return;
        setRenditions(options);
        if (!options.external_url) {
          const playback = await startMediaPlayback(media._id);
          if (!active) {
            void closeMediaPlayback(playback.session_id).catch((cause) =>
              console.error("Unable to close an inactive media playback session.", cause),
            );
            return;
          }
          sessionIdRef.current = playback.session_id;
          setSession(playback);
          const initialQuality =
            options.recommended_quality ?? options.renditions?.[0]?.quality ?? null;
          setQuality(initialQuality);
        }
      } catch (cause) {
        if (active)
          setError(cause instanceof Error ? cause.message : "Unable to prepare media playback.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sessionId) {
        void (async () => {
          try {
            if (progressTask.current) await progressTask.current;
            await closeMediaPlayback(sessionId);
          } catch (cause) {
            console.error("Unable to close the media playback session.", cause);
          }
        })();
      }
    };
  }, [media._id]);

  useEffect(() => {
    if (!playing || !session?.session_id) return;
    const timer = window.setInterval(() => void syncProgress("HEARTBEAT"), 10_000);
    return () => window.clearInterval(timer);
  }, [playing, session?.session_id, syncProgress]);

  useEffect(() => {
    if (!captionUrl) return;
    return () => URL.revokeObjectURL(captionUrl);
  }, [captionUrl]);

  async function loadCaptions() {
    setError("");
    try {
      const result = await getMediaCaptions(media._id);
      setCaptionUrl(URL.createObjectURL(new Blob([result.webvtt], { type: "text/vtt" })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load captions.");
    }
  }

  async function loadTranscript() {
    setError("");
    setTranscriptLoading(true);
    try {
      setTranscript(await getMediaTranscript(media._id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load transcript.");
    } finally {
      setTranscriptLoading(false);
    }
  }

  async function finishPlayback() {
    ended.current = true;
    const result = await syncProgress("ENDED");
    const sessionId = sessionIdRef.current;
    if (!result || !sessionId) return;
    try {
      const closed = await closeMediaPlayback(sessionId);
      sessionIdRef.current = null;
      setSession(closed);
      setPlaying(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to close playback.");
    }
  }

  const selectedRendition = renditions?.renditions?.find((item) => item.quality === quality);
  const streamUrl = selectedRendition ? mediaStreamUrl(selectedRendition.url) : undefined;
  const commonProps = {
    crossOrigin: "use-credentials" as const,
    controls: true,
    onPlay: () => {
      ended.current = false;
      setPlaying(true);
      void syncProgress("PLAY");
    },
    onPause: () => {
      setPlaying(false);
      if (!ended.current) void syncProgress("PAUSE");
    },
    onSeeking: () => void syncProgress("SEEK"),
    onEnded: () => void finishPlayback(),
    onError: () =>
      setError("The media stream could not be loaded. Try another rendition or refresh."),
    onTimeUpdate: () => {
      if (playerRef.current) positionRef.current = playerRef.current.currentTime;
    },
    onLoadedMetadata: () => {
      const resumePosition = positionRef.current || session?.resume_position_seconds || 0;
      if (resumePosition > 0 && playerRef.current) playerRef.current.currentTime = resumePosition;
    },
  };
  const audioPlayback = media.media_type === "AUDIO" || !!quality?.endsWith("kbps");

  return (
    <Stack>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      {loading ? (
        <Group role="status">
          <Loader size="sm" />
          <Text>Preparing secure playback…</Text>
        </Group>
      ) : renditions?.external_url ? (
        <Alert>
          <Stack gap="xs">
            <Text>
              This is an external reference. Playback and acknowledgement are not recorded here.
            </Text>
            <Button component="a" href={renditions.external_url} target="_blank" rel="noreferrer">
              Open external media
            </Button>
          </Stack>
        </Alert>
      ) : (
        <>
          {audioPlayback ? (
            <audio
              {...commonProps}
              ref={(element) => {
                playerRef.current = element;
              }}
              key={streamUrl}
              src={streamUrl}
              className="w-full"
            >
              {captionUrl && (
                <track kind="captions" src={captionUrl} srcLang="en" label="English" default />
              )}
            </audio>
          ) : (
            <video
              {...commonProps}
              ref={(element) => {
                playerRef.current = element;
              }}
              key={streamUrl}
              src={streamUrl}
              className="max-h-[65vh] w-full rounded-md bg-black"
            >
              {captionUrl && (
                <track kind="captions" src={captionUrl} srcLang="en" label="English" default />
              )}
            </video>
          )}
          <Group justify="space-between">
            <Text size="sm">
              Resume position: {formatTime(session?.resume_position_seconds)} · Completion:{" "}
              {Math.floor(session?.completion_percentage ?? 0)}%
            </Text>
            {renditions?.renditions && (
              <Select
                aria-label="Playback quality"
                data={renditions.renditions.map((item) => ({
                  value: item.quality,
                  label: item.quality,
                }))}
                value={quality}
                onChange={(value) => {
                  if (playerRef.current) positionRef.current = playerRef.current.currentTime;
                  setQuality(value);
                }}
                w={140}
              />
            )}
          </Group>
          {session?.acknowledgement_eligible && (
            <Alert color="green">
              Playback requirements are met. This does not itself record an acknowledgement.
            </Alert>
          )}
          {media.captions_required && (
            <Group>
              <Button variant="default" onClick={() => void loadCaptions()}>
                Load captions
              </Button>
              <Button
                variant="default"
                loading={transcriptLoading}
                onClick={() => void loadTranscript()}
              >
                Load transcript
              </Button>
            </Group>
          )}
          {transcript !== null && (
            <Textarea label="Transcript" value={transcript} readOnly minRows={5} autosize />
          )}
        </>
      )}
    </Stack>
  );
}
