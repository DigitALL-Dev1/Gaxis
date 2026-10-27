export type NavKey =
  | "dashboard"
  | "profile"
  | "library"
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
