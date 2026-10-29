import type { NavKey } from "./access";

export const MODULE_PERMISSIONS: Record<NavKey, readonly string[]> = {
  dashboard: [],
  profile: [],
  library: ["documents.read"],
  media: ["documents.read", "documents.prepare", "documents.release"],
  mediaPrepare: ["documents.prepare"],
  prepare: ["documents.prepare"],
  prepared: ["documents.prepare"],
  release: ["documents.review", "documents.release"],
  system: ["users.create", "users.read", "users.update", "users.manage"],
  roles: ["roles.manage"],
  readerClasses: ["reader_classes.manage"],
  families: ["document_families.manage"],
  grants: ["access_grants.manage", "grants.manage"],
};

export function canUseModule(permissions: readonly string[], module: NavKey) {
  const required = MODULE_PERMISSIONS[module];
  return required.length === 0 || required.some((permission) => permissions.includes(permission));
}

export function modulesForPermissions(permissions: readonly string[]): NavKey[] {
  return (Object.keys(MODULE_PERMISSIONS) as NavKey[]).filter((module) =>
    canUseModule(permissions, module),
  );
}
