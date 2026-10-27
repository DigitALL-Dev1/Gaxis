import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { toast } from "sonner";
import { PageHeader, Panel } from "./common";
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
  type EligibleDocuments,
} from "@/lib/lumen/access-grants-api";

function dateInput(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateInput(date);
}
function iso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}
const displayDate = (value: string) => new Date(value).toLocaleString();
const externalCodes = new Set([
  "CONTRACTOR",
  "CONSULTANT",
  "CONTRACTOR_CONSULTANT",
  "SUBCONTRACTOR",
  "EXTERNAL_REVIEWER",
]);
const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Unable to load or save access grants.";

export function GrantAccessForm({
  onSaved,
  onBusy,
}: {
  onSaved: () => void;
  onBusy: (value: boolean) => void;
}) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [options, setOptions] = useState<EligibleDocuments | null>(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [start, setStart] = useState(dateInput());
  const [expiry, setExpiry] = useState(addDays(dateInput(), 30));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [eligibleAttempt, setEligibleAttempt] = useState(0);
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [people, classes] = await Promise.all([listUsers(), listReaderClasses()]);
      const eligibleClasses = new Set(
        classes
          .filter(
            (reader) =>
              reader.is_active &&
              (externalCodes.has(reader.class_code) ||
                reader.requires_document_allowlist ||
                reader.access_basis === "NAMED_ALLOWLIST"),
          )
          .map((reader) => reader._id),
      );
      const activeClasses = new Set(
        classes.filter((reader) => reader.is_active).map((reader) => reader._id),
      );
      setUsers(
        people.filter(
          (person) =>
            person.status.toUpperCase() === "ACTIVE" &&
            activeClasses.has(person.reader_class_id) &&
            (eligibleClasses.has(person.reader_class_id) ||
              externalCodes.has(person.user_type ?? "")),
        ),
      );
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);
  useEffect(() => {
    let active = true;
    if (!userId) return;
    setEligibleLoading(true);
    void getEligibleGrantDocuments(userId)
      .then((result) => {
        if (active) setOptions(result);
      })
      .catch((cause) => {
        if (active) setError(message(cause));
      })
      .finally(() => {
        if (active) setEligibleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, eligibleAttempt]);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving || eligibleLoading || !options || !userId) return;
        setError("");
        if (!start || !expiry) {
          setError("Start and expiry dates are required.");
          return;
        }
        const days = (new Date(iso(expiry)).getTime() - new Date(iso(start)).getTime()) / 86400000;
        if (
          !reason.trim() ||
          !ids.length ||
          ids.some((id) => !options.documents.some((document) => document._id === id))
        ) {
          setError("Select eligible documents and enter a reason for access.");
          return;
        }
        if (
          !Number.isFinite(days) ||
          days <= 0 ||
          days > options.max_grant_days ||
          start < dateInput() ||
          new Date(iso(expiry)).getTime() <= Date.now()
        ) {
          setError(
            `Set a future expiry after the start date, within ${options.max_grant_days} days.`,
          );
          return;
        }
        setSaving(true);
        onBusy(true);
        try {
          await createAccessGrant({
            user_id: userId,
            document_ids: ids,
            reason: reason.trim(),
            start_date: iso(start),
            expiry_date: iso(expiry),
          });
          toast.success("Access request submitted for approval.");
          onSaved();
        } catch (cause) {
          setError(message(cause));
        } finally {
          setSaving(false);
          onBusy(false);
        }
      }}
    >
      <Stack>
        {error && (
          <Alert role="alert" color="red">
            {error}
          </Alert>
        )}
        {loading ? (
          <Loader aria-label="Loading grant options" />
        ) : (
          <>
            <Button variant="subtle" disabled={saving} onClick={() => void loadUsers()}>
              Reload users
            </Button>
            <Select
              label="Select user"
              required
              searchable
              clearable
              data={users.map((person) => ({
                value: person._id,
                label: `${person.full_name} (${person.email})`,
              }))}
              value={userId}
              disabled={saving}
              onChange={(value) => {
                setUserId(value);
                setOptions(null);
                setIds([]);
                setError("");
                setEligibleLoading(!!value);
              }}
            />
            <TextInput
              label="Reader class"
              value={options?.reader_class.class_name ?? ""}
              readOnly
            />
            {eligibleLoading && <Loader aria-label="Loading eligible documents" size="sm" />}
            {userId && !options && !eligibleLoading && (
              <Button
                variant="default"
                onClick={() => {
                  setError("");
                  setEligibleAttempt((value) => value + 1);
                }}
              >
                Retry eligible documents
              </Button>
            )}
            <MultiSelect
              label="Select documents"
              required
              searchable
              data={
                options?.documents.map((document) => ({
                  value: document._id,
                  label: `${document.title} (${document.reference})`,
                })) ?? []
              }
              value={ids}
              onChange={setIds}
              disabled={saving || !options || eligibleLoading}
            />
            {options && options.documents.length === 0 && (
              <Alert>No approved documents are eligible for this user.</Alert>
            )}
            {options?.documents.some(
              (document) => ids.includes(document._id) && document.requires_ceo_approval,
            ) && (
              <Alert color="orange">
                CEO approval is required for the selected sensitive documents.
              </Alert>
            )}
            <Textarea
              label="Reason for access"
              required
              maxLength={10000}
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
              disabled={saving}
            />
            <TextInput
              label="Start date"
              type="date"
              required
              min={dateInput()}
              value={start}
              onChange={(event) => setStart(event.currentTarget.value)}
              disabled={saving}
            />
            <TextInput
              label="Expiry date"
              type="date"
              required
              min={start ? addDays(start, 1) : dateInput()}
              max={start ? addDays(start, options?.max_grant_days ?? 90) : undefined}
              value={expiry}
              onChange={(event) => setExpiry(event.currentTarget.value)}
              disabled={saving}
            />
            <Text size="sm">
              Maximum {options?.max_grant_days ?? 90} days. Access begins only after the required
              disclosure approval and start date.
            </Text>
            <Button
              type="submit"
              loading={saving}
              disabled={!userId || !options || eligibleLoading || options.documents.length === 0}
            >
              Submit access request
            </Button>
          </>
        )}
      </Stack>
    </form>
  );
}

