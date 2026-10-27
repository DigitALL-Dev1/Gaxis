import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccessGrantsManagement, GrantAccessForm } from "@/components/lumen/AccessGrantsManagement";
import { listUsers, type ApiUser } from "@/lib/lumen/users-api";
import { listReaderClasses } from "@/lib/lumen/reader-classes-api";
import { useAdminAuth } from "@/lib/lumen/admin-auth";
import { useUserAuth } from "@/lib/lumen/user-auth";
import {
  approveAccessGrant,
  createAccessGrant,
  getAccessGrant,
  getEligibleGrantDocuments,
  getExpiringGrants,
  listAccessGrants,
  rejectAccessGrant,
  renewAccessGrant,
  revokeAccessGrant,
  type AccessGrant,
} from "@/lib/lumen/access-grants-api";
vi.setConfig({ testTimeout: 20000 });
vi.mock("@/lib/lumen/users-api", () => ({ listUsers: vi.fn() }));
vi.mock("@/lib/lumen/reader-classes-api", () => ({ listReaderClasses: vi.fn() }));
vi.mock("@/lib/lumen/access-grants-api", () => ({
  approveAccessGrant: vi.fn(),
  createAccessGrant: vi.fn(),
  getAccessGrant: vi.fn(),
  getEligibleGrantDocuments: vi.fn(),
  getExpiringGrants: vi.fn(),
  listAccessGrants: vi.fn(),
  rejectAccessGrant: vi.fn(),
  renewAccessGrant: vi.fn(),
  revokeAccessGrant: vi.fn(),
}));
const grant: AccessGrant = {
  _id: "grant",
  user_id: "david",
  user_name: "David",
  reader_class_id: "contractor",
  reader_class_code: "CONTRACTOR_CONSULTANT",
  reader_class_name: "Contractor / Consultant",
  document_ids: ["safety"],
  documents: [{ _id: "safety", title: "Site Safety Policy", reference: "HSE-001" }],
  granted_by: "admin",
  granted_by_name: "Administrator",
  approval_status: "PENDING",
  status: "PENDING",
  reason: "Induction",
  start_date: new Date().toISOString(),
  expiry_date: new Date(Date.now() + 30 * 86400000).toISOString(),
  days_remaining: 30,
  approval_required: "Assigned divisional manager",
  requires_ceo_approval: false,
  can_approve: true,
  can_reject: true,
  can_revoke: true,
  can_renew: false,
  max_grant_days: 90,
};
const people: ApiUser[] = [
  {
    _id: "david",
    full_name: "David",
    email: "david@example.com",
    user_type: "CONTRACTOR",
    reader_class_id: "contractor",
    role_ids: [],
    status: "ACTIVE",
    department: null,
    gaxis_user_id: null,
    created_by: "admin",
    created_at: "",
    updated_at: "",
  },
  {
    _id: "employee",
    full_name: "Employee User",
    email: "employee@example.com",
    user_type: "EMPLOYEE",
    reader_class_id: "employee",
    role_ids: [],
    status: "ACTIVE",
    department: null,
    gaxis_user_id: null,
    created_by: "admin",
    created_at: "",
    updated_at: "",
  },
];
beforeEach(() => {
  vi.resetAllMocks();
  useAdminAuth.getState().signOut();
  useUserAuth.setState({
    user: {
      id: "manager",
      full_name: "Manager",
      email: "manager@example.com",
      gaxis_user_id: null,
      status: "active",
      roles: [],
      reader_class: { id: "employee", code: "EMPLOYEE", name: "Employee" },
      permissions: ["access_grants.manage", "users.read"],
      modules: [],
    },
  });
  vi.mocked(listUsers).mockResolvedValue(people);
  vi.mocked(listReaderClasses).mockResolvedValue(
    ["contractor", "employee"].map((id) => ({
      _id: id,
      class_code: id === "contractor" ? "CONTRACTOR_CONSULTANT" : "EMPLOYEE",
      class_name: id,
      description: "",
      access_basis: id === "contractor" ? "NAMED_ALLOWLIST" : "ROLE_DEFAULT",
      allowed_classifications: ["D2"],
      requires_document_allowlist: id === "contractor",
      requires_expiry: id === "contractor",
      max_grant_days: 90,
      excluded_families: [],
      is_active: true,
      created_at: "",
      updated_at: "",
    })),
  );
  vi.mocked(listAccessGrants).mockResolvedValue([grant]);
  vi.mocked(getAccessGrant).mockResolvedValue(grant);
  vi.mocked(getExpiringGrants).mockResolvedValue([]);
  vi.mocked(getEligibleGrantDocuments).mockResolvedValue({
    reader_class: {
      _id: "contractor",
      class_name: "Contractor / Consultant",
      class_code: "CONTRACTOR_CONSULTANT",
    },
    max_grant_days: 90,
    documents: [
      {
        ...grant.documents[0]!,
        classification: "D2",
        family_name: "Safety",
        requires_ceo_approval: false,
      },
    ],
  });
  for (const action of [
    approveAccessGrant,
    createAccessGrant,
    rejectAccessGrant,
    revokeAccessGrant,
    renewAccessGrant,
  ])
    vi.mocked(action).mockResolvedValue(grant);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useUserAuth.getState().clearLocalSession();
});
function show(element: ReactNode) {
  return render(<MantineProvider env="test">{element}</MantineProvider>);
}

