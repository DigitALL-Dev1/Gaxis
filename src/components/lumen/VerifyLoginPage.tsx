import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Alert, Button, Loader, Stack } from "@mantine/core";
import { resumeLoginVerification, useUserAuth } from "@/lib/lumen/user-auth";

export function VerifyLoginPage({ token: searchToken }: { token?: string }) {
  const [token] = useState(
    () =>
      searchToken ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.hash.slice(1)).get("token")
        : null),
  );
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    const auth = useUserAuth.getState();
    const verification = token ? auth.verifyToken(token) : resumeLoginVerification();
    // Preserve router history state while removing the one-time secret.
    window.history.replaceState(window.history.state, "", window.location.pathname);
    const signIn =
      verification ??
      auth.restore().then(() => {
        if (!useUserAuth.getState().user)
          throw new Error(
            "No login token provided. Open the complete link from your email or request a new sign-in link.",
          );
      });
    void signIn
      .then(() => {
        if (!active) return;
        void navigate({ to: "/dashboard", replace: true });
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Unable to verify this sign-in link.");
      });
    return () => {
      active = false;
    };
  }, [token, navigate]);
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <Stack maw={450} align="center">
        <h1 className="text-xl font-semibold">Sign in to Lumen</h1>
        {error ? (
          <>
            <Alert color="red" role="alert" title="Verification failed">
              {error}
            </Alert>
            <Button onClick={() => void navigate({ to: "/login", replace: true })}>
              Request a new login link
            </Button>
          </>
        ) : (
          <>
            <Loader />
            <p role="status">Verifying your sign-in link…</p>
          </>
        )}
      </Stack>
    </div>
  );
}
