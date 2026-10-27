import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { toast } from "sonner";
import { PageHeader, Panel } from "./common";
import {
  createDocumentFamily,
  getDocumentFamily,
  loadDocumentFamilies,
  updateDocumentFamily,
  updateFamilyOwner,
  updateFamilyReleasers,
  updateFamilyStatus,
  type ApiDocumentFamily,
} from "@/lib/lumen/document-families-api";
import { listUsers, type ApiUser, type ApiRole } from "@/lib/lumen/users-api";
import { listRoles } from "@/lib/lumen/roles-api";

export function DocumentFamiliesManagement() {
  const [families, setFamilies] = useState<ApiDocumentFamily[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<ApiDocumentFamily | null>(null);
  const [viewed, setViewed] = useState<ApiDocumentFamily | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [releaserIds, setReleaserIds] = useState<string[]>([]);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [assignment, setAssignment] = useState<{
    family: ApiDocumentFamily;
    type: "owner" | "releasers" | "approvers";
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [familyData, userData, roleData] = await Promise.all([
        loadDocumentFamilies(),
        listUsers(),
        listRoles(),
      ]);
      setFamilies(familyData);
      setUsers(userData);
      setRoles(roleData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load document families.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const eligible = (roleCode: string) => {
    const ids = new Set(
      roles.filter((role) => role.is_active && role.role_code === roleCode).map((role) => role._id),
    );
    return users.filter(
      (user) => user.status.toUpperCase() === "ACTIVE" && user.role_ids.some((id) => ids.has(id)),
    );
  };
  const owners = eligible("DOCUMENT_OWNER");
  const releasers = eligible("DOCUMENT_RELEASER");
  const managers = users.filter((user) => {
    const activeRoles = roles.filter((role) => role.is_active && user.role_ids.includes(role._id));
    return (
      user.status.toUpperCase() === "ACTIVE" &&
      activeRoles.some((role) => ["MANAGER", "DIVISIONAL_MANAGER"].includes(role.role_code)) &&
      activeRoles.some((role) =>
        role.permissions.some((permission) =>
          ["access_grants.manage", "grants.manage"].includes(permission),
        ),
      )
    );
  });
  const options = (entries: ApiUser[]) =>
    entries.map((user) => ({ value: user._id, label: `${user.full_name} (${user.email})` }));
  const userName = (id: string | null) =>
    id ? (users.find((user) => user._id === id)?.full_name ?? "Unknown user") : "Unassigned";
  const busy =
    loading || saving || busyId !== null || opened || assignment !== null || viewed !== null;

  function openForm(family: ApiDocumentFamily | null) {
    setEditing(family);
    setFamilyCode(family?.family_code ?? "");
    setFamilyName(family?.family_name ?? "");
    setDescription(family?.description ?? "");
    setOwnerId(null);
    setReleaserIds([]);
    setFormError("");
    setOpened(true);
  }

  async function openFamily(
    id: string,
    mode: "view" | "edit" | "owner" | "releasers" | "approvers",
  ) {
    setBusyId(id);
    setActionError("");
    setFormError("");
    try {
      const family = await getDocumentFamily(id);
      if (mode === "view") setViewed(family);
      else if (mode === "edit") openForm(family);
      else {
        setOwnerId(
          owners.some((user) => user._id === family.owner_user_id) ? family.owner_user_id : null,
        );
        setReleaserIds(
          family.releaser_user_ids.filter((id) => releasers.some((user) => user._id === id)),
        );
        setApproverIds(family.grant_approver_user_ids ?? []);
        setAssignment({ family, type: mode });
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to load family details.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(family: ApiDocumentFamily) {
    setBusyId(family._id);
    setActionError("");
    try {
      const saved = await updateFamilyStatus(family._id, { is_active: !family.is_active });
      setFamilies((current) => current.map((entry) => (entry._id === saved._id ? saved : entry)));
      toast.success(saved.is_active ? "Family activated" : "Family deactivated");
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to update family status.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        crumb="Governance / Administration"
        title="Document Families"
        description="Manage document categories and assign responsible owners and authorised releasers."
      />
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          {families.length} document families
        </Text>
        <Group>
          <Button variant="default" disabled={busy} onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button disabled={busy || !!error} onClick={() => openForm(null)}>
            Create family
          </Button>
        </Group>
      </Group>
      {error && (
        <Alert color="red" role="alert" mb="md" title="Unable to load data">
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
          <Text>Loading document families…</Text>
        </Group>
      ) : (
        !error && (
          <Panel>
            {families.length === 0 ? (
              <Text p="xl" ta="center" c="dimmed">
                No document families yet. Create the first family to get started.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={1200}>
                <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      {[
                        "Family Name",
                        "Family Code",
                        "Description",
                        "Document Owner",
                        "Document Releasers",
                        "Status",
                        "Actions",
                      ].map((label) => (
                        <Table.Th key={label}>{label}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {families.map((family) => (
                      <Table.Tr key={family._id}>
                        <Table.Td fw={500}>{family.family_name}</Table.Td>
                        <Table.Td>{family.family_code}</Table.Td>
                        <Table.Td>{family.description || "—"}</Table.Td>
                        <Table.Td>{userName(family.owner_user_id)}</Table.Td>
                        <Table.Td>
                          {family.releaser_user_ids.map(userName).join(", ") || "Unassigned"}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={family.is_active ? "green" : "gray"}>
                            {family.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Button
                              size="xs"
                              variant="subtle"
                              disabled={busy}
                              onClick={() => void openFamily(family._id, "view")}
                            >
                              View
                            </Button>
                            <Button
                              size="xs"
                              variant="subtle"
                              disabled={busy}
                              onClick={() => void openFamily(family._id, "edit")}
                            >
                              Edit
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              disabled={busy}
                              onClick={() => void openFamily(family._id, "owner")}
                            >
                              Assign Owner
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              disabled={busy}
                              onClick={() => void openFamily(family._id, "releasers")}
                            >
                              Assign Releasers
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              disabled={busy}
                              onClick={() => void openFamily(family._id, "approvers")}
                            >
                              Assign Grant Approvers
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color={family.is_active ? "red" : "green"}
                              disabled={busy}
                              onClick={() => void toggleStatus(family)}
                            >
                              {family.is_active ? "Deactivate" : "Activate"}
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
        title={editing ? "Edit document family" : "Create document family"}
        centered
        size="lg"
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving) return;
            if (!familyCode.trim() || !familyName.trim()) {
              setFormError("Family code and name are required.");
              return;
            }
            setSaving(true);
            setFormError("");
            try {
              const details = { family_name: familyName.trim(), description: description.trim() };
              const saved = editing
                ? await updateDocumentFamily(editing._id, details)
                : await createDocumentFamily({
                    ...details,
                    family_code: familyCode.trim().toUpperCase(),
                    owner_user_id: ownerId,
                    releaser_user_ids: releaserIds,
                    is_active: true,
                  });
              setFamilies((current) => [
                ...current.filter((entry) => entry._id !== saved._id),
                saved,
              ]);
              setOpened(false);
              toast.success(editing ? "Document family updated" : "Document family created");
              await refresh();
            } catch (cause) {
              setFormError(cause instanceof Error ? cause.message : "Unable to save family.");
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
              label="Family Name"
              required
              maxLength={200}
              value={familyName}
              disabled={saving}
              onChange={(event) => setFamilyName(event.currentTarget.value)}
            />
            <TextInput
              label="Family Code"
              required
              maxLength={50}
              value={familyCode}
              disabled={saving}
              readOnly={editing !== null}
              description={
                editing
                  ? "Family codes cannot be changed after creation."
                  : "For example, HR, HSE or ENGINEERING."
              }
              onChange={(event) => setFamilyCode(event.currentTarget.value.toUpperCase())}
            />
            <Textarea
              label="Description"
              rows={3}
              maxLength={500}
              value={description}
              disabled={saving}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
            {editing ? (
              <Text size="sm" c="dimmed">
                Use Assign Owner and Assign Releasers to change responsibilities.
              </Text>
            ) : (
              <>
                <Select
                  label="Document Owner"
                  description="Optional. Active users with the Document Owner role."
                  searchable
                  clearable
                  data={options(owners)}
                  value={ownerId}
                  disabled={saving}
                  onChange={setOwnerId}
                />
                <MultiSelect
                  label="Document Releasers"
                  description="Optional. Select one or more active Document Releasers."
                  searchable
                  data={options(releasers)}
                  value={releaserIds}
                  disabled={saving}
                  onChange={setReleaserIds}
                />
              </>
            )}
            <Group justify="flex-end">
              <Button variant="default" disabled={saving} onClick={() => setOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? "Save changes" : "Create family"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Modal
        opened={assignment !== null}
        onClose={() => {
          if (!saving) setAssignment(null);
        }}
        title={
          assignment?.type === "approvers"
            ? "Assign Grant Approvers"
            : assignment?.type === "owner"
              ? "Assign Document Owner"
              : "Assign Document Releasers"
        }
        centered
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving || !assignment) return;
            setSaving(true);
            setFormError("");
            try {
              const saved =
                assignment.type === "approvers"
                  ? await updateDocumentFamily(assignment.family._id, {
                      grant_approver_user_ids: approverIds,
                    })
                  : assignment.type === "owner"
                    ? await updateFamilyOwner(assignment.family._id, { owner_user_id: ownerId })
                    : await updateFamilyReleasers(assignment.family._id, {
                        releaser_user_ids: releaserIds,
                      });
              setFamilies((current) =>
                current.map((entry) => (entry._id === saved._id ? saved : entry)),
              );
              setAssignment(null);
              toast.success("Family assignment updated");
              await refresh();
            } catch (cause) {
              setFormError(
                cause instanceof Error ? cause.message : "Unable to assign responsibility.",
              );
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
            <Text fw={500}>{assignment?.family.family_name}</Text>
            <Text size="sm" c="dimmed">
              Current assignment:{" "}
              {assignment?.type === "owner"
                ? userName(assignment.family.owner_user_id)
                : assignment?.type === "approvers"
                  ? assignment.family.grant_approver_user_ids?.map(userName).join(", ") ||
                    "Unassigned"
                  : assignment?.family.releaser_user_ids.map(userName).join(", ") || "Unassigned"}
            </Text>
            <Text size="xs" c="dimmed">
              Only active users with the matching active role are available. Saving replaces the
              current assignment.
            </Text>
            {assignment?.type === "approvers" ? (
              <MultiSelect
                label="Divisional Grant Approvers"
                description="Active managers with access grant management permission. CEO approval remains mandatory for sensitive families."
                searchable
                data={options(managers)}
                value={approverIds}
                onChange={setApproverIds}
                disabled={saving}
              />
            ) : assignment?.type === "owner" ? (
              <Select
                label="Document Owner"
                searchable
                clearable
                data={options(owners)}
                value={ownerId}
                disabled={saving}
                onChange={setOwnerId}
              />
            ) : (
              <MultiSelect
                label="Document Releasers"
                searchable
                data={options(releasers)}
                value={releaserIds}
                disabled={saving}
                onChange={setReleaserIds}
              />
            )}
            <Group justify="flex-end">
              <Button variant="default" disabled={saving} onClick={() => setAssignment(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save assignment
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Modal
        opened={viewed !== null}
        onClose={() => setViewed(null)}
        title="Document family details"
        centered
      >
        {viewed && (
          <Stack gap="sm">
            <Text>
              <strong>Family Name:</strong> {viewed.family_name}
            </Text>
            <Text>
              <strong>Family Code:</strong> {viewed.family_code}
            </Text>
            <Text>
              <strong>Description:</strong> {viewed.description || "—"}
            </Text>
            <Text>
              <strong>Document Owner:</strong> {userName(viewed.owner_user_id)}
            </Text>
            <Text>
              <strong>Document Releasers:</strong>{" "}
              {viewed.releaser_user_ids.map(userName).join(", ") || "Unassigned"}
            </Text>
            <Text>
              <strong>Grant Approvers:</strong>{" "}
              {viewed.grant_approver_user_ids?.map(userName).join(", ") || "Unassigned"}
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