it("shows approval separately from access status and fetches expiring and user-specific grants", async () => {
  show(<AccessGrantsManagement />);
  await screen.findByText("Site Safety Policy");
  expect(screen.getAllByText("PENDING")).toHaveLength(2);
  fireEvent.click(screen.getByLabelText("Expiring within 7 days"));
  await waitFor(() => expect(getExpiringGrants).toHaveBeenCalledWith(7));
  await screen.findByText("No access grants match this view.");
  fireEvent.click(screen.getByLabelText("Expiring within 7 days"));
  await screen.findByText("Site Safety Policy");
  fireEvent.click(screen.getByRole("combobox", { name: "Filter by user" }));
  fireEvent.click(await screen.findByRole("option", { name: "David" }));
  await waitFor(() => expect(listAccessGrants).toHaveBeenCalledWith("david"));
});

it("requires approval confirmation and shows backend authority errors", async () => {
  vi.mocked(approveAccessGrant).mockRejectedValue(new Error("CEO approval is required"));
  show(<AccessGrantsManagement />);
  fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
  await screen.findByText(/Confirm that you authorise/);
  expect(approveAccessGrant).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm approve" }));
  expect(await screen.findByText("CEO approval is required")).toBeInTheDocument();
  expect(approveAccessGrant).toHaveBeenCalledWith("grant");
});

