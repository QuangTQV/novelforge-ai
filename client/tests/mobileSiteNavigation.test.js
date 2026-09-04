import test from "node:test";
import assert from "node:assert/strict";
import {
  MOBILE_ROUTE_PATTERNS,
  getMobileNavGroupForPath,
  getMobilePageTitleKey,
  getMobilePrimaryNavItems,
  getMobileMoreNavGroups,
  getMobileRouteClassName,
} from "../src/components/layout/mobile/mobileSiteNavigation.ts";

const routedPaths = [
  "/",
  "/help",
  "/novels",
  "/novels/create",
  "/novels/demo/preview",
  "/novels/demo/edit",
  "/novels/demo/chapters/chapter-1",
  "/creative-hub",
  "/drama",
  "/chat-legacy",
  "/book-analysis",
  "/market-radar",
  "/tasks",
  "/auto-director/follow-ups",
  "/knowledge",
  "/genres",
  "/story-modes",
  "/titles",
  "/prompt-workbench",
  "/settings/models",
  "/settings/director",
  "/settings/knowledge",
  "/settings/maintenance",
  "/settings",
  "/worlds",
  "/worlds/generator",
  "/worlds/world-1/workspace",
  "/style-engine",
  "/anti-ai-rules",
  "/base-characters",
];

test("mobile route metadata covers every registered page", () => {
  assert.equal(MOBILE_ROUTE_PATTERNS.length, routedPaths.length);

  for (const path of routedPaths) {
    assert.notEqual(getMobilePageTitleKey(path), "mobile.pages.fallback");
    assert.match(getMobileNavGroupForPath(path), /^(home|novels|creation|tasks|more)$/);
    assert.match(getMobileRouteClassName(path), /^mobile-route-[a-z0-9-]+$/);
  }
});

test("mobile primary nav keeps core beginner actions visible", () => {
  assert.deepEqual(
    getMobilePrimaryNavItems().map((item) => [item.key, item.to, item.labelKey]),
    [
      ["home", "/", "mobile.primary.home"],
      ["novels", "/novels", "mobile.primary.novels"],
      ["creation", "/creative-hub", "mobile.primary.creation"],
      ["tasks", "/tasks", "mobile.primary.tasks"],
      ["more", "", "mobile.primary.more"],
    ],
  );
});

test("mobile more menu contains all non-primary registered pages", () => {
  const morePaths = getMobileMoreNavGroups().flatMap((group) => group.items.map((item) => item.to));

  assert.deepEqual(
    morePaths,
    [
      "/help",
      "/drama",
      "/book-analysis",
      "/market-radar",
      "/chat-legacy",
      "/knowledge",
      "/genres",
      "/story-modes",
      "/titles",
      "/style-engine",
      "/anti-ai-rules",
      "/base-characters",
      "/tasks",
      "/auto-director/follow-ups",
      "/worlds",
      "/worlds/generator",
      "/prompt-workbench",
      "/settings",
    ],
  );
});
