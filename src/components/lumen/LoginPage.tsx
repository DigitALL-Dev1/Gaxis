import { useEffect, useState } from "react";
import { Alert, Button, Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  FileCheck2,
  Leaf,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Users,
  Loader2,
} from "lucide-react";
import { ROLES, ROLE_USERS, type Role } from "@/lib/lumen/data";
import { useDemoAuth, validateDemoIdentity, type LoginMethod } from "@/lib/lumen/auth";
import { useLumen } from "@/lib/lumen/store";
import styles from "./LoginPage.module.css";

type Stage = "login" | "sent" | "checking" | "verified";
function GoogleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4H3.1v2.6A10 10 0 0 0 12 22Z"
      />
      <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z" />
      <path
        fill="#EA4335"
        d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 6Z"
      />
    </svg>
  );
}

export function LoginPage() {
  const [stage, setStage] = useState<Stage>("login");
  const [email, setEmail] = useState("");
  const [sentAt, setSentAt] = useState(0);
  const [method, setMethod] = useState<LoginMethod>("Google Workspace");
  const [candidate, setCandidate] = useState("");
  const [error, setError] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceRole, setWorkspaceRole] = useState<string | null>("Employee");
  const [result, setResult] = useState<ReturnType<typeof validateDemoIdentity> | null>(null);
  const begin = (account: string, via: LoginMethod) => {
    setError("");
    setResult(null);
    setCandidate(account.trim().toLowerCase());
    setMethod(via);
    setStage("checking");
  };
  useEffect(() => {
    if (stage !== "checking") return;
    const timer = window.setTimeout(() => {
      const response = validateDemoIdentity(candidate, method, useLumen.getState().grants);
      if ("error" in response) {
        setError(response.error);
        setStage("login");
      } else {
        setResult(response);
        setStage("verified");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [stage, candidate, method]);
  const enterWorkspace = () => {
    if (method === "Email login link" && Date.now() - sentAt > 15 * 60 * 1000) {
      setError("Your demo link has expired. Request another link to continue.");
      setStage("login");
      return;
    }
    const checked = validateDemoIdentity(candidate, method, useLumen.getState().grants);
    if ("error" in checked) {
      setError(checked.error);
      setStage("login");
      return;
    }
    useLumen.getState().setRole(checked.identity.role);
    useLumen.getState().log("Demo Sign In", `GAXIS M1 Â· ${method}`, "â€”");
    useDemoAuth.getState().signIn(checked.identity, method);
  };
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
          <div className={styles["document"]}>
            <div className={styles["documentIcon"]}>
              <FileCheck2 size={24} strokeWidth={1.4} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                Trusted documents. Confident decisions.
              </div>
              <div style={{ fontSize: 11, color: "#accbbb", marginTop: 5 }}>
                Controlled versions Â· Clear responsibilities
              </div>
            </div>
            <CheckCircle2 size={17} color="#9de0b6" />
          </div>
        </div>
        <div className={styles["footer"]}>
          <ShieldCheck size={15} />
          Part of the GAXIS platform Â· GREEN Limited
        </div>
      </aside>
      <main className={styles["main"]}>
        <div className={styles["topline"]}>
          <span className="size-1.5 rounded-full bg-primary" />
          Knowledge & Document Access System
        </div>
        <div className={styles["form"]}>
          <div className={styles["module"]}>
            <BookOpen size={15} />
            GAXIS-Lumen
          </div>
          <h2>
            {stage === "sent"
              ? "Check your email"
              : stage === "checking"
                ? "Checking your access"
                : stage === "verified"
                  ? "You're ready to go"
                  : "Welcome to Lumen"}
          </h2>
          <p className={styles["subtitle"]}>
            {stage === "sent"
              ? "Your sign-in link is ready in this frontend demonstration."
              : stage === "checking" || stage === "verified"
                ? "GAXIS M1 Â· Identity & Permissions"
                : "Sign in to access your documents and continue your learning."}
          </p>
          {error && (
            <Alert color="red" mb="lg" title="Access could not be verified" role="alert">
              {error}
            </Alert>
          )}
          {stage === "login" && (
            <>
              <Button
                fullWidth
                size="md"
                variant="default"
                leftSection={<GoogleMark />}
                onClick={() => setWorkspaceOpen(true)}
              >
                Continue with Google
              </Button>
              <Text ta="center" size="xs" c="dimmed" mt={9}>
                For GREEN Google Workspace users
              </Text>
              <div className={styles["divider"]}>or use an email login link</div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setError("");
                  setSentAt(Date.now());
                  setStage("sent");
                }}
              >
                <Stack gap="md">
                  <TextInput
                    label="Email address"
                    placeholder="you@company.com"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.currentTarget.value)}
                    leftSection={<Mail size={16} />}
                    size="md"
                    autoComplete="email"
                  />
                  <Button type="submit" fullWidth size="md" rightSection={<ArrowRight size={16} />}>
                    Get a login link
                  </Button>
                </Stack>
              </form>
              <Text size="xs" c="dimmed" mt={10}>
                For other authorised users, including external reviewers.
              </Text>
              <details className="mt-5 rounded-lg border bg-white px-3 py-2.5 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium">
                  Explore with a demo account
                </summary>
                <Stack gap={6} mt="sm">
                  {ROLES.map((role) => (
                    <button
                      key={role}
                      className="rounded p-1.5 text-left hover:bg-muted"
                      onClick={() => {
                        setEmail(ROLE_USERS[role].email);
                        setError("");
                      }}
                    >
                      <span className="block font-medium text-foreground">{role}</span>
                      {ROLE_USERS[role].email}
                    </button>
                  ))}
                </Stack>
              </details>
            </>
          )}
          {stage === "sent" && (
            <Stack gap="lg">
              <div className="rounded-xl border bg-white p-5">
                <Mail className="mb-3 text-primary" size={28} />
                <Text size="sm">
                  Continue as <b>{email}</b>.
                </Text>
                <Text size="xs" c="dimmed" mt="sm">
                  No email has been sent. Use the button below to simulate opening the login link.
                  This demo link expires in 15 minutes.
                </Text>
              </div>
              <Button
                size="md"
                onClick={() => {
                  if (Date.now() - sentAt > 15 * 60 * 1000) {
                    setError("Your demo link has expired. Request a new one.");
                    setStage("login");
                  } else begin(email, "Email login link");
                }}
                rightSection={<ArrowRight size={16} />}
              >
                Open demo login link
              </Button>
              <Group justify="space-between">
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => setStage("login")}
                  leftSection={<ChevronLeft size={14} />}
                >
                  Change email
                </Button>
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    setSentAt(Date.now());
                    setError("");
                    toast.success("A fresh demo link is ready. It expires in 15 minutes.");
                  }}
                >
                  Create a fresh demo link
                </Button>
              </Group>
            </Stack>
          )}
          {(stage === "checking" || stage === "verified") && (
            <Stack gap="lg">
              <div
                aria-live="polite"
                aria-busy={stage === "checking"}
                className="rounded-xl border bg-white px-5 py-2"
              >
                {[
                  {
                    title: "Identity",
                    detail:
                      stage === "verified" && result && "identity" in result
                        ? result.identity.name
                        : candidate,
                    icon: Users,
                  },
                  {
                    title: "Role & permissions",
                    detail:
                      stage === "verified" && result && "identity" in result
                        ? `${result.identity.role} Â· ${result.modules} permitted modules`
                        : "Checking the demo M1 directory",
                    icon: ShieldCheck,
                  },
                  {
                    title: "Document access",
                    detail:
                      stage === "verified"
                        ? "Access rules applied to your workspace"
                        : "Validating document access rights",
                    icon: FileCheck2,
                  },
                ].map(({ title, detail, icon: Icon }) => (
                  <div className={styles["check"]} key={title}>
                    <Icon size={18} className="shrink-0 text-primary" />
                    <div className="flex-1">
                      <Text size="sm" fw={500}>
                        {title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {detail}
                      </Text>
                    </div>
                    {stage === "checking" ? (
                      <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    ) : (
                      <CheckCircle2 size={18} className="text-primary" />
                    )}
                  </div>
                ))}
              </div>
              <Button
                size="md"
                loading={stage === "checking"}
                onClick={enterWorkspace}
                rightSection={<ArrowRight size={16} />}
              >
                {stage === "checking"
                  ? "Validating access"
                  : result && "identity" in result && result.identity.role === "External Reviewer"
                    ? "Open permitted documents"
                    : "Continue to dashboard"}
              </Button>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => {
                  setStage("login");
                  setResult(null);
                }}
              >
                Use a different account
              </Button>
            </Stack>
          )}
          <div className={styles["notice"]}>
            <LockKeyhole size={16} className="mt-0.5 shrink-0" />
            <span>
              Frontend prototype. Google sign-in, email links and GAXIS M1 validation are simulated.
              No passwords or real authentication are used.
            </span>
          </div>
          <div className={styles["steps"]}>
            {stage === "login" || stage === "sent" ? <b>01 Sign in</b> : <span>01 Sign in</span>}
            <ArrowRight size={11} />
            {stage === "checking" || stage === "verified" ? (
              <b>02 Verify access</b>
            ) : (
              <span>02 Verify access</span>
            )}
            <ArrowRight size={11} />
            <span>03 Your workspace</span>
          </div>
        </div>
        <footer className={styles["mainFooter"]}>
          GREEN Limited Â· GAXIS-Lumen Â· Authorised access only
        </footer>
      </main>
      <Modal
        opened={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        title="Google Workspace Â· Demo account"
        centered
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Choose a GREEN account to simulate Google SSO. No connection to Google is made.
          </Text>
          <Select
            label="Workspace account"
            data={ROLES.filter((r) => r !== "External Reviewer").map((r) => ({
              value: r,
              label: `${ROLE_USERS[r].name} Â· ${r}`,
            }))}
            value={workspaceRole}
            onChange={setWorkspaceRole}
            allowDeselect={false}
          />
          <Button
            disabled={!workspaceRole}
            onClick={() => {
              if (!workspaceRole) return;
              setWorkspaceOpen(false);
              begin(ROLE_USERS[workspaceRole as Role].email, "Google Workspace");
            }}
          >
            Continue with demo account
          </Button>
        </Stack>
      </Modal>
    </div>
  );
}