it("requires rejection comments, sends them and refreshes the list", async () => {
  show(<AccessGrantsManagement />);
  fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm reject" }));
  expect(await screen.findByText("A reason is required.")).toBeInTheDocument();
  expect(rejectAccessGrant).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^Reason/), {
    target: { value: "Not justified" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm reject" }));
  await waitFor(() => expect(rejectAccessGrant).toHaveBeenCalledWith("grant", "Not justified"));
  await waitFor(() => expect(listAccessGrants).toHaveBeenCalledTimes(2));
});

it("confirms revocation and prevents duplicate actions while saving", async () => {
  let resolve!: (value: AccessGrant) => void;
  vi.mocked(revokeAccessGrant).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  show(<AccessGrantsManagement />);
  fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
  await screen.findByText(/Confirm revocation/);
  expect(revokeAccessGrant).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^Reason/), {
    target: { value: "Contract ended" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm revoke" }));
  expect(screen.getByRole("button", { name: "Confirm revoke" })).toBeDisabled();
  expect(screen.getByLabelText(/^Reason/)).toBeDisabled();
  expect(revokeAccessGrant).toHaveBeenCalledTimes(1);
  resolve({ ...grant, status: "REVOKED" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("requests renewal with a future expiry and preserves existing validity until approval", async () => {
  const active = {
    ...grant,
    status: "ACTIVE",
    approval_status: "APPROVED",
    can_approve: false,
    can_reject: false,
    can_renew: true,
  };
  vi.mocked(listAccessGrants).mockResolvedValue([active]);
  vi.mocked(getAccessGrant).mockResolvedValue(active);
  show(<AccessGrantsManagement />);
  fireEvent.click(await screen.findByRole("button", { name: "Renew" }));
  await screen.findByText(/current expiry stays in effect/);
  fireEvent.change(screen.getByLabelText(/^Reason/), {
    target: { value: "Extended project" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm renew" }));
  await waitFor(() => expect(renewAccessGrant).toHaveBeenCalledTimes(1));
  expect(vi.mocked(renewAccessGrant).mock.calls[0]![2]).toBe("Extended project");
  expect(new Date(vi.mocked(renewAccessGrant).mock.calls[0]![1]).getTime()).toBeGreaterThan(
    new Date(grant.expiry_date).getTime(),
  );
});

it("keeps the queue available to approvers without user-search permission", async () => {
  const user = useUserAuth.getState().user!;
  useUserAuth.setState({ user: { ...user, permissions: ["access_grants.manage"] } });
  show(<AccessGrantsManagement />);
  await screen.findByText("Site Safety Policy");
  expect(screen.getByRole("button", { name: "Grant Access" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  expect(listUsers).not.toHaveBeenCalled();
});

async function chooseRecipient() {
  fireEvent.click(await screen.findByRole("combobox", { name: /Select user/ }));
  expect(screen.queryByRole("option", { name: /Employee User/ })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole("option", { name: /David/ }));
  await waitFor(() =>
    expect(screen.getByLabelText("Reader class")).toHaveValue("Contractor / Consultant"),
  );
}
it("loads active users and eligible approved documents and sends real IDs with UTC dates", async () => {
  const onSaved = vi.fn();
  const view = show(<GrantAccessForm onBusy={vi.fn()} onSaved={onSaved} />);
  await chooseRecipient();
  expect(getEligibleGrantDocuments).toHaveBeenCalledWith("david");
  fireEvent.click(screen.getByRole("combobox", { name: /Select documents/ }));
  fireEvent.click(await screen.findByRole("option", { name: /Site Safety Policy/ }));
  fireEvent.change(screen.getByLabelText(/Reason for access/), {
    target: { value: "Site safety training" },
  });
  fireEvent.submit(view.container.querySelector("form")!);
  await waitFor(() => expect(createAccessGrant).toHaveBeenCalledTimes(1));
  const body = vi.mocked(createAccessGrant).mock.calls[0]![0];
  expect(body).toMatchObject({
    user_id: "david",
    document_ids: ["safety"],
    reason: "Site safety training",
  });
  expect(body.start_date).toMatch(/Z$/);
  expect(body.expiry_date).toMatch(/Z$/);
  expect(body).not.toHaveProperty("granted_by");
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
});

it("enforces the selected reader class duration and retains values after backend failure", async () => {
  vi.mocked(getEligibleGrantDocuments).mockResolvedValue({
    reader_class: {
      _id: "contractor",
      class_name: "Contractor / Consultant",
      class_code: "CONTRACTOR_CONSULTANT",
    },
    max_grant_days: 7,
    documents: [
      {
        ...grant.documents[0]!,
        classification: "D2",
        family_name: "Safety",
        requires_ceo_approval: false,
      },
    ],
  });
  const view = show(<GrantAccessForm onBusy={vi.fn()} onSaved={vi.fn()} />);
  await chooseRecipient();
  fireEvent.click(screen.getByRole("combobox", { name: /Select documents/ }));
  fireEvent.click(await screen.findByRole("option", { name: /Site Safety Policy/ }));
  fireEvent.change(screen.getByLabelText(/Reason for access/), { target: { value: "Training" } });
  fireEvent.submit(view.container.querySelector("form")!);
  expect(await screen.findByText(/within 7 days/)).toBeInTheDocument();
  expect(createAccessGrant).not.toHaveBeenCalled();
  const date = new Date();
  date.setDate(date.getDate() + 3);
  const expiry = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  fireEvent.change(screen.getByLabelText(/Expiry date/), { target: { value: expiry } });
  vi.mocked(createAccessGrant).mockRejectedValue(new Error("Document eligibility changed"));
  fireEvent.submit(view.container.querySelector("form")!);
  expect(await screen.findByText("Document eligibility changed")).toBeInTheDocument();
  expect(screen.getByLabelText(/Reason for access/)).toHaveValue("Training");
  expect(screen.getByLabelText(/Expiry date/)).toHaveValue(expiry);
});
