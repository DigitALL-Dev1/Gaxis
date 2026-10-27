import { useState } from "react";
import { Alert, Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { useEffect } from "react";
import { ArrowRight, BookOpen, Leaf, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useAdminAuth } from "@/lib/lumen/admin-auth";
import { useUserAuth } from "@/lib/lumen/user-auth";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("login") === "invalid")
      setError("This sign-in link is invalid, expired, or has already been used.");
  }, []);
  return (
    <div className={styles["page"]}>
      <aside className={styles["story"]}>
        <div className={styles["brand"]}>
          <div className={styles["brandMark"]}>
            <Leaf size={25} strokeWidth={1.6} />
          </div>
          <div>
            <div className={styles["brandName"]}>GREEN</div>
            <div className={styles["brandSub"]}>LIMITED</div>
          </div>
        </div>
        <div className={styles["pitch"]}>
          <div className={styles["eyebrow"]}>The GAXIS knowledge workspace</div>
          <h1>
            The right knowledge.
            <br />
            <span>Within reach.</span>
          </h1>
          <p>
            One place for the policies, standards and training that keep our people informed and our
            work moving forward.
          </p>
        </div>
        <div className={styles["footer"]}>
          <ShieldCheck size={15} />
          Part of the GAXIS platform Â· GREEN Limited
        </div>
      </aside>
      <main className={styles["main"]}>
        <div className={styles["topline"]}>Knowledge &amp; Document Access System</div>
        <div className={styles["form"]}>
          <div className={styles["module"]}>
            <BookOpen size={15} />
            GAXIS-Lumen
          </div>
          <h2>{adminMode ? "Administrator sign in" : "Sign in to Lumen"}</h2>
          <p className={styles["subtitle"]}>
            {adminMode
              ? "Use the temporary development administrator account."
              : "We’ll email you a secure, one-time sign-in link."}
          </p>
          {error && (
            <Alert color="red" mb="lg" title="Sign-in failed" role="alert">
              {error}
            </Alert>
          )}
          {message && (
            <Alert color="green" mb="lg" title="Check your email" role="status">
              {message}
            </Alert>
          )}
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              setMessage("");
              try {
                if (adminMode) {
                  await useAdminAuth.getState().signIn(email, password);
                  setPassword("");
                } else {
                  setMessage(await useUserAuth.getState().requestLink(email));
                }
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : "Unable to sign in. Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Stack gap="md">
              <TextInput
                label="Email address"
                type="email"
                autoComplete="username"
                required
                size="md"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                leftSection={<Mail size={16} />}
              />
              {adminMode && (
                <PasswordInput
                  label="Password"
                  autoComplete="current-password"
                  required
                  size="md"
                  maxLength={1024}
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                />
              )}
              <Button
                type="submit"
                fullWidth
                size="md"
                loading={busy}
                rightSection={<ArrowRight size={16} />}
              >
                {adminMode ? "Sign in" : "Email me a sign-in link"}
              </Button>
            </Stack>
          </form>
          {!adminMode && (
            <>
              <div className={styles["divider"]}>or</div>
              <Button fullWidth size="md" variant="default" disabled>
                Continue with Google Workspace
              </Button>
            </>
          )}
          <Button
            mt="md"
            variant="subtle"
            fullWidth
            onClick={() => {
              setAdminMode((value) => !value);
              setError("");
              setMessage("");
            }}
          >
            {adminMode ? "Back to user sign in" : "Administrator sign in"}
          </Button>
          <div className={styles["notice"]}>
            <LockKeyhole size={16} className="mt-0.5 shrink-0" />
            <span>
              Email links expire after 15 minutes and work once. Production authentication will be
              managed by GAXIS M1.
            </span>
          </div>
        </div>
        <footer className={styles["mainFooter"]}>
          GREEN Limited Â· GAXIS-Lumen Â· Authorised access only
        </footer>
      </main>
    </div>
  );
}