type Action = "view" | "approve" | "reject" | "revoke" | "renew";
export function AccessGrantsManagement() {
  const admin = useAdminAuth((state) => state.admin);
  const user = useUserAuth((state) => state.user);
  const canSelectUsers =
    !!admin ||
    !!user?.permissions.some((permission) =>
      ["users.read", "users.manage", "users.create", "users.update"].includes(permission),
    );
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usersError, setUsersError] = useState("");
  const [usersAttempt, setUsersAttempt] = useState(0);
  const [filterUser, setFilterUser] = useState<string | null>(null);
  const [expiring, setExpiring] = useState(false);
  const [create, setCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<{ id: string; mode: Action } | null>(null);
  const [record, setRecord] = useState<AccessGrant | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState(addDays(dateInput(), 30));
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const records = expiring
        ? await getExpiringGrants(7)
        : await listAccessGrants(filterUser ?? undefined);
      setGrants(
        filterUser && expiring ? records.filter((grant) => grant.user_id === filterUser) : records,
      );
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, [filterUser, expiring]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    let active = true;
    setUsersError("");
    if (canSelectUsers)
      void listUsers()
        .then((records) => {
          if (active) setUsers(records);
        })
        .catch((cause) => {
          if (active) setUsersError(message(cause));
        });
    return () => {
      active = false;
    };
  }, [canSelectUsers, usersAttempt]);
  useEffect(() => {
    let active = true;
    if (!selected) return;
    setDetailLoading(true);
    setActionError("");
    setRecord(null);
    setReason("");
    setExpiry(addDays(dateInput(), 30));
    void getAccessGrant(selected.id)
      .then((result) => {
        if (active) {
          setRecord(result);
          setExpiry(
            [
              addDays(dateInput(new Date(result.expiry_date)), 30),
              addDays(dateInput(), result.max_grant_days ?? 90),
            ].sort()[0]!,
          );
        }
      })
      .catch((cause) => {
        if (active) setActionError(message(cause));
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected]);
  const disabled = loading || saving || create || !!selected;
  async function act() {
    if (!record || !selected || saving) return;
    if (["reject", "revoke", "renew"].includes(selected.mode) && !reason.trim()) {
      setActionError("A reason is required.");
      return;
    }
    if (
      selected.mode === "renew" &&
      (!expiry ||
        new Date(iso(expiry)) <= new Date(record.expiry_date) ||
        (new Date(iso(expiry)).getTime() - Date.now()) / 86400000 > (record.max_grant_days ?? 90))
    ) {
      setActionError("Choose a later expiry within the permitted renewal period.");
      return;
    }
    setSaving(true);
    setActionError("");
    try {
      if (selected.mode === "approve") await approveAccessGrant(record._id);
      if (selected.mode === "reject") await rejectAccessGrant(record._id, reason.trim());
      if (selected.mode === "revoke") await revokeAccessGrant(record._id, reason.trim());
      if (selected.mode === "renew") await renewAccessGrant(record._id, iso(expiry), reason.trim());
      toast.success(
        selected.mode === "renew"
          ? "Renewal submitted for approval. Existing validity is unchanged."
          : "Access grant updated.",
      );
      setSelected(null);
      await refresh();
    } catch (cause) {
      setActionError(message(cause));
    } finally {
      setSaving(false);
    }
  }
  const capability =
    selected?.mode === "approve"
      ? record?.can_approve
      : selected?.mode === "reject"
        ? record?.can_reject
        : selected?.mode === "revoke"
          ? record?.can_revoke
          : record?.can_renew;
  return (
    <>
      <PageHeader
        crumb="Governance / External access"
        title="Access Grants Management"
        description="Document-specific requests, disclosure approval and time-limited access."
      />
      <Group justify="space-between" mb="md">
        <Group>
          <Button variant="default" disabled={disabled} onClick={() => void refresh()}>
            Refresh grants
          </Button>
          <Checkbox
            label="Expiring within 7 days"
            checked={expiring}
            disabled={disabled}
            onChange={(event) => setExpiring(event.currentTarget.checked)}
          />
        </Group>
        <Button disabled={disabled || !canSelectUsers} onClick={() => setCreate(true)}>
          Grant Access
        </Button>
      </Group>
      {!canSelectUsers && (
        <Text size="sm" mb="md">
          Searching users and creating requests requires users.read permission. Assigned approvers
          can review existing requests below.
        </Text>
      )}
      {usersError && (
        <Alert color="orange" role="alert">
          {usersError}
          <Button variant="subtle" onClick={() => setUsersAttempt((value) => value + 1)}>
            Retry users
          </Button>
        </Alert>
      )}
      {canSelectUsers && (
        <Select
          label="Filter by user"
          searchable
          clearable
          data={users.map((person) => ({ value: person._id, label: person.full_name }))}
          value={filterUser}
          onChange={setFilterUser}
          disabled={disabled}
          mb="md"
        />
      )}
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      {loading ? (
        <Loader aria-label="Loading access grants" />
      ) : (
        !error && (
          <Panel>
            {grants.length === 0 ? (
              <Text p="xl">No access grants match this view.</Text>
            ) : (
              <Table.ScrollContainer minWidth={1250}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      {[
                        "User Name",
                        "Reader Class",
                        "Documents",
                        "Granted By",
                        "Approval Status",
                        "Start Date",
                        "Expiry Date",
                        "Status",
                        "Actions",
                      ].map((label) => (
                        <Table.Th key={label}>{label}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {grants.map((grant) => (
                      <Table.Tr key={grant._id}>
                        <Table.Td>{grant.user_name}</Table.Td>
                        <Table.Td>{grant.reader_class_name}</Table.Td>
                        <Table.Td>
                          {grant.documents.map((document) => document.title).join(", ")}
                        </Table.Td>
                        <Table.Td>{grant.granted_by_name}</Table.Td>
                        <Table.Td>
                          <Badge color={grant.approval_status === "APPROVED" ? "green" : "yellow"}>
                            {grant.approval_status}
                          </Badge>
                          {grant.renewal && <Text size="xs">Renewal awaiting approval</Text>}
                          {grant.needs_reapproval && <Text size="xs">Fresh approval required</Text>}
                        </Table.Td>
                        <Table.Td>{displayDate(grant.start_date)}</Table.Td>
                        <Table.Td>{displayDate(grant.expiry_date)}</Table.Td>
                        <Table.Td>
                          <Badge color={grant.status === "ACTIVE" ? "green" : "gray"}>
                            {grant.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Button
                              size="xs"
                              variant="subtle"
                              disabled={disabled}
                              onClick={() => setSelected({ id: grant._id, mode: "view" })}
                            >
                              View
                            </Button>
                            {(
                              [
                                ["approve", grant.can_approve],
                                ["reject", grant.can_reject],
                                ["revoke", grant.can_revoke],
                                ["renew", grant.can_renew],
                              ] as const
                            ).map(
                              ([mode, allowed]) =>
                                allowed && (
                                  <Button
                                    key={mode}
                                    size="xs"
                                    variant="light"
                                    disabled={disabled}
                                    onClick={() => setSelected({ id: grant._id, mode })}
                                  >
                                    {mode[0]!.toUpperCase() + mode.slice(1)}
                                    {grant.renewal && ["approve", "reject"].includes(mode)
                                      ? " renewal"
                                      : ""}
                                  </Button>
                                ),
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Panel>
        )
      )}
      <Modal
        opened={create}
        onClose={() => {
          if (!saving) setCreate(false);
        }}
        title="Grant Access"
        size="lg"
        closeOnClickOutside={false}
        closeOnEscape={!saving}
        withCloseButton={!saving}
      >
        {create && (
          <GrantAccessForm
            onBusy={setSaving}
            onSaved={() => {
              setCreate(false);
              void refresh();
            }}
          />
        )}
      </Modal>
      <Modal
        opened={selected !== null}
        onClose={() => {
          if (!saving) setSelected(null);
        }}
        title={
          selected?.mode === "view"
            ? "Access grant details"
            : `Confirm ${selected?.mode ?? "action"}`
        }
        size="lg"
        closeOnClickOutside={false}
        closeOnEscape={!saving}
        withCloseButton={!saving}
      >
        <Stack>
          {detailLoading && <Loader aria-label="Loading grant details" />}
          {actionError && (
            <Alert color="red" role="alert">
              {actionError}
            </Alert>
          )}
          {record && (
            <>
              <Text fw={600}>
                {record.user_name} · {record.reader_class_name}
              </Text>
              <Text>
                {record.documents
                  .map((document) => `${document.title} (${document.reference})`)
                  .join(", ")}
              </Text>
              <Text>
                Approval: {record.approval_status} · Access: {record.status}
              </Text>
              <Text>
                Valid from {displayDate(record.start_date)} to {displayDate(record.expiry_date)}
              </Text>
              <Text>Requested by: {record.granted_by_name}</Text>
              <Text>Reason: {record.reason}</Text>
              <Text>Required approval: {record.approval_required}</Text>
              {record.approved_by_name && (
                <Text>
                  Approved by {record.approved_by_name}
                  {record.approved_at ? ` on ${displayDate(record.approved_at)}` : ""}
                </Text>
              )}
              {record.rejection_reason && <Text>Rejection reason: {record.rejection_reason}</Text>}
              {record.revocation_reason && (
                <Text>Revocation reason: {record.revocation_reason}</Text>
              )}
              {record.eligibility_error && <Alert color="orange">{record.eligibility_error}</Alert>}
              {record.renewal && (
                <Alert title="Renewal awaiting approval">
                  Requested by {record.renewal.requested_by_name}; proposed expiry{" "}
                  {displayDate(record.renewal.expiry_date)}. {record.renewal.reason} Existing
                  validity remains unchanged until approval.
                </Alert>
              )}
              {record.renewal_history?.map((renewal, index) => (
                <Text key={index}>
                  Renewal {renewal.approval_status}: {renewal.reason}
                  {renewal.rejection_reason ? ` · ${renewal.rejection_reason}` : ""}
                </Text>
              ))}
              {selected?.mode === "revoke" && (
                <Alert color="red">
                  Confirm revocation. This grant will stop providing access immediately.
                </Alert>
              )}
              {selected?.mode === "approve" && (
                <Alert>
                  Confirm that you authorise this disclosure under the required approval policy.
                </Alert>
              )}
              {selected?.mode === "renew" && (
                <>
                  <Text>
                    Renewal requires fresh disclosure approval. The current expiry stays in effect
                    until approval.
                  </Text>
                  <TextInput
                    type="date"
                    label="New expiry date"
                    required
                    value={expiry}
                    min={dateInput()}
                    max={addDays(dateInput(), record.max_grant_days ?? 90)}
                    onChange={(event) => setExpiry(event.currentTarget.value)}
                    disabled={saving}
                  />
                </>
              )}
              {selected && ["reject", "revoke", "renew"].includes(selected.mode) && (
                <Textarea
                  label="Reason"
                  required
                  maxLength={10000}
                  value={reason}
                  onChange={(event) => setReason(event.currentTarget.value)}
                  disabled={saving}
                />
              )}
              {selected?.mode !== "view" && (
                <Button
                  loading={saving}
                  disabled={!capability}
                  color={selected?.mode === "revoke" ? "red" : "blue"}
                  onClick={() => void act()}
                >
                  Confirm {selected?.mode}
                </Button>
              )}
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
