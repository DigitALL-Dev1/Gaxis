import { createFileRoute } from "@tanstack/react-router";
import { VerifyLoginPage } from "@/components/lumen/VerifyLoginPage";

export const Route = createFileRoute("/verify-login")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : undefined,
  }),
  component: VerifyLoginRoute,
});

function VerifyLoginRoute() {
  const { token } = Route.useSearch();
  return <VerifyLoginPage token={token} />;
}
