import { beforeEach, describe, expect, it } from "vitest";
import { useDemoAuth, validateDemoIdentity } from "@/lib/lumen/auth";
import { ROLE_USERS, SEED_GRANTS } from "@/lib/lumen/data";

const now = new Date("2026-10-19T12:00:00Z");
beforeEach(() => {
  useDemoAuth.getState().signOut();
});

describe("Demo M1 identity validation", () => {
  it("resolves a workspace account and its actual configured role", () => {
    const result = validateDemoIdentity(
      "  BILAL.AHMED@GREEN.COM  ",
      "Google Workspace",
      SEED_GRANTS,
      now,
    );
    expect(result).toMatchObject({
      identity: { role: "Employee", name: "Bilal Ahmed" },
      modules: 4,
    });
  });
  it("does not authorise an unknown account just because its domain matches", () => {
    expect(
      validateDemoIdentity("unknown@green.com", "Google Workspace", SEED_GRANTS, now),
    ).toHaveProperty("error");
  });
  it("allows an external reviewer through email with an active grant", () => {
    expect(
      validateDemoIdentity(
        ROLE_USERS["External Reviewer"].email,
        "Email login link",
        SEED_GRANTS,
        now,
      ),
    ).toMatchObject({ identity: { role: "External Reviewer" }, modules: 1 });
  });
  it("requires external reviewers to use the email flow", () => {
    expect(
      validateDemoIdentity(
        ROLE_USERS["External Reviewer"].email,
        "Google Workspace",
        SEED_GRANTS,
        now,
      ),
    ).toHaveProperty("error");
  });
  it.each(["revoked", "expired", "scheduled", "empty"])(
    "denies external access with a %s grant",
    (condition) => {
      const grant = {
        ...SEED_GRANTS[0]!,
        revoked: condition === "revoked",
        expiry: condition === "expired" ? "2026-01-01" : "2026-12-15",
        start: condition === "scheduled" ? "2026-12-01" : "2026-09-20",
        docIds: condition === "empty" ? [] : ["doc-004"],
      };
      expect(
        validateDemoIdentity(
          ROLE_USERS["External Reviewer"].email,
          "Email login link",
          [grant],
          now,
        ),
      ).toHaveProperty("error");
    },
  );
});

describe("Demo session", () => {
  it("starts signed out and supports sign in and sign out", () => {
    expect(useDemoAuth.getState().session).toBeNull();
    useDemoAuth.getState().signIn({ ...ROLE_USERS.Employee, role: "Employee" }, "Google Workspace");
    expect(useDemoAuth.getState().session).toMatchObject({
      email: ROLE_USERS.Employee.email,
      role: "Employee",
      method: "Google Workspace",
    });
    useDemoAuth.getState().signOut();
    expect(useDemoAuth.getState().session).toBeNull();
    expect(
      JSON.parse(sessionStorage.getItem("gaxis-lumen-demo-session")!).state.session,
    ).toBeNull();
  });
});
