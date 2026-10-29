import { apiBase } from "./api-base";
import { useUserAuth } from "./user-auth";
import { getAdminAuthorization, useAdminAuth } from "./admin-auth";

export interface ApiRole {
  _id: string;
  role_code: string;
  role_name: string;
  description: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiReaderClass {
  _id: string;
  class_code: string;
  class_name: string;
  description: string;
  access_basis: string;
  allowed_classifications: string[];
  requires_expiry: boolean;
  max_grant_days: number | null;
  requires_document_allowlist: boolean;
  excluded_families: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewUser {
  full_name: string;
  email: string;
  user_type?: string;
  department?: string;
  role_ids: string[];
  reader_class_id: string;
}

export interface ApiUser {
  _id: string;
  gaxis_user_id: string | null;
  full_name: string;
  email: string;
  user_type: string | null;
  role_ids: string[];
  reader_class_id: string;
  department: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function request<T>(
  path: string,
  method: string = "GET",
  body?: unknown,
  responseType: "json" | "blob" | "text" = "json",
): Promise<T> {
  const authorization = useAdminAuth.getState().admin ? getAdminAuthorization() : null;
  const multipart = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${apiBase()}/api/v1${path}`, {
      method,
      credentials: authorization ? "omit" : "include",
      cache: "no-store",
      headers: {
        ...(authorization ? { Authorization: authorization } : {}),
        ...(body && !multipart ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
  } catch (cause) {
    throw new Error("Cannot reach the backend. Check that it is running and try again.");
  }

  if (response.status === 401) {
    useAdminAuth.getState().signOut();
    useUserAuth.getState().clearLocalSession();
    throw new Error("Sign in again to continue.");
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const detail = errorData?.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((item: { msg: string }) => item.msg).join("; ")
          : "Unable to load or save data. Please try again.",
    );
  }
  if (responseType === "blob") return response.blob() as Promise<T>;
  if (responseType === "text") return response.text() as Promise<T>;
  return response.json();
}

export async function loadUserManagement() {
  const [users, roles, readerClasses] = await Promise.all([
    listUsers(),
    request<ApiRole[]>("/roles"),
    request<ApiReaderClass[]>("/lumen/reader-classes"),
  ]);
  return { users, roles, readerClasses };
}

export function listUsers() {
  return request<ApiUser[]>("/lumen/users");
}

export function createUser(user: NewUser) {
  return request<ApiUser>("/lumen/users", "POST", user);
}

export function getUser(userId: string) {
  return request<ApiUser>(`/lumen/users/${encodeURIComponent(userId)}`);
}

export function updateUser(userId: string, update: Partial<NewUser>) {
  return request<ApiUser>(`/lumen/users/${encodeURIComponent(userId)}`, "PATCH", update);
}

export function updateUserRoles(userId: string, roleIds: string[]) {
  return request<ApiUser>(`/lumen/users/${encodeURIComponent(userId)}/roles`, "PATCH", {
    role_ids: roleIds,
  });
}

export function updateUserReaderClass(userId: string, readerClassId: string) {
  return request<ApiUser>(`/lumen/users/${encodeURIComponent(userId)}/reader-class`, "PATCH", {
    reader_class_id: readerClassId,
  });
}

export function updateUserStatus(userId: string, status: "ACTIVE" | "INACTIVE") {
  return request<ApiUser>(`/lumen/users/${encodeURIComponent(userId)}/status`, "PATCH", { status });
}
