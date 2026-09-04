/**
 * 移动端导航元数据 / Metadata điều hướng mobile / Mobile navigation metadata.
 *
 * `*Key` 字段存放 i18n key（命名空间 `nav`），文案见 src/i18n/locales/<lang>/nav.json 的 `mobile` 段。
 * Các trường `*Key` chứa i18n key (namespace `nav`); văn bản nằm ở mục `mobile` trong nav.json.
 * The `*Key` fields hold i18n keys (namespace `nav`); copy lives under `mobile` in nav.json.
 */
export type MobilePrimaryNavKey = "home" | "novels" | "creation" | "tasks" | "more";

export interface MobileNavItem {
  key: string;
  labelKey: string;
  to: string;
  group: MobilePrimaryNavKey;
}

export interface MobileNavGroup {
  titleKey: string;
  items: MobileNavItem[];
}

export interface MobileRoutePattern {
  key: string;
  pattern: RegExp;
  titleKey: string;
  group: MobilePrimaryNavKey;
}

const FALLBACK_PAGE_TITLE_KEY = "mobile.pages.fallback";

export const MOBILE_ROUTE_PATTERNS: MobileRoutePattern[] = [
  { key: "home", pattern: /^\/$/, titleKey: "mobile.pages.home", group: "home" },
  { key: "help", pattern: /^\/help\/?$/, titleKey: "mobile.pages.help", group: "more" },
  { key: "novels", pattern: /^\/novels\/?$/, titleKey: "mobile.pages.novels", group: "novels" },
  { key: "novel-create", pattern: /^\/novels\/create\/?$/, titleKey: "mobile.pages.novelCreate", group: "novels" },
  { key: "novel-preview", pattern: /^\/novels\/[^/]+\/preview\/?$/, titleKey: "mobile.pages.novelPreview", group: "novels" },
  { key: "novel-edit", pattern: /^\/novels\/[^/]+\/edit\/?$/, titleKey: "mobile.pages.novelEdit", group: "novels" },
  { key: "chapter-edit", pattern: /^\/novels\/[^/]+\/chapters\/[^/]+\/?$/, titleKey: "mobile.pages.chapterEdit", group: "novels" },
  { key: "drama", pattern: /^\/drama\/?$/, titleKey: "mobile.pages.drama", group: "creation" },
  { key: "creative-hub", pattern: /^\/creative-hub\/?$/, titleKey: "mobile.pages.creativeHub", group: "creation" },
  { key: "chat-legacy", pattern: /^\/chat-legacy\/?$/, titleKey: "mobile.pages.chatLegacy", group: "creation" },
  { key: "book-analysis", pattern: /^\/book-analysis\/?$/, titleKey: "mobile.pages.bookAnalysis", group: "creation" },
  { key: "market-radar", pattern: /^\/market-radar\/?$/, titleKey: "mobile.pages.marketRadar", group: "creation" },
  { key: "tasks", pattern: /^\/tasks\/?$/, titleKey: "mobile.pages.tasks", group: "tasks" },
  { key: "auto-director-follow-ups", pattern: /^\/auto-director\/follow-ups\/?$/, titleKey: "mobile.pages.autoDirectorFollowUps", group: "tasks" },
  { key: "knowledge", pattern: /^\/knowledge\/?$/, titleKey: "mobile.pages.knowledge", group: "more" },
  { key: "genres", pattern: /^\/genres\/?$/, titleKey: "mobile.pages.genres", group: "more" },
  { key: "story-modes", pattern: /^\/story-modes\/?$/, titleKey: "mobile.pages.storyModes", group: "more" },
  { key: "titles", pattern: /^\/titles\/?$/, titleKey: "mobile.pages.titles", group: "more" },
  { key: "prompt-workbench", pattern: /^\/prompt-workbench\/?$/, titleKey: "mobile.pages.promptWorkbench", group: "more" },
  { key: "settings-models", pattern: /^\/settings\/models\/?$/, titleKey: "mobile.pages.settingsModels", group: "more" },
  { key: "settings-director", pattern: /^\/settings\/director\/?$/, titleKey: "mobile.pages.settingsDirector", group: "more" },
  { key: "settings-knowledge", pattern: /^\/settings\/knowledge\/?$/, titleKey: "mobile.pages.settingsKnowledge", group: "more" },
  { key: "settings-maintenance", pattern: /^\/settings\/maintenance\/?$/, titleKey: "mobile.pages.settingsMaintenance", group: "more" },
  { key: "settings", pattern: /^\/settings\/?$/, titleKey: "mobile.pages.settings", group: "more" },
  { key: "worlds", pattern: /^\/worlds\/?$/, titleKey: "mobile.pages.worlds", group: "more" },
  { key: "world-generator", pattern: /^\/worlds\/generator\/?$/, titleKey: "mobile.pages.worldGenerator", group: "more" },
  { key: "world-workspace", pattern: /^\/worlds\/[^/]+\/workspace\/?$/, titleKey: "mobile.pages.worldWorkspace", group: "more" },
  { key: "style-engine", pattern: /^\/style-engine\/?$/, titleKey: "mobile.pages.styleEngine", group: "more" },
  { key: "anti-ai-rules", pattern: /^\/anti-ai-rules\/?$/, titleKey: "mobile.pages.antiAiRules", group: "more" },
  { key: "base-characters", pattern: /^\/base-characters\/?$/, titleKey: "mobile.pages.baseCharacters", group: "more" },
];

