import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaPlayer } from "@/components/lumen/MediaPlayer";
import {
  closeMediaPlayback,
  getMediaRenditions,
  reportMediaProgress,
  startMediaPlayback,
  type MediaAsset,
  type MediaPlaybackSession,
} from "@/lib/lumen/media-api";

vi.mock("@/lib/lumen/media-api", async (original) => ({
  ...(await original<typeof import("@/lib/lumen/media-api")>()),
  closeMediaPlayback: vi.fn(),
  getMediaRenditions: vi.fn(),
  reportMediaProgress: vi.fn(),
  startMediaPlayback: vi.fn(),
}));
vi.setConfig({ testTimeout: 20000 });

const media = {
  _id: "asset-id",
  media_type: "AUDIO",
  title: "Site induction",
  duration_seconds: 100,
  licence_status: "OWNED",
  captions_required: false,
} as MediaAsset;
const session: MediaPlaybackSession = {
  session_id: "session-id",
  version_id: "version-id",
  duration_seconds: 100,
  resume_position_seconds: 0,
  completion_percentage: 0,
  acknowledgement_eligible: false,
  status: "ACTIVE",
};

async function renderPlayer(currentTime = 0) {
  const view = render(
    <MantineProvider env="test">
      <MediaPlayer media={media} />
    </MantineProvider>,
  );
  await screen.findByText(/Resume position/);
  const player = view.container.querySelector("audio")!;
  Object.defineProperty(player, "currentTime", { value: currentTime, writable: true });
  return player;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMediaRenditions).mockResolvedValue({
    renditions: [
      { quality: "128kbps", url: "/api/v1/lumen/media/asset-id/stream?quality=128kbps" },
    ],
    recommended_quality: "128kbps",
  });
  vi.mocked(startMediaPlayback).mockResolvedValue(session);
  vi.mocked(reportMediaProgress).mockResolvedValue(session);
  vi.mocked(closeMediaPlayback).mockResolvedValue({ ...session, status: "PAUSED" });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Media player progress", () => {
  it("sends overlapping playback events one at a time, in order", async () => {
    const pending: ((value: MediaPlaybackSession) => void)[] = [];
    vi.mocked(reportMediaProgress).mockImplementation(
      () => new Promise((resolve) => pending.push(resolve)),
    );
    const player = await renderPlayer();

    fireEvent.play(player);
    fireEvent.seeking(player);
    fireEvent.pause(player);

    for (const sent of [1, 2, 3]) {
      await waitFor(() => expect(reportMediaProgress).toHaveBeenCalledTimes(sent));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(reportMediaProgress).toHaveBeenCalledTimes(sent);
      pending[sent - 1]!(session);
    }
    expect(vi.mocked(reportMediaProgress).mock.calls.map((call) => call[2])).toEqual([
      "PLAY",
      "SEEK",
      "PAUSE",
    ]);
  });

  it("never reports a position past the recorded media duration", async () => {
    const player = await renderPlayer(100.4);

    fireEvent.ended(player);

    await waitFor(() => expect(closeMediaPlayback).toHaveBeenCalledWith("session-id"));
    expect(reportMediaProgress).toHaveBeenCalledWith("session-id", 100, "ENDED");
  });

  it("resumes the closed session when finished media is replayed", async () => {
    const player = await renderPlayer(100);
    fireEvent.ended(player);
    await waitFor(() => expect(closeMediaPlayback).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(startMediaPlayback).toHaveBeenCalledTimes(1));

    fireEvent.play(player);

    await waitFor(() => expect(startMediaPlayback).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(reportMediaProgress).toHaveBeenLastCalledWith("session-id", 100, "PLAY"),
    );
  });
});
