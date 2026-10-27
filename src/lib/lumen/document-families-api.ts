import { apiBase } from "./api-base";
import { request } from "./users-api";

export interface ApiDocumentFamily {
  _id: string;
  family_code: string;
  family_name: string;
  description: string | null;
  owner_user_id: string | null;
  releaser_user_ids: string[];
  grant_approver_user_ids?: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NewDocumentFamily {
  family_code: string;
  family_name: string;
  description?: string;
  owner_user_id?: string | null;
  releaser_user_ids?: string[];
  is_active?: boolean;
}

export interface UpdateDocumentFamily {
  grant_approver_user_ids?: string[];
  family_name?: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateFamilyOwner {
  owner_user_id: string | null;
}

export interface UpdateFamilyReleasers {
  releaser_user_ids: string[];
}

export interface UpdateFamilyStatus {
  is_active: boolean;
}

export async function loadDocumentFamilies(): Promise<ApiDocumentFamily[]> {
  return request<ApiDocumentFamily[]>("/lumen/document-families");
}

export function createDocumentFamily(family: NewDocumentFamily): Promise<ApiDocumentFamily> {
  return request<ApiDocumentFamily>("/lumen/document-families", "POST", family);
}

export function getDocumentFamily(familyId: string): Promise<ApiDocumentFamily> {
  return request<ApiDocumentFamily>(`/lumen/document-families/${encodeURIComponent(familyId)}`);
}

export function updateDocumentFamily(
  familyId: string,
  update: UpdateDocumentFamily,
): Promise<ApiDocumentFamily> {
  return request<ApiDocumentFamily>(
    `/lumen/document-families/${encodeURIComponent(familyId)}`,
    "PATCH",
    update,
  );
}

export function updateFamilyOwner(
  familyId: string,
  owner: UpdateFamilyOwner,
): Promise<ApiDocumentFamily> {
  return request<ApiDocumentFamily>(
    `/lumen/document-families/${encodeURIComponent(familyId)}/owner`,
    "PATCH",
    owner,
  );
}

export function updateFamilyReleasers(
  familyId: string,
  releasers: UpdateFamilyReleasers,
): Promise<ApiDocumentFamily> {
  return request<ApiDocumentFamily>(
    `/lumen/document-families/${encodeURIComponent(familyId)}/releasers`,
    "PATCH",
    releasers,
  );
}

export function updateFamilyStatus(
  familyId: string,
  status: UpdateFamilyStatus,
): Promise<ApiDocumentFamily> {
  return request<ApiDocumentFamily>(
    `/lumen/document-families/${encodeURIComponent(familyId)}/status`,
    "PATCH",
    status,
  );
}

// Preparation needs only the active family list, without administrator credentials.
export async function loadActiveDocumentFamilies(): Promise<ApiDocumentFamily[]> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}/api/v1/lumen/document-families?active_only=true`, {
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    throw new Error("Cannot load document families. Check the backend and try again.");
  }
  if (!response.ok) throw new Error("Unable to load active document families. Please try again.");
  const families: ApiDocumentFamily[] = await response.json();
  return families.filter((family) => family.is_active);
}
