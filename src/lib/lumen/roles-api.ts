import { request, type ApiRole } from "./users-api";

export type { ApiRole } from "./users-api";

export interface RoleDetails {
  role_name: string;
  role_code: string;
  description: string;
  permissions: string[];
}

export function listRoles() {
  return request<ApiRole[]>("/roles");
}

export function createRole(role: RoleDetails) {
  return request<ApiRole>("/roles", "POST", role);
}

export function getRole(id: string) {
  return request<ApiRole>(`/roles/${encodeURIComponent(id)}`);
}

export function updateRole(id: string, role: Partial<RoleDetails>) {
  return request<ApiRole>(`/roles/${encodeURIComponent(id)}`, "PUT", role);
}

export function updateRoleStatus(id: string, isActive: boolean) {
  return request<ApiRole>(`/roles/${encodeURIComponent(id)}/status`, "PATCH", {
    is_active: isActive,
  });
}
