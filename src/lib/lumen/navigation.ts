import {
  LayoutDashboard,
  Library,
  Video,
  FilePlus2,
  FileText,
  Send,
  KeyRound,
  Settings,
  Shield,
  Users,
  UserCircle,
} from "lucide-react";
import type { NavKey } from "./access";

export const NAV: {
  key: NavKey;
  label: string;
  to: string;
  icon: typeof Library;
  group: string;
}[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
    group: "Workspace",
  },
  { key: "library", label: "Document Library", to: "/library", icon: Library, group: "Workspace" },
  { key: "media", label: "Media Library", to: "/media", icon: Video, group: "Workspace" },
  {
    key: "mediaPrepare",
    label: "Prepare Media",
    to: "/admin/media/prepare",
    icon: FilePlus2,
    group: "Publishing",
  },
  {
    key: "prepare",
    label: "Prepare Document",
    to: "/admin/prepare",
    icon: FilePlus2,
    group: "Publishing",
  },
  { key: "release", label: "Release Queue", to: "/admin/release", icon: Send, group: "Publishing" },
  {
    key: "prepared",
    label: "My Prepared Documents",
    to: "/admin/prepared",
    icon: FileText,
    group: "Publishing",
  },
  {
    key: "grants",
    label: "Access Grants",
    to: "/admin/grants",
    icon: KeyRound,
    group: "Governance",
  },
  {
    key: "system",
    label: "User Management",
    to: "/admin/system",
    icon: Settings,
    group: "Governance",
  },
  {
    key: "roles",
    label: "Roles Management",
    to: "/admin/roles",
    icon: Shield,
    group: "Governance",
  },
  {
    key: "readerClasses",
    label: "Reader Classes Management",
    to: "/admin/reader-classes",
    icon: Users,
    group: "Governance",
  },
  {
    key: "families",
    label: "Document Families",
    to: "/admin/families",
    icon: Library,
    group: "Governance",
  },
  { key: "profile", label: "My Profile", to: "/profile", icon: UserCircle, group: "Workspace" },
];
