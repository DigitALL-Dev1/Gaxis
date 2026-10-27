import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { toast } from "sonner";
import { PageHeader, Panel } from "./common";
import {
  createReaderClass,
  getReaderClass,
  listReaderClasses,
  updateReaderClass,
  updateReaderClassStatus,
  type ApiReaderClass,
} from "@/lib/lumen/reader-classes-api";

const accessOptions = [
  { value: "ROLE_DEFAULT", label: "Role Default" },
  { value: "NAMED_ALLOWLIST", label: "Named Allowlist" },
  { value: "ADMIN_APPOINTMENT", label: "Admin Appointment" },
];
function accessLabel(value: string) {
  return accessOptions.find((option) => option.value === value)?.label ?? value;
}

export function ReaderClassesManagement() {
  const [classes, setClasses] = useState<ApiReaderClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<ApiReaderClass | null>(null);
  const [viewed, setViewed] = useState<ApiReaderClass | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [basis, setBasis] = useState<string | null>("ROLE_DEFAULT");
  const [allowlist, setAllowlist] = useState(false);
  const [expiry, setExpiry] = useState(false);
  const [maxDays, setMaxDays] = useState<number | string>(90);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setClasses(await listReaderClasses());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load reader classes.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openForm(readerClass: ApiReaderClass | null) {
    setEditing(readerClass);
    setName(readerClass?.class_name ?? "");
    setCode(readerClass?.class_code ?? "");
    setDescription(readerClass?.description ?? "");
    setBasis(readerClass?.access_basis ?? "ROLE_DEFAULT");
    setAllowlist(readerClass?.requires_document_allowlist ?? false);
    setExpiry(readerClass?.requires_expiry ?? false);
    setMaxDays(readerClass?.max_grant_days ?? 90);
    setFormError("");
    setOpened(true);
  }

  async function openClass(id: string, edit: boolean) {
    setBusyId(id);
    setActionError("");
    try {
      const readerClass = await getReaderClass(id);
      if (edit) openForm(readerClass);
      else setViewed(readerClass);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Unable to load reader class details.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(readerClass: ApiReaderClass) {
    setBusyId(readerClass._id);
    setActionError("");
    try {
      const saved = await updateReaderClassStatus(readerClass._id, !readerClass.is_active);
      setClasses((current) => current.map((entry) => (entry._id === saved._id ? saved : entry)));
      toast.success(saved.is_active ? "Reader class activated" : "Reader class deactivated");
      await refresh();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Unable to update reader class status.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const busy = loading || saving || busyId !== null || opened || viewed !== null;
  return (
    <>
      <PageHeader
        crumb="Governance / Administration"
        title="Reader Classes Management"
        description="Manage reader eligibility, document allowlists and access expiry rules."
      />
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          {classes.length} reader classes
        </Text>
        <Group>
          <Button variant="default" disabled={busy} onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button disabled={busy || !!error} onClick={() => openForm(null)}>
            Create reader class
          </Button>
        </Group>
      </Group>
      {error && (
        <Alert color="red" role="alert" mb="md" title="Unable to load reader classes">
          {error}
        </Alert>
      )}
      {actionError && (
        <Alert color="red" role="alert" mb="md">
          {actionError}
        </Alert>
      )}
      {loading ? (
        <Group justify="center" py="xl" role="status">
          <Loader size="sm" />
          <Text>Loading reader classes…</Text>
        </Group>
      ) : (
        !error && (
          <Panel>
            {classes.length === 0 ? (
              <Text p="xl" ta="center" c="dimmed">
                No reader classes yet. Create the first reader class to get started.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={1200}>
                <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      {[
                        "Class Name",
                        "Class Code",
                        "Access Basis",
                        "Document Allowlist Required",
                        "Expiry Required",
                        "Maximum Grant Days",
                        "Status",
                        "Actions",
                      ].map((label) => (
                        <Table.Th key={label}>{label}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {classes.map((readerClass) => (
                      <Table.Tr key={readerClass._id}>
                        <Table.Td fw={500}>{readerClass.class_name}</Table.Td>
                        <Table.Td>{readerClass.class_code}</Table.Td>
                        <Table.Td>{accessLabel(readerClass.access_basis)}</Table.Td>
                        <Table.Td>
                          {readerClass.requires_document_allowlist ? "Yes" : "No"}
                        </Table.Td>
                        <Table.Td>{readerClass.requires_expiry ? "Yes" : "No"}</Table.Td>
                        <Table.Td>{readerClass.max_grant_days ?? "No fixed expiry"}</Table.Td>
                        <Table.Td>
                          <Badge color={readerClass.is_active ? "green" : "gray"}>
                            {readerClass.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Button
                              size="xs"
                              variant="subtle"
                              disabled={busy}
                              onClick={() => void openClass(readerClass._id, false)}
                            >
                              View
                            </Button>
                            <Button
                              size="xs"
                              variant="subtle"
                              disabled={busy}
                              onClick={() => void openClass(readerClass._id, true)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color={readerClass.is_active ? "red" : "green"}
                              disabled={busy}
                              onClick={() => void toggleStatus(readerClass)}
                            >
                              {readerClass.is_active ? "Deactivate" : "Activate"}
                            </Button>
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
        opened={opened}
        onClose={() => {
          if (!saving) setOpened(false);
        }}
        title={editing ? "Edit reader class" : "Create reader class"}
        centered
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving) return;
            if (!name.trim() || !code.trim() || !basis) {
              setFormError("Enter a class name, class code and access basis.");
              return;
            }
            if (
              expiry &&
              (typeof maxDays !== "number" ||
                !Number.isInteger(maxDays) ||
                maxDays < 1 ||
                maxDays > 90)
            ) {
              setFormError("Maximum grant days must be a whole number between 1 and 90.");
              return;
            }
            const details = {
              class_name: name.trim(),
              description: description.trim(),
              access_basis: basis,
              requires_document_allowlist: allowlist,
              requires_expiry: expiry,
              max_grant_days: expiry ? Number(maxDays) : null,
            };
            setSaving(true);
            setFormError("");
            try {
              const saved = editing
                ? await updateReaderClass(editing._id, details)
                : await createReaderClass({ ...details, class_code: code.trim() });
              setClasses((current) => [
                ...current.filter((entry) => entry._id !== saved._id),
                saved,
              ]);
              setOpened(false);
              toast.success(editing ? "Reader class updated" : "Reader class created");
              await refresh();
            } catch (cause) {
              setFormError(cause instanceof Error ? cause.message : "Unable to save reader class.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <Stack>
            {formError && (
              <Alert color="red" role="alert">
                {formError}
              </Alert>
            )}
            <TextInput
              label="Class name"
              required
              value={name}
              disabled={saving}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <TextInput
              label="Class code"
              required
              value={code}
              disabled={saving}
              readOnly={editing !== null}
              description={
                editing
                  ? "Class codes cannot be changed after creation."
                  : "For example, EMPLOYEE or SUBCONTRACTOR."
              }
              onChange={(event) => setCode(event.currentTarget.value)}
            />
            <TextInput
              label="Description"
              value={description}
              disabled={saving}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
            <Select
              label="Access basis"
              required
              data={accessOptions}
              value={basis}
              disabled={saving}
              onChange={setBasis}
            />
            <Checkbox
              label="Document allowlist required"
              checked={allowlist}
              disabled={saving}
              onChange={(event) => setAllowlist(event.currentTarget.checked)}
            />
            <Checkbox
              label="Expiry required"
              checked={expiry}
              disabled={saving}
              onChange={(event) => setExpiry(event.currentTarget.checked)}
            />
            <NumberInput
              label="Maximum grant days"
              description="External reader grants can last up to 90 days."
              value={expiry ? maxDays : ""}
              onChange={setMaxDays}
              disabled={saving || !expiry}
              required={expiry}
              min={1}
              max={90}
              allowDecimal={false}
              allowNegative={false}
            />
            <Group justify="flex-end">
              <Button variant="default" disabled={saving} onClick={() => setOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? "Save changes" : "Create reader class"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Modal
        opened={viewed !== null}
        onClose={() => setViewed(null)}
        title="Reader class details"
        centered
      >
        {viewed && (
          <Stack gap="sm">
            <Text>
              <strong>Class Name:</strong> {viewed.class_name}
            </Text>
            <Text>
              <strong>Class Code:</strong> {viewed.class_code}
            </Text>
            <Text>
              <strong>Description:</strong> {viewed.description || "—"}
            </Text>
            <Text>
              <strong>Access Basis:</strong> {accessLabel(viewed.access_basis)}
            </Text>
            <Text>
              <strong>Document Allowlist Required:</strong>{" "}
              {viewed.requires_document_allowlist ? "Yes" : "No"}
            </Text>
            <Text>
              <strong>Expiry Required:</strong> {viewed.requires_expiry ? "Yes" : "No"}
            </Text>
            <Text>
              <strong>Maximum Grant Days:</strong> {viewed.max_grant_days ?? "No fixed expiry"}
            </Text>
            <Text>
              <strong>Allowed Classifications:</strong>{" "}
              {viewed.allowed_classifications.join(", ") || "None"}
            </Text>
            <Text>
              <strong>Excluded Families:</strong> {viewed.excluded_families.join(", ") || "None"}
            </Text>
            <Text>
              <strong>Status:</strong> {viewed.is_active ? "Active" : "Inactive"}
            </Text>
          </Stack>
        )}
      </Modal>
    </>
  );
}
