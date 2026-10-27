import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { toast } from "sonner";
import { PageHeader, Panel } from "./common";
import {
  createRole,
  getRole,
  listRoles,
  updateRole,
  updateRoleStatus,
  type ApiRole,
} from "@/lib/lumen/roles-api";

export function RolesManagement() {
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<ApiRole | null>(null);
  const [viewed, setViewed] = useState<ApiRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRoles(await listRoles());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load roles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openForm(role: ApiRole | null) {
    setEditing(role);
    setName(role?.role_name ?? "");
    setCode(role?.role_code ?? "");
    setDescription(role?.description ?? "");
    setPermissions(role?.permissions.join("\n") ?? "");
    setFormError("");
    setOpened(true);
  }

  async function openRole(id: string, edit: boolean) {
    setBusyId(id);
    setActionError("");
    try {
      const role = await getRole(id);
      if (edit) openForm(role);
      else setViewed(role);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to load role details.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(role: ApiRole) {
    setBusyId(role._id);
    setActionError("");
    try {
      const saved = await updateRoleStatus(role._id, !role.is_active);
      setRoles((current) => current.map((entry) => (entry._id === saved._id ? saved : entry)));
      toast.success(saved.is_active ? "Role activated" : "Role deactivated");
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to update role status.");
    } finally {
      setBusyId(null);
    }
  }

  const busy = loading || saving || busyId !== null || opened || viewed !== null;

  return (
    <>
      <PageHeader
        crumb="Governance / Administration"
        title="Roles Management"
        description="Manage the roles and permissions available when assigning users."
      />
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          {roles.length} roles
        </Text>
        <Group>
          <Button variant="default" disabled={busy} onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button disabled={busy || !!error} onClick={() => openForm(null)}>
            Create role
          </Button>
        </Group>
      </Group>
      {error && (
        <Alert color="red" role="alert" mb="md" title="Unable to load roles">
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
          <Text>Loading roles…</Text>
        </Group>
      ) : (
        !error && (
          <Panel>
            {roles.length === 0 ? (
              <Text p="xl" ta="center" c="dimmed">
                No roles yet. Create the first role to get started.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={950}>
                <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      {[
                        "Role Name",
                        "Role Code",
                        "Description",
                        "Permissions",
                        "Status",
                        "Actions",
                      ].map((label) => (
                        <Table.Th key={label}>{label}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {roles.map((role) => (
                      <Table.Tr key={role._id}>
                        <Table.Td fw={500}>{role.role_name}</Table.Td>
                        <Table.Td>{role.role_code}</Table.Td>
                        <Table.Td>{role.description || "—"}</Table.Td>
                        <Table.Td>{role.permissions.join(", ") || "No permissions"}</Table.Td>
                        <Table.Td>
                          <Badge color={role.is_active ? "green" : "gray"}>
                            {role.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Button
                              size="xs"
                              variant="subtle"
                              disabled={busy}
                              onClick={() => void openRole(role._id, false)}
                            >
                              View
                            </Button>
                            <Button
                              size="xs"
                              variant="subtle"
                              disabled={busy}
                              onClick={() => void openRole(role._id, true)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color={role.is_active ? "red" : "green"}
                              disabled={busy}
                              onClick={() => void toggleStatus(role)}
                            >
                              {role.is_active ? "Deactivate" : "Activate"}
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
        title={editing ? "Edit role" : "Create role"}
        centered
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving) return;
            if (!name.trim() || !code.trim()) {
              setFormError("Enter a role name and role code.");
              return;
            }
            const details = {
              role_name: name.trim(),
              role_code: code.trim(),
              description: description.trim(),
              permissions: [
                ...new Set(
                  permissions
                    .split(/[\n,]/)
                    .map((value) => value.trim())
                    .filter(Boolean),
                ),
              ],
            };
            setSaving(true);
            setFormError("");
            try {
              const saved = editing
                ? await updateRole(editing._id, details)
                : await createRole(details);
              setRoles((current) => [...current.filter((entry) => entry._id !== saved._id), saved]);
              setOpened(false);
              toast.success(editing ? "Role updated" : "Role created");
              await refresh();
            } catch (cause) {
              setFormError(cause instanceof Error ? cause.message : "Unable to save role.");
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
              label="Role name"
              required
              value={name}
              disabled={saving}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <TextInput
              label="Role code"
              required
              value={code}
              disabled={saving}
              onChange={(event) => setCode(event.currentTarget.value)}
            />
            <Textarea
              label="Description"
              value={description}
              disabled={saving}
              onChange={(event) => setDescription(event.currentTarget.value)}
              autosize
              minRows={2}
            />
            <Textarea
              label="Permissions"
              description="Enter permission codes, one per line or separated by commas. Leave blank for no permissions."
              value={permissions}
              disabled={saving}
              onChange={(event) => setPermissions(event.currentTarget.value)}
              autosize
              minRows={3}
            />
            {!editing && (
              <Text size="xs" c="dimmed">
                New roles are active and available for user assignment.
              </Text>
            )}
            <Group justify="flex-end">
              <Button variant="default" disabled={saving} onClick={() => setOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? "Save changes" : "Create role"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Modal opened={viewed !== null} onClose={() => setViewed(null)} title="Role details" centered>
        {viewed && (
          <Stack gap="sm">
            <Text>
              <strong>Role Name:</strong> {viewed.role_name}
            </Text>
            <Text>
              <strong>Role Code:</strong> {viewed.role_code}
            </Text>
            <Text>
              <strong>Description:</strong> {viewed.description || "—"}
            </Text>
            <Text>
              <strong>Permissions:</strong> {viewed.permissions.join(", ") || "No permissions"}
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
