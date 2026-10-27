import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it.each(["/me", "/media", "/manage/team", "/admin/audit"])(
    "does not register the retired demo route %s",
    (path) => {
      const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
      expect(router.matchRoutes(path).at(-1)?.routeId).toBe(rootRouteId);
    },
  );
  it.each([
    "/login",
    "/dashboard",
    "/library",
    "/admin/prepare",
    "/admin/prepared",
    "/admin/release",
    "/admin/grants",
    "/admin/system",
    "/admin/roles",
    "/admin/reader-classes",
    "/admin/families",
    "/profile",
    "/verify-login",
    "/d/doc-001",
  ])("matches %s", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).not.toBe(rootRouteId);
  });
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});
