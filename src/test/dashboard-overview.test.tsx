import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DashboardOverview } from "@/components/lumen/DashboardOverview";
import {
  listDocuments,
  listMyPreparedDocuments,
  getReleaseQueue,
  type ApiDocument,
} from "@/lib/lumen/documents-api";
import { listAccessGrants } from "@/lib/lumen/access-grants-api";
import { listUsers } from "@/lib/lumen/users-api";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/lib/lumen/documents-api", () => ({
  listDocuments: vi.fn(),
  listMyPreparedDocuments: vi.fn(),
  getReleaseQueue: vi.fn(),
}));
vi.mock("@/lib/lumen/access-grants-api", () => ({ listAccessGrants: vi.fn() }));
vi.mock("@/lib/lumen/users-api", () => ({ listUsers: vi.fn() }));
const document: ApiDocument = {
  _id: "document",
  title: "Live Safety Policy",
  reference: "LIVE-001",
  family_id: "safety",
  family_name: "Safety",
  owner_user_id: "owner",
  owner_name: "Sarah",
  classification: "D2",
  reader_class_ids: ["employee"],
  acknowledgement_required: true,
  is_active: true,
  current_version_id: "approved",
  current_approved_version: {
    _id: "approved",
    document_id: "document",
    version_number: "1.0",
    status: "APPROVED_CURRENT",
    file_name: "policy.pdf",
    file_type: "application/pdf",
    file_size: 200,
    checksum_sha256: "checksum",
    change_summary: null,
    prepared_by: "owner",
    prepared_at: "2026-10-25T00:00:00Z",
    released_by: "releaser",
    released_at: "2026-10-26T00:00:00Z",
    superseded_at: null,
  },
  pending_versions: [],
  latest_version: null,
  status: "APPROVED_CURRENT",
  can_prepare_revision: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listDocuments).mockResolvedValue([
    document,
    { ...document, _id: "pending", title: "Pending document", current_approved_version: null },
  ]);
  vi.mocked(listMyPreparedDocuments).mockResolvedValue([document]);
  vi.mocked(getReleaseQueue).mockResolvedValue([]);
  vi.mocked(listAccessGrants).mockResolvedValue([]);
  vi.mocked(listUsers).mockResolvedValue([]);
});
afterEach(cleanup);

it("uses live permitted approved records and does not request unrelated administrative data", async () => {
  render(
    <MantineProvider env="test">
      <DashboardOverview modules={["library", "profile"]} />
    </MantineProvider>,
  );
  await screen.findByText("Live Safety Policy");
  const card = screen.getByText("Approved documents").closest(".shadow-card") as HTMLElement;
  expect(within(card).getByText("1")).toBeInTheDocument();
  expect(screen.queryByText("Pending document")).not.toBeInTheDocument();
  expect(listMyPreparedDocuments).not.toHaveBeenCalled();
  expect(getReleaseQueue).not.toHaveBeenCalled();
  expect(listAccessGrants).not.toHaveBeenCalled();
  expect(listUsers).not.toHaveBeenCalled();
});

it("keeps available summaries when one service fails and retries from Refresh overview", async () => {
  vi.mocked(listDocuments).mockRejectedValueOnce(new Error("Document service unavailable"));
  render(
    <MantineProvider env="test">
      <DashboardOverview modules={["library", "release", "prepared"]} />
    </MantineProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Document service unavailable");
  const card = screen.getByText("Pending review versions").closest(".shadow-card") as HTMLElement;
  expect(within(card).getByText("0")).toBeInTheDocument();
  expect(screen.getByText("Unavailable")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh overview" }));
  await screen.findByText("Live Safety Policy");
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(listDocuments).toHaveBeenCalledTimes(2);
});
