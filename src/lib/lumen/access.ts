export type NavKey =
  | "dashboard"
  | "profile"
  | "library"
  | "media"
  | "mediaPrepare"
  | "prepare"
  | "prepared"
  | "release"
  | "grants"
  | "system"
  | "roles"
  | "readerClasses"
  | "families";

export const ADMIN_MODULES: readonly NavKey[] = [
  "dashboard",
  "library",
  "media",
  "mediaPrepare",
  "prepare",
  "prepared",
  "release",
  "grants",
  "system",
  "roles",
  "readerClasses",
  "families",
  "profile",
];
