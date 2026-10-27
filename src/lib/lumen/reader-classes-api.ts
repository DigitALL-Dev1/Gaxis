import { request, type ApiReaderClass } from "./users-api";

export type { ApiReaderClass } from "./users-api";

export interface ReaderClassDetails {
  class_name: string;
  description: string;
  access_basis: string;
  requires_document_allowlist: boolean;
  requires_expiry: boolean;
  max_grant_days: number | null;
}

export function listReaderClasses() {
  return request<ApiReaderClass[]>("/lumen/reader-classes");
}

export function createReaderClass(details: ReaderClassDetails & { class_code: string }) {
  return request<ApiReaderClass>("/lumen/reader-classes", "POST", details);
}

export function getReaderClass(id: string) {
  return request<ApiReaderClass>(`/lumen/reader-classes/${encodeURIComponent(id)}`);
}

export function updateReaderClass(id: string, details: Partial<ReaderClassDetails>) {
  return request<ApiReaderClass>(
    `/lumen/reader-classes/${encodeURIComponent(id)}`,
    "PATCH",
    details,
  );
}

export function updateReaderClassStatus(id: string, isActive: boolean) {
  return request<ApiReaderClass>(
    `/lumen/reader-classes/${encodeURIComponent(id)}/status`,
    "PATCH",
    {
      is_active: isActive,
    },
  );
}
