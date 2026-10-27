import { request } from "./users-api";

export interface GrantDocument {
  _id: string;
  title: string;
  reference: string;
}
export interface Renewal {
  start_date: string;
  expiry_date: string;
  reason: string;
  requested_by_name: string;
  approval_status: string;
  rejection_reason?: string;
  approved_by_name?: string;
}
export interface AccessGrant {
  _id: string;
  user_id: string;
  user_name: string;
  reader_class_id: string;
  reader_class_code: string;
  reader_class_name: string;
  document_ids: string[];
  documents: GrantDocument[];
  granted_by: string;
  granted_by_name: string;
  approval_status: string;
  status: string;
  reason: string;
  start_date: string;
  expiry_date: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  revocation_reason?: string;
  revoked_by_name?: string;
  revoked_at?: string;
  days_remaining: number;
  approval_required: string;
  requires_ceo_approval: boolean;
  can_approve: boolean;
  can_reject: boolean;
  can_revoke: boolean;
  can_renew: boolean;
  max_grant_days?: number;
  needs_reapproval?: boolean;
  eligibility_error?: string;
  renewal?: Renewal;
  renewal_history?: Renewal[];
}
export interface NewAccessGrant {
  user_id: string;
  document_ids: string[];
  reason: string;
  start_date: string;
  expiry_date: string;
}
export interface EligibleDocuments {
  reader_class: { _id: string; class_name: string; class_code: string };
  max_grant_days: number;
  documents: (GrantDocument & {
    classification: string;
    family_name: string;
    requires_ceo_approval: boolean;
  })[];
}
const grantPath = (id: string) => `/lumen/access-grants/${encodeURIComponent(id)}`;
export function listAccessGrants(userId?: string) {
  return request<AccessGrant[]>(
    userId ? `/lumen/users/${encodeURIComponent(userId)}/access-grants` : "/lumen/access-grants",
  );
}
export function getAccessGrant(id: string) {
  return request<AccessGrant>(grantPath(id));
}
export function createAccessGrant(body: NewAccessGrant) {
  return request<AccessGrant>("/lumen/access-grants", "POST", body);
}
export function getEligibleGrantDocuments(userId: string) {
  return request<EligibleDocuments>(
    `/lumen/access-grants/eligible-documents?user_id=${encodeURIComponent(userId)}`,
  );
}
export function approveAccessGrant(id: string) {
  return request<AccessGrant>(`${grantPath(id)}/approve`, "POST");
}
export function rejectAccessGrant(id: string, rejection_reason: string) {
  return request<AccessGrant>(`${grantPath(id)}/reject`, "POST", { rejection_reason });
}
export function revokeAccessGrant(id: string, revocation_reason: string) {
  return request<AccessGrant>(`${grantPath(id)}/revoke`, "POST", { revocation_reason });
}
export function renewAccessGrant(id: string, new_expiry_date: string, reason: string) {
  return request<AccessGrant>(`${grantPath(id)}/renew`, "POST", { new_expiry_date, reason });
}
export function getExpiringGrants(days = 7) {
  return request<AccessGrant[]>(`/lumen/access-grants/expiring?days=${days}`);
}
