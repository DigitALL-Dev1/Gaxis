import { createFileRoute } from "@tanstack/react-router";
import { Button, Stack, Text } from "@mantine/core";
import { PageHeader, Panel, RoleGate } from "@/components/lumen/common";
import { useUserAuth, displayRole } from "@/lib/lumen/user-auth";
import { useAdminAuth } from "@/lib/lumen/admin-auth";

export const Route = createFileRoute("/profile")({
  component: () => (
    <RoleGate need="profile">
      <Profile />
    </RoleGate>
  ),
});

function Profile() {
  const user = useUserAuth((state) => state.user);
  const admin = useAdminAuth((state) => state.admin);
  return (
    <>
      <PageHeader title="My Profile" description={user ? displayRole(user) : "Administrator"} />
      <Panel>
        <Stack p="lg">
          <Text>
            <strong>Name:</strong> {admin?.name ?? user?.full_name}
          </Text>
          <Text>
            <strong>Email:</strong> {admin?.email ?? user?.email}
          </Text>
          {user && (
            <>
              <Text>
                <strong>Reader class:</strong> {user.reader_class.name}
              </Text>
              <Text>
                <strong>Permissions:</strong>{" "}
                {user.permissions.join(", ") || "No module permissions assigned"}
              </Text>
              <Button variant="default" onClick={() => void useUserAuth.getState().restore()}>
                Refresh profile and permissions
              </Button>
            </>
          )}
        </Stack>
      </Panel>
    </>
  );
}
