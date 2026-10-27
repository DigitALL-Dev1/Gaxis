import { request } from "./users-api";

export const MAX_DOCUMENT_SIZE = 100 * 1024 * 1024;
export const DOCUMENT_TYPES =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export interface ApiDocumentVersion {
  _id: string;
  document_id: string;
  version_number: string;
  status: string;
  file_name: string;
  file_type: string;
  file_size: number;
  checksum_sha256: string;
  change_summary: string | null;
  preparer_name?: string;
  prepared_by: string;
  prepared_at: string;
  released_by: string | null;
  released_at: string | null;
  superseded_at: string | null;
  releaser_name?: string | null;
  review?: DocumentReview;
  proposed_metadata?: Partial<
    Pick<ApiDocument, "title" | "classification" | "reader_class_ids" | "acknowledgement_required">
  >;
}
export interface ApiDocument {
  _id: string;
  title: string;
  reference: string;
  family_id: string;
  family_name: string;
  owner_user_id: string;
  owner_name: string;
  classification: "D2" | "D3";
  reader_class_ids: string[];
  reader_classes?: { _id: string; class_name: string }[];
  acknowledgement_required: boolean;
  is_active: boolean;
  current_version_id: string | null;
  current_approved_version: ApiDocumentVersion | null;
  pending_versions: ApiDocumentVersion[];
  latest_version: ApiDocumentVersion | null;
  status: string;
  can_prepare_revision: boolean;
  can_view_reviews?: boolean;
}
export interface PreparedResponse {
  message: string;
  document_id: string;
  version_id: string;
  version_number: string;
  status: string;
}
export function listDocuments() {
  return request<ApiDocument[]>("/lumen/documents");
}
export function listMyPreparedDocuments() {
  return request<ApiDocument[]>("/lumen/documents/my-prepared");
}
export function listReviewQueue() {
  return request<ApiDocument[]>("/lumen/documents/review-queue");
}
export interface DocumentReview {
  reviewer_kind?: "USER" | "SYSTEM_ADMIN" | "BOOTSTRAP_ADMIN";
  self_review_override?: boolean;
  decision: "RELEASED" | "RETURNED";
  review_comments: string;
  reviewed_by: string;
  reviewer_name: string;
  reviewed_at: string;
  version_id?: string;
  version_number?: string;
}
export interface QueueEntry {
  document: ApiDocument;
  version: ApiDocumentVersion;
}
export interface ReviewDetails extends QueueEntry {
  admin_review?: boolean;
  self_review_override?: boolean;
  preparer_name: string;
  can_release: boolean;
  can_return: boolean;
}
export function getReleaseQueue() {
  return request<QueueEntry[]>("/lumen/release-queue");
}
export function getReviewDetails(id: string) {
  return request<ReviewDetails>(`/lumen/release-queue/${encodeURIComponent(id)}`);
}
export function releaseDocumentVersion(id: string, review_comments: string) {
  return request<PreparedResponse>(
    `/lumen/document-versions/${encodeURIComponent(id)}/release`,
    "POST",
    { review_comments },
  );
}
export function returnDocumentVersion(id: string, review_comments: string) {
  return request<PreparedResponse>(
    `/lumen/document-versions/${encodeURIComponent(id)}/return`,
    "POST",
    { review_comments },
  );
}
export function getDocumentFile(id: string) {
  return request<Blob>(
    `/lumen/document-versions/${encodeURIComponent(id)}/file`,
    "GET",
    undefined,
    "blob",
  );
}
export function getDocumentReviews(id: string) {
  return request<DocumentReview[]>(`/lumen/documents/${encodeURIComponent(id)}/reviews`);
}
export function getDocument(id: string) {
  return request<ApiDocument>(`/lumen/documents/${encodeURIComponent(id)}`);
}
export function listDocumentVersions(id: string) {
  return request<ApiDocumentVersion[]>(`/lumen/documents/${encodeURIComponent(id)}/versions`);
}
export function getDocumentVersion(id: string) {
  return request<ApiDocumentVersion>(`/lumen/document-versions/${encodeURIComponent(id)}`);
}
export function prepareDocument(body: FormData) {
  return request<PreparedResponse>("/lumen/documents/prepare", "POST", body);
}
export function uploadDocumentRevision(id: string, body: FormData) {
  return request<PreparedResponse>(
    `/lumen/documents/${encodeURIComponent(id)}/versions`,
    "POST",
    body,
  );
}

export function validateDocumentFile(file: File | null) {
  if (!file) return "Attach a document.";
  if (file.size === 0) return "The selected document is empty.";
  if (file.size > MAX_DOCUMENT_SIZE) return "Maximum document file size is 100 MB.";
  if (!/\.(pdf|docx?)$/i.test(file.name)) return "Select a PDF, DOCX or DOC file.";
  return null;
}

export const documentStatus = (status: string) =>
  (
    ({
      UNDER_REVIEW: "Under Review",
      APPROVED_CURRENT: "Approved & Current",
      RELEASED: "Approved & Current",
      SUPERSEDED: "Superseded",
      RETURNED_FOR_CORRECTION: "Returned for Correction",
    }) as Record<string, string>
  )[status] ?? status.replaceAll("_", " ");
