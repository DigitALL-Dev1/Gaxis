import { apiBase } from "./api-base";
import { request } from "./users-api";

export const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024;
export const MAX_AUDIO_SIZE = 200 * 1024 * 1024;

export type MediaType = "VIDEO" | "AUDIO";
export type MediaLicence =
  "OWNED" | "LICENSED_WITH_REFERENCE" | "PERMISSION_GRANTED" | "REFERENCE_ONLY";

export interface MediaAsset {
  _id: string;
  document_id: string;
  version_id: string;
  media_type: MediaType;
  title: string;
  description: string;
  original_file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number;
  duration_seconds: number | null;
  checksum_sha256: string | null;
  processing_status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  licence_status: MediaLicence;
  external_url: string | null;
  captions_required: boolean;
  safety_or_induction: boolean;
  acknowledgement_required: boolean;
  has_audio: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  link_checked_at?: string | null;
  link_http_status?: number | null;
  link_health?: "HEALTHY" | "NEEDS_REVIEW" | "UNAVAILABLE" | null;
  link_error?: string | null;
}

export interface PrepareMediaResponse {
  message: string;
  media_asset_id: string;
  document_id: string;
  version_id: string;
  processing_status: string;
  publication_status: string;
}

export interface MediaPlaybackSession {
  session_id: string;
  version_id: string;
  duration_seconds: number;
  resume_position_seconds: number;
  completion_percentage: number;
  acknowledgement_eligible: boolean;
  status: string;
}

export interface MediaRenditions {
  external_url?: string;
  acknowledgement_eligible?: false;
  renditions?: { quality: string; url: string }[];
  recommended_quality?: string;
  transcript_url?: string;
  watermark_required?: boolean;
}

export interface MediaCaption {
  language_code: string;
  review_status: string;
  webvtt: string;
}

export interface MediaProcessingStatus {
  processing_status: MediaAsset["processing_status"];
  human_caption_review_required: boolean;
  jobs: {
    _id: string;
    job_type: string;
    status: string;
    progress_percentage: number;
    error_message: string | null;
    created_at: string;
  }[];
}

export interface PrepareMedia {
  title: string;
  family_id: string;
  classification: "D2" | "D3";
  reader_class_ids: string[];
  version_number: string;
  media_type: MediaType;
  licence_status: MediaLicence;
  acknowledgement_required: boolean;
  reference?: string;
  document_id?: string;
  description: string;
  licence_reference?: string;
  external_url?: string;
  safety_or_induction: boolean;
  file?: File;
}

export function listMedia(skip = 0, limit = 100) {
  return request<MediaAsset[]>(`/lumen/media?skip=${skip}&limit=${limit}`);
}

export function getMedia(mediaId: string) {
  return request<MediaAsset>(`/lumen/media/${encodeURIComponent(mediaId)}`);
}

export function prepareMedia(body: FormData) {
  return request<PrepareMediaResponse>("/lumen/media/prepare", "POST", body);
}

export function getMediaProcessingStatus(mediaId: string) {
  return request<MediaProcessingStatus>(
    `/lumen/media/${encodeURIComponent(mediaId)}/processing-status`,
  );
}

export function requestMediaProcessing(mediaId: string) {
  return request<{ message: string }>(
    `/lumen/media/${encodeURIComponent(mediaId)}/process`,
    "POST",
  );
}

export function reviewMediaCaptions(
  mediaId: string,
  review: { language_code: string; webvtt: string; transcript: string; corrected: true },
) {
  return request<{ message: string; review_status: string }>(
    `/lumen/media/${encodeURIComponent(mediaId)}/captions/review`,
    "POST",
    review,
  );
}

export function getMediaCaptions(mediaId: string, languageCode = "en") {
  return request<MediaCaption>(
    `/lumen/media/${encodeURIComponent(mediaId)}/captions?language_code=${encodeURIComponent(languageCode)}`,
  );
}

export function getMediaTranscript(mediaId: string, languageCode = "en") {
  return request<string>(
    `/lumen/media/${encodeURIComponent(mediaId)}/transcript?language_code=${encodeURIComponent(languageCode)}`,
    "GET",
    undefined,
    "text",
  );
}

export function getMediaRenditions(mediaId: string, bandwidthKbps?: number) {
  const bandwidth = bandwidthKbps ? `?bandwidth_kbps=${bandwidthKbps}` : "";
  return request<MediaRenditions>(
    `/lumen/media/${encodeURIComponent(mediaId)}/renditions${bandwidth}`,
  );
}

export function mediaStreamUrl(path: string) {
  return new URL(path, apiBase()).toString();
}

export function startMediaPlayback(mediaId: string) {
  return request<MediaPlaybackSession>(
    `/lumen/media/${encodeURIComponent(mediaId)}/playback/start`,
    "POST",
  );
}

export function reportMediaProgress(
  sessionId: string,
  position_seconds: number,
  event: "PLAY" | "HEARTBEAT" | "PAUSE" | "SEEK" | "ENDED" = "HEARTBEAT",
) {
  return request<MediaPlaybackSession>(
    `/lumen/media/playback/${encodeURIComponent(sessionId)}/progress`,
    "POST",
    { position_seconds, event },
  );
}

export function closeMediaPlayback(sessionId: string) {
  return request<MediaPlaybackSession>(
    `/lumen/media/playback/${encodeURIComponent(sessionId)}/close`,
    "POST",
  );
}

export function validateMediaFile(file: File | null, mediaType: MediaType) {
  if (!file) return "Choose a media file.";
  if (file.size === 0) return "The selected file is empty.";
  const maxSize = mediaType === "VIDEO" ? MAX_VIDEO_SIZE : MAX_AUDIO_SIZE;
  if (file.size > maxSize)
    return `Maximum ${mediaType.toLowerCase()} file size is ${mediaType === "VIDEO" ? "2 GB" : "200 MB"}.`;
  return null;
}