const primaryNavItems: MobileNavItem[] = [
  { key: "home", labelKey: "mobile.primary.home", to: "/", group: "home" },
  { key: "novels", labelKey: "mobile.primary.novels", to: "/novels", group: "novels" },
  { key: "creation", labelKey: "mobile.primary.creation", to: "/creative-hub", group: "creation" },
  { key: "tasks", labelKey: "mobile.primary.tasks", to: "/tasks", group: "more" },
  { key: "more", labelKey: "mobile.primary.more", to: "", group: "more" },
];

const moreNavGroups: MobileNavGroup[] = [
  {
    titleKey: "mobile.groups.creationAids",
    items: [
      { key: "help", labelKey: "mobile.items.help", to: "/help", group: "more" },
      { key: "drama", labelKey: "mobile.items.drama", to: "/drama", group: "creation" },
      { key: "book-analysis", labelKey: "mobile.items.bookAnalysis", to: "/book-analysis", group: "creation" },
      { key: "market-radar", labelKey: "mobile.items.marketRadar", to: "/market-radar", group: "creation" },
      { key: "chat-legacy", labelKey: "mobile.items.chatLegacy", to: "/chat-legacy", group: "creation" },
    ],
  },
  {
    titleKey: "mobile.groups.assetLibrary",
    items: [
      { key: "knowledge", labelKey: "mobile.items.knowledge", to: "/knowledge", group: "more" },
      { key: "genres", labelKey: "mobile.items.genres", to: "/genres", group: "more" },
      { key: "story-modes", labelKey: "mobile.items.storyModes", to: "/story-modes", group: "more" },
      { key: "titles", labelKey: "mobile.items.titles", to: "/titles", group: "more" },
      { key: "style-engine", labelKey: "mobile.items.styleEngine", to: "/style-engine", group: "more" },
      { key: "anti-ai-rules", labelKey: "mobile.items.antiAiRules", to: "/anti-ai-rules", group: "more" },
      { key: "base-characters", labelKey: "mobile.items.baseCharacters", to: "/base-characters", group: "more" },
    ],
  },
  {
    titleKey: "mobile.groups.worldsAndSystem",
    items: [
      { key: "tasks", labelKey: "mobile.items.tasks", to: "/tasks", group: "more" },
      { key: "auto-director-follow-ups", labelKey: "mobile.items.autoDirectorFollowUps", to: "/auto-director/follow-ups", group: "more" },
      { key: "worlds", labelKey: "mobile.items.worlds", to: "/worlds", group: "more" },
      { key: "world-generator", labelKey: "mobile.items.worldGenerator", to: "/worlds/generator", group: "more" },
      { key: "prompt-workbench", labelKey: "mobile.items.promptWorkbench", to: "/prompt-workbench", group: "more" },
      { key: "settings", labelKey: "mobile.items.settings", to: "/settings", group: "more" },
    ],
  },
];

export function getMobilePrimaryNavItems(): MobileNavItem[] {
  return primaryNavItems;
}

export function getMobileMoreNavGroups(): MobileNavGroup[] {
  return moreNavGroups;
}

export function getMobileRoutePattern(pathname: string): MobileRoutePattern | undefined {
  return MOBILE_ROUTE_PATTERNS.find((route) => route.pattern.test(pathname));
}

/** 返回页面标题的 i18n key / trả về i18n key của tiêu đề trang / returns the page-title i18n key */
export function getMobilePageTitleKey(pathname: string): string {
  return getMobileRoutePattern(pathname)?.titleKey ?? FALLBACK_PAGE_TITLE_KEY;
}

export function getMobileNavGroupForPath(pathname: string): MobilePrimaryNavKey {
  return getMobileRoutePattern(pathname)?.group ?? "more";
}

export function getMobileRouteClassName(pathname: string): string {
  return `mobile-route-${getMobileRoutePattern(pathname)?.key ?? "more"}`;
}
