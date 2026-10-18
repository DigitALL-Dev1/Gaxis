import { beforeEach, describe, expect, it } from "vitest";
import { useLumen, grantStatus } from "@/lib/lumen/store";
import { visibleDocs } from "@/lib/lumen/access";
import { SEED_GRANTS } from "@/lib/lumen/data";

beforeEach(() => {
  useLumen.getState().reset();
  useLumen.getState().setRole("Administrator");
});

describe("Publication workflow", () => {
  it("blocks self-release and lets another releaser publish and supersede", () => {
    const state = useLumen.getState();
    const previous = state.docs.find((d) => d.id === "doc-001")!;
    const next = state.prepare({ ...previous, version: "4.1" });
    expect(state.release(next.id).ok).toBe(false);
    state.setRole("Releaser");
    expect(state.release(next.id).ok).toBe(true);
    expect(useLumen.getState().docs.find((d) => d.id === previous.id)?.status).toBe("Superseded");
    expect(useLumen.getState().docs.find((d) => d.id === next.id)?.status).toBe(
      "Approved & Current",
    );
    expect(useLumen.getState().audit.some((a) => a.action === "Document Superseded")).toBe(true);
  });
  it("keeps acknowledgement attached to a specific document version", () => {
    const state = useLumen.getState();
    state.acknowledge("doc-003");
    expect(useLumen.getState().assignments.find((a) => a.docId === "doc-003")?.acknowledged).toBe(
      true,
    );
    expect(
      useLumen.getState().assignments.find((a) => a.docId === "doc-015")?.acknowledged,
    ).toBeUndefined();
  });
  it("returns a submission and records the correction note", () => {
    const state = useLumen.getState();
    expect(state.returnDoc("doc-016", "Add a review date").ok).toBe(true);
    expect(useLumen.getState().docs.find((d) => d.id === "doc-016")?.returnNote).toBe(
      "Add a review date",
    );
  });
});

describe("External grants", () => {
  it("rejects grants longer than 90 days", () => {
    const state = useLumen.getState();
    const count = state.grants.length;
    state.addGrant({ ...SEED_GRANTS[0]!, start: "2026-01-01", expiry: "2026-12-31" });
    expect(useLumen.getState().grants).toHaveLength(count);
  });
  it("excludes scheduled and revoked grants from external visibility", () => {
    const state = useLumen.getState();
    const grant = { ...SEED_GRANTS[0]!, start: "2099-01-01", expiry: "2099-02-01" };
    expect(grantStatus(grant, new Date("2026-10-18"))).toBe("Scheduled");
    expect(visibleDocs("External Reviewer", state.docs, [grant])).toHaveLength(0);
    expect(
      visibleDocs("External Reviewer", state.docs, [{ ...grant, revoked: true }]),
    ).toHaveLength(0);
  });
});
