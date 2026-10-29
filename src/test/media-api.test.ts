import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeMediaPlayback,
  getMedia,
  getMediaCaptions,
  getMediaProcessingStatus,
  getMediaRenditions,
  getMediaTranscript,
  listMedia,
  mediaStreamUrl,
  prepareMedia,
  reportMediaProgress,
  requestMediaProcessing,
  reviewMediaCaptions,
  startMediaPlayback,
  validateMediaFile,
} from "@/lib/lumen/media-api";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async (_url: string, options: RequestInit = {}) => ({
    ok: true,
    json: async () => ({}),
    text: async () => "Transcript content",
    ...options,
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe("Media API", () => {
  it("uses the cookie-authenticated media routes and sends each request payload", async () => {
    const form = new FormData();
    form.append("title", "Site induction");
    await prepareMedia(form);
    await listMedia(10, 25);
    await getMedia("asset/id");
    await getMediaProcessingStatus("asset-id");
    await requestMediaProcessing("asset-id");
    await reviewMediaCaptions("asset-id", {
      language_code: "en",
      webvtt: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nWelcome",
      transcript: "Welcome",
      corrected: true,
    });
    await getMediaCaptions("asset-id", "en-GB");
    expect(await getMediaTranscript("asset-id")).toBe("Transcript content");
    await getMediaRenditions("asset-id", 250);
    await startMediaPlayback("asset-id");
    await reportMediaProgress("session/id", 12.5, "HEARTBEAT");
    await closeMediaPlayback("session-id");

    expect(
      fetchMock.mock.calls.map(([url, options]) => [
        String(url).split("/api/v1")[1],
        options.method ?? "GET",
      ]),
    ).toEqual([
      ["/lumen/media/prepare", "POST"],
      ["/lumen/media?skip=10&limit=25", "GET"],
      ["/lumen/media/asset%2Fid", "GET"],
      ["/lumen/media/asset-id/processing-status", "GET"],
      ["/lumen/media/asset-id/process", "POST"],
      ["/lumen/media/asset-id/captions/review", "POST"],
      ["/lumen/media/asset-id/captions?language_code=en-GB", "GET"],
      ["/lumen/media/asset-id/transcript?language_code=en", "GET"],
      ["/lumen/media/asset-id/renditions?bandwidth_kbps=250", "GET"],
      ["/lumen/media/asset-id/playback/start", "POST"],
      ["/lumen/media/playback/session%2Fid/progress", "POST"],
      ["/lumen/media/playback/session-id/close", "POST"],
    ]);
    expect(fetchMock.mock.calls[0]![1].body).toBe(form);
    expect(fetchMock.mock.calls[0]![1].headers["Content-Type"]).toBeUndefined();
    expect(JSON.parse(fetchMock.mock.calls[5]![1].body)).toEqual({
      language_code: "en",
      webvtt: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nWelcome",
      transcript: "Welcome",
      corrected: true,
    });
    expect(JSON.parse(fetchMock.mock.calls[10]![1].body)).toEqual({
      position_seconds: 12.5,
      event: "HEARTBEAT",
    });
    for (const [, options] of fetchMock.mock.calls) expect(options.credentials).toBe("include");
  });

  it("builds absolute protected stream URLs and validates media size and presence", () => {
    expect(mediaStreamUrl("/api/v1/lumen/media/asset/stream?quality=720p")).toContain(
      "/api/v1/lumen/media/asset/stream?quality=720p",
    );
    expect(validateMediaFile(null, "VIDEO")).toContain("Choose");
    expect(validateMediaFile(new File([], "empty.mp4"), "VIDEO")).toContain("empty");
    expect(validateMediaFile(new File(["audio"], "training.mp3"), "AUDIO")).toBeNull();
  });
});
