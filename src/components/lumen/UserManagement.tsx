import { useAdminAuth } from "@/lib/lumen/admin-auth";
import { useUserAuth } from "@/lib/lumen/user-auth";
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
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { toast } from "sonner";
import { PageHeader, Panel } from "./common";
import {
  createUser,
  getUser,
  loadUserManagement,
  updateUser,
  updateUserStatus,
  type ApiReaderClass,
  type ApiRole,
  type ApiUser,
} from "@/lib/lumen/users-api";

export function UserManagement() {
  const admin = useAdminAuth((state) => state.admin);
  const identity = useUserAuth((state) => state.user);
  const canAdd =
    !!admin ||
    !!identity?.permissions.some((permission) =>
      ["users.create", "users.manage"].includes(permission),
    );
  const canEdit =
    !!admin ||
    !!identity?.permissions.some((permission) =>
      ["users.update", "users.manage"].includes(permission),
    );
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [readerClasses, setReaderClasses] = useState<ApiReaderClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<string | null>(null);
  const [department, setDepartment] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [readerClassId, setReaderClassId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [viewedUser, setViewedUser] = useState<ApiUser | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadUserManagement();
      setUsers(data.users);
      setRoles(data.roles);
      setReaderClasses(data.readerClasses);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load user management.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openCreateForm() {
    setEditingUser(null);
    setFullName("");
    setEmail("");
    setUserType("EMPLOYEE");
    setDepartment("");
    setRoleIds([]);
    setReaderClassId(null);
    setFormError("");
    setOpened(true);
  }

  async function openUser(userId: string, edit: boolean) {
    setBusyUserId(userId);
    setActionError("");
    try {
      const user = await getUser(userId);
      if (!edit) {
        setViewedUser(user);
        return;
      }
      setEditingUser(user);
      setFullName(user.full_name);
      setEmail(user.email);
      setUserType(user.user_type ?? "EMPLOYEE");
      setDepartment(user.department ?? "");
      setRoleIds(user.role_ids);
      setReaderClassId(user.reader_class_id);
      setFormError("");
      setOpened(true);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to load user.");
    } finally {
      setBusyUserId(null);
    }
  }

  function replaceUser(user: ApiUser) {
    setUsers((current) => current.map((entry) => (entry._id === user._id ? user : entry)));
  }

  async function toggleStatus(user: ApiUser) {
    setBusyUserId(user._id);
    setActionError("");
    const status = user.status.toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      replaceUser(await updateUserStatus(user._id, status));
      toast.success(status === "ACTIVE" ? "User activated" : "User deactivated");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to update user status.");
    } finally {
      setBusyUserId(null);
    }
  }

  const activeRoles = roles.filter((role) => role.is_active);
  const activeClasses = readerClasses.filter((readerClass) => readerClass.is_active);
  const canCreate =
    canAdd && !loading && !error && activeRoles.length > 0 && activeClasses.length > 0;
  const selectedClass = readerClasses.find((readerClass) => readerClass._id === readerClassId);

  return (
    <>
      <PageHeader
        crumb="Governance / Administration"
        title="User Management"
        description="View and manage users, their roles, reader classes and account status."
      />
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          {users.length} users · {roles.length} roles · {readerClasses.length} reader classes
        </Text>
        <Group>
          <Button
            variant="default"
            onClick={() => void refresh()}
            disabled={loading || busyUserId !== null || saving}
          >
            Refresh
          </Button>
          {canAdd && (
            <Button onClick={openCreateForm} disabled={!canCreate || busyUserId !== null}>
              Create user
            </Button>
          )}
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
          <Text>Loading users and permissions…</Text>
        </Group>
      ) : error ? null : (
        <Panel>
          <Tabs defaultValue="users">
            <Tabs.List>
              <Tabs.Tab value="users">Users</Tabs.Tab>
              <Tabs.Tab value="roles">Roles</Tabs.Tab>
              <Tabs.Tab value="classes">Reader Classes</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="users">
              {users.length === 0 ? (
                <Text p="xl" ta="center" c="dimmed">
                  No users yet. Create the first user to get started.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={850}>
                  <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        {["Name", "Email", "Roles", "Reader Class", "Status", "Actions"].map(
                          (title) => (
                            <Table.Th key={title}>{title}</Table.Th>
                          ),
                        )}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {users.map((user) => (
                        <Table.Tr key={user._id}>
                          <Table.Td fw={500}>{user.full_name}</Table.Td>
                          <Table.Td>{user.email}</Table.Td>
                          <Table.Td>
                            {user.role_ids
                              .map(
                                (id) =>
                                  roles.find((role) => role._id === id)?.role_name ?? "Unknown",
                              )
                              .join(", ")}
                          </Table.Td>
                          <Table.Td>
                            {readerClasses.find(
                              (readerClass) => readerClass._id === user.reader_class_id,
                            )?.class_name ?? "Unknown"}
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={
                                user.status.toUpperCase() === "ACTIVE" || user.status === "active"
                                  ? "green"
                                  : "gray"
                              }
                            >
                              {user.status.toUpperCase() === "ACTIVE"
                                ? "Active"
                                : user.status.toUpperCase() === "INACTIVE"
                                  ? "Inactive"
                                  : "Pending"}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs" wrap="nowrap">
                              <Button
                                size="xs"
                                variant="subtle"
                                disabled={busyUserId !== null}
                                onClick={() => void openUser(user._id, false)}
                              >
                                View
                              </Button>
                              {canEdit && (
                                <>
                                  <Button
                                    size="xs"
                                    variant="subtle"
                                    disabled={busyUserId !== null}
                                    onClick={() => void openUser(user._id, true)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="light"
                                    color={user.status.toUpperCase() === "ACTIVE" ? "red" : "green"}
                                    disabled={busyUserId !== null}
                                    onClick={() => void toggleStatus(user)}
                                  >
                                    {user.status.toUpperCase() === "ACTIVE"
                                      ? "Deactivate"
                                      : "Activate"}
                                  </Button>
                                </>
                              )}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Tabs.Panel>
            <Tabs.Panel value="roles">
              <Table.ScrollContainer minWidth={700}>
                <Table verticalSpacing="md" horizontalSpacing="lg">
                  <Table.Thead>
                    <Table.Tr>
                      {["Role", "Code", "Permissions", "Status"].map((title) => (
                        <Table.Th key={title}>{title}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {roles.map((role) => (
                      <Table.Tr key={role._id}>
                        <Table.Td fw={500}>{role.role_name}</Table.Td>
                        <Table.Td>{role.role_code}</Table.Td>
                        <Table.Td>{role.permissions.join(", ")}</Table.Td>
                        <Table.Td>
                          <Badge color={role.is_active ? "green" : "gray"}>
                            {role.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Tabs.Panel>
            <Tabs.Panel value="classes">
              <Table.ScrollContainer minWidth={750}>
                <Table verticalSpacing="md" horizontalSpacing="lg">
                  <Table.Thead>
                    <Table.Tr>
                      {["Reader class", "Access basis", "Classifications", "Expiry", "Status"].map(
                        (title) => (
                          <Table.Th key={title}>{title}</Table.Th>
                        ),
                      )}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {readerClasses.map((readerClass) => (
                      <Table.Tr key={readerClass._id}>
                        <Table.Td fw={500}>{readerClass.class_name}</Table.Td>
                        <Table.Td>{readerClass.access_basis.replaceAll("_", " ")}</Table.Td>
                        <Table.Td>{readerClass.allowed_classifications.join(", ")}</Table.Td>
                        <Table.Td>
                          {readerClass.requires_expiry
                            ? `Up to ${readerClass.max_grant_days} days`
                            : "No fixed expiry"}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={readerClass.is_active ? "green" : "gray"}>
                            {readerClass.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              <Text p="md" size="xs" c="dimmed">
                Reader classes define eligibility. Access to individual documents is granted
                separately.
              </Text>
            </Tabs.Panel>
          </Tabs>
          {(!activeRoles.length || !activeClasses.length) && (
            <Alert color="yellow" m="md">
              Activate at least one role and reader class before creating users.
            </Alert>
          )}
        </Panel>
      )}
      <Modal
        opened={opened}
        onClose={() => {
          if (!saving) setOpened(false);
        }}
        title={editingUser ? "Edit user" : "Create user"}
        centered
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving) return;
            if (
              !fullName.trim() ||
              !email.trim() ||
              !userType ||
              !roleIds.length ||
              !readerClassId
            ) {
              setFormError(
                "Enter a name and email, and select at least one role and a reader class.",
              );
              return;
            }
            setSaving(true);
            setFormError("");
            try {
              const details = {
                full_name: fullName.trim(),
                email: email.trim().toLowerCase(),
                user_type: userType,
                department: department.trim(),
              };
              const user = editingUser
                ? await updateUser(editingUser._id, {
                    ...details,
                    ...(JSON.stringify([...roleIds].sort()) !==
                    JSON.stringify([...editingUser.role_ids].sort())
                      ? { role_ids: roleIds }
                      : {}),
                    ...(readerClassId !== editingUser.reader_class_id
                      ? { reader_class_id: readerClassId }
                      : {}),
                  })
                : await createUser({
                    ...details,
                    role_ids: roleIds,
                    reader_class_id: readerClassId,
                  });
              setUsers((current) =>
                [...current.filter((entry) => entry._id !== user._id), user].sort((a, b) =>
                  a.full_name.localeCompare(b.full_name),
                ),
              );
              setOpened(false);
              toast.success(editingUser ? "User updated" : "User created");
            } catch (cause) {
              setFormError(cause instanceof Error ? cause.message : "Unable to save user.");
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
              label="Full name"
              required
              maxLength={200}
              value={fullName}
              onChange={(event) => setFullName(event.currentTarget.value)}
            />
            <TextInput
              label="Email address"
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
            <Select
              label="User type"
              required
              searchable
              data={[
                { value: "EMPLOYEE", label: "Employee" },
                { value: "CONTRACTOR", label: "Contractor" },
                { value: "CONSULTANT", label: "Consultant" },
                { value: "SUBCONTRACTOR", label: "Subcontractor" },
                { value: "EXTERNAL_REVIEWER", label: "External Reviewer" },
              ]}
              value={userType}
              onChange={setUserType}
            />
            <TextInput
              label="Department"
              description="Optional (e.g., HR, Engineering, HSE)"
              maxLength={100}
              value={department}
              onChange={(event) => setDepartment(event.currentTarget.value)}
            />
            <MultiSelect
              label="Roles"
              required
              searchable
              data={roles
                .filter((role) => role.is_active || roleIds.includes(role._id))
                .map((role) => ({
                  value: role._id,
                  label: role.role_name,
                  disabled: !role.is_active,
                }))}
              value={roleIds}
              onChange={setRoleIds}
            />
            <Select
              label="Reader class"
              required
              searchable
              data={readerClasses
                .filter((readerClass) => readerClass.is_active || readerClass._id === readerClassId)
                .map((readerClass) => ({
                  value: readerClass._id,
                  label: readerClass.class_name,
                  disabled: !readerClass.is_active,
                }))}
              value={readerClassId}
              onChange={setReaderClassId}
            />
            {selectedClass?.requires_document_allowlist && (
              <Text size="xs" c="dimmed">
                This reader needs a separate document access grant
                {selectedClass.requires_expiry
                  ? ` lasting at most ${selectedClass.max_grant_days} days`
                  : ""}
                .
              </Text>
            )}
            {!editingUser && (
              <Text size="xs" c="dimmed">
                User will be created with ACTIVE status. They can request a login link via email.
              </Text>
            )}
            <Group justify="flex-end">
              <Button variant="default" disabled={saving} onClick={() => setOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editingUser ? "Save changes" : "Create user"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Modal
        opened={viewedUser !== null}
        onClose={() => setViewedUser(null)}
        title="User details"
        centered
      >
        {viewedUser && (
          <Stack gap="sm">
            <Text>
              <strong>Name:</strong> {viewedUser.full_name}
            </Text>
            <Text>
              <strong>Email:</strong> {viewedUser.email}
            </Text>
            <Text>
              <strong>Roles:</strong>{" "}
              {viewedUser.role_ids
                .map((id) => roles.find((role) => role._id === id)?.role_name ?? "Unknown")
                .join(", ")}
            </Text>
            <Text>
              <strong>Reader Class:</strong>{" "}
              {readerClasses.find((readerClass) => readerClass._id === viewedUser.reader_class_id)
                ?.class_name ?? "Unknown"}
            </Text>
            <Text>
              <strong>Department:</strong> {viewedUser.department || "—"}
            </Text>
            <Text>
              <strong>Status:</strong>{" "}
              {viewedUser.status.toUpperCase() === "ACTIVE"
                ? "Active"
                : viewedUser.status.toUpperCase() === "INACTIVE"
                  ? "Inactive"
                  : "Pending"}
            </Text>
          </Stack>
        )}
      </Modal>
    </>
  );
}
