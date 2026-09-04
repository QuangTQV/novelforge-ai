import test from "node:test";
import assert from "node:assert/strict";
import { assertCopy } from "./localeCopy.mjs";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readClientFile = (relativePath) => readFileSync(join(clientRoot, relativePath), "utf8");

const css = readClientFile("src/index.css");
const tailwindConfig = readClientFile("tailwind.config.ts");
const assetLibraryHeader = readClientFile("src/components/assetLibrary/AssetLibraryHeader.tsx");
const assetLibraryStatus = readClientFile("src/components/assetLibrary/AssetLibraryStatusGrid.tsx");
const assetLibrarySection = readClientFile("src/components/assetLibrary/AssetLibrarySection.tsx");
const knowledgePage = readClientFile("src/pages/knowledge/KnowledgePage.tsx");
const knowledgeDocuments = readClientFile("src/pages/knowledge/components/KnowledgeDocumentsTab.tsx");
const knowledgeOverview = readClientFile("src/pages/knowledge/components/KnowledgeLibraryOverview.tsx");
const knowledgeOps = readClientFile("src/pages/knowledge/components/KnowledgeOpsTab.tsx");
const knowledgeSettings = readClientFile("src/pages/knowledge/components/KnowledgeEmbeddingSettingsCard.tsx");
const worldList = readClientFile("src/pages/worlds/WorldList.tsx");
const worldWorkspace = readClientFile("src/pages/worlds/WorldWorkspace.tsx");
const worldHandbook = readClientFile("src/pages/worlds/components/workspace/WorldHandbookEditor.tsx");
const worldOverview = readClientFile("src/pages/worlds/components/workspace/WorldOverviewTab.tsx");
const worldLayers = readClientFile("src/pages/worlds/components/workspace/WorldLayersTab.tsx");
const worldDeepening = readClientFile("src/pages/worlds/components/workspace/WorldDeepeningTab.tsx");
const worldConsistency = readClientFile("src/pages/worlds/components/workspace/WorldConsistencyTab.tsx");
const worldAssets = readClientFile("src/pages/worlds/components/workspace/WorldAssetsTab.tsx");
const worldVisualization = readClientFile("src/pages/worlds/components/WorldVisualizationBoard.tsx");
const worldGraphCanvas = readClientFile("src/pages/worlds/components/visualization/WorldGraphCanvas.tsx");
const worldGraphElements = readClientFile("src/pages/worlds/components/visualization/WorldGraphElements.tsx");
const worldGraphLayout = readClientFile("src/pages/worlds/components/visualization/worldGraphLayout.ts");
const worldTimeline = readClientFile("src/pages/worlds/components/visualization/WorldTimelinePanel.tsx");
const genrePage = readClientFile("src/pages/genres/GenreManagementPage.tsx");
const genreTreeBrowser = readClientFile("src/pages/genres/components/GenreTreeBrowser.tsx");
const storyModePage = readClientFile("src/pages/storyModes/StoryModeManagementPage.tsx");
const storyModeCreateDialog = readClientFile("src/pages/storyModes/components/StoryModeCreateDialog.tsx");
const storyModeExpansionDialog = readClientFile("src/pages/storyModes/components/StoryModeExpansionDialog.tsx");
const storyModeProfileFields = readClientFile("src/pages/storyModes/components/StoryModeProfileFields.tsx");
const storyModeTreeBrowser = readClientFile("src/pages/storyModes/components/StoryModeTreeBrowser.tsx");
const storyModeProfileDetails = readClientFile("src/components/storyModes/StoryModeProfileDetails.tsx");
const assetTreeNavigator = readClientFile("src/components/assetLibrary/AssetTreeNavigator.tsx");
const characterPage = readClientFile("src/pages/characters/CharacterLibrary.tsx");
const writingFormulaLanding = readClientFile("src/pages/writingFormula/components/WritingFormulaLanding.tsx");
const writingFormulaWorkbench = readClientFile("src/pages/writingFormula/components/WritingFormulaWorkbenchPanel.tsx");
const writingFormulaCreateDialog = readClientFile("src/pages/writingFormula/components/WritingFormulaCreateDialog.tsx");

test("asset library semantic status colors are registered as theme tokens", () => {
  for (const token of ["success", "warning", "info"]) {
    assert.match(css, new RegExp(`--${token}:`));
    assert.match(tailwindConfig, new RegExp(`${token}:\\s*\\{`));
  }
});

test("asset library shared shells stay restrained and token based", () => {
  const sharedSource = [assetLibraryHeader, assetLibraryStatus, assetLibrarySection].join("\n");
  assert.match(sharedSource, /AssetLibraryHeader/);
  assert.match(sharedSource, /AssetLibraryRecommendation/);
  assert.match(sharedSource, /AssetLibraryEmptyState/);
  assert.match(sharedSource, /text-warning/);
  assert.match(sharedSource, /text-success/);
  assert.match(sharedSource, /text-info/);
  assert.doesNotMatch(sharedSource, /#[0-9a-f]{3,8}/i);
  assert.doesNotMatch(sharedSource, /(?:slate|amber|emerald|sky|rose|red|blue|green)-\d/);
  assert.doesNotMatch(sharedSource, /gradient|rounded-(?:xl|2xl|3xl)|shadow-(?:sm|md|lg|xl|2xl)/);
});

test("phase one asset pages expose purpose status recommendation and recovery states", () => {
  for (const source of [knowledgeOverview, genrePage, characterPage]) {
    assert.match(source, /AssetLibraryHeader/);
    assert.match(source, /AssetLibrary(?:StatusGrid|Recommendation)/);
  }

  assert.match(knowledgePage, /KnowledgeLibraryOverview/);
  assert.match(knowledgeDocuments, /isLoading/);
  assert.match(knowledgeDocuments, /errorMessage/);
  assert.match(knowledgeDocuments, /onRetry/);
  assert.match(knowledgeDocuments, /AssetLibraryEmptyState/);
  assert.match(genrePage, /genreTreeQuery\.isLoading/);
  assert.match(genrePage, /genreTreeQuery\.isError/);
  assert.match(characterPage, /characterListQuery\.isLoading/);
  assert.match(characterPage, /characterListQuery\.isError/);
});

test("knowledge library presents a document shelf before maintenance controls", () => {
  assertCopy(knowledgeOverview, "知识资料状态");
  assert.match(knowledgeOverview, /recommendation\.tone !== "success"/);
  assert.match(knowledgePage, /TabsTrigger value="documents" className="rounded-full/);
  assertCopy(knowledgeDocuments, "资料书架");
  assert.match(knowledgeDocuments, /xl:grid-cols-2/);
  assertCopy(knowledgeDocuments, "更多操作");
  assertCopy(knowledgeDocuments, "继续创作");
  assert.match(knowledgeDocuments, /onOpenRecallTest/);
  assert.match(knowledgeDocuments, /onReindexDocument/);
  assert.match(knowledgeDocuments, /confirmArchiveDocument/);
});

test("knowledge maintenance keeps recovery obvious and technical detail secondary", () => {
  assertCopy(knowledgeOps, "资料检索可用状态");
  assertCopy(knowledgeOps, "检查检索设置");
  assertCopy(knowledgeOps, "资料同步记录");
  assertCopy(knowledgeOps, "任务详情");
  assert.doesNotMatch(knowledgeOps, /最近失败任务/);
  assertCopy(knowledgeSettings, "让资料参与创作");
  assertCopy(knowledgeSettings, "选择资料理解方式");
  assertCopy(knowledgeSettings, "连接资料库");
  assertCopy(knowledgeSettings, "高级配置");
  assertCopy(knowledgeSettings, "保存检索设置");
});

test("world library presents reusable story samples before handbook detail", () => {
  assertCopy(worldList, "如何把样本用于小说");
  assertCopy(worldList, "展开创作线索");
  assert.match(worldList, /2xl:grid-cols-3/);
  assertCopy(worldList, "查看世界手册");
  assertCopy(worldList, "整理样本");
  assert.match(worldList, /handleDelete/);
  assert.match(worldList, /worldListQuery\.isLoading/);
  assert.match(worldList, /worldListQuery\.isError/);
  assert.doesNotMatch(worldList, /grid grid-cols-4 gap-2 text-center/);
});

test("world workspace keeps handbook reading primary and AI maintenance guided", () => {
  assertCopy(worldWorkspace, "返回世界样本库");
  assertCopy(worldWorkspace, "创作模型");
  assert.match(worldWorkspace, /TabsTrigger value="structure" className="rounded-full/);
  assertCopy(worldHandbook, "世界给读者的第一眼");
  assert.match(worldOverview, /t\("ui\.(?:readGraph|readHandbook)"\)/);
  assertCopy(worldOverview, "条核心规则");
  assertCopy(worldLayers, "分层整理");
  assertCopy(worldLayers, "精修当前内容");
  assertCopy(worldDeepening, "补齐关键设定");
  assertCopy(worldConsistency, "检查世界一致性");
  assert.match(worldAssets, /rounded-full px-4 py-2/);
  assertCopy(worldAssets, "地图与图谱");
  assertCopy(worldAssets, "版本快照");
  assertCopy(worldAssets, "导出备份");
  assertCopy(worldAssets, "导入文本");
});

test("world visualizations separate layout, canvas, and view controls", () => {
  assert.match(worldVisualization, /WorldGraphCanvas/);
  assertCopy(worldVisualization, "势力图谱 ·");
  assertCopy(worldVisualization, "世界地图 ·");
  assert.match(worldVisualization, /WorldTimelinePanel/);
  assert.match(worldGraphCanvas, /ReactFlow/);
  assert.match(worldGraphCanvas, /WorldGraphNode/);
  assert.match(worldGraphCanvas, /WorldGraphEdge/);
  assert.match(worldGraphCanvas, /getVisibleEdgeLabelIds/);
  assert.match(worldGraphCanvas, /edgeHoverTimerRef/);
  assert.match(worldGraphCanvas, /window\.setTimeout/);
  assertCopy(worldGraphCanvas, "拖动地点整理空间");
  assertCopy(worldGraphCanvas, "悬停连线查看双方与完整关系");
  assert.match(worldGraphCanvas, /FullscreenView/);
  assertCopy(worldGraphCanvas, "全屏查看图谱");
  assertCopy(worldGraphCanvas, "退出图谱全屏");
  assert.match(worldGraphElements, /EdgeLabelRenderer/);
  assert.match(worldGraphElements, /interactionWidth=\{28\}/);
  assert.match(worldGraphElements, /line-clamp-2/);
  assert.match(worldGraphElements, /group-focus-within:block/);
  assertCopy(worldGraphElements, "点击画布空白处收起");
  assert.match(worldGraphLayout, /forceSimulation/);
  assert.match(worldGraphLayout, /forceLink/);
  assert.match(worldGraphLayout, /forceX/);
  assert.match(worldGraphLayout, /spreadAxis/);
  assert.match(worldGraphLayout, /seededRandom/);
  assert.match(worldGraphLayout, /getVisibleEdgeLabelIds/);
  assertCopy(worldTimeline, "横向世界时间线，可左右滚动");
  assert.match(worldTimeline, /gridTemplateColumns/);
  assert.match(worldTimeline, /bottom-\[calc\(50%\+38px\)\]/);
  assert.match(worldTimeline, /md:hidden/);
  assert.match(worldTimeline, /FullscreenView/);
  assert.ok(worldVisualization.split("\n").length < 350);
  assert.ok(worldGraphCanvas.split("\n").length < 500);
  assert.ok(worldGraphElements.split("\n").length < 350);
  assert.ok(worldGraphLayout.split("\n").length < 500);
  assert.ok(worldTimeline.split("\n").length < 250);
});
test("genre library uses a compact tree browser with a separate detail surface", () => {
  assert.match(genrePage, /GenreTreeBrowser/);
  assert.match(genreTreeBrowser, /AssetTreeNavigator/);
  assert.match(assetTreeNavigator, /role="tree"/);
  assert.match(assetTreeNavigator, /role="treeitem"/);
  assertCopy(genreTreeBrowser, "题材目录");
  assert.match(genreTreeBrowser, /selected-genre-title/);
  assert.match(genreTreeBrowser, /lg:grid-cols-\[320px_minmax\(0,1fr\)\]/);
  assert.match(genreTreeBrowser, /viewportClassName="max-h-\[380px\]"/);
  assert.doesNotMatch(genreTreeBrowser, /min-h-\[520px\]/);
  assert.doesNotMatch(genreTreeBrowser, /shadow-(?:sm|md|lg|xl|2xl)/);
});

test("story mode library reuses the tree navigator and keeps mode contracts in the detail pane", () => {
  assert.match(storyModePage, /StoryModeTreeBrowser/);
  assert.match(storyModeTreeBrowser, /AssetTreeNavigator/);
  assertCopy(storyModeTreeBrowser, "推进模式目录");
  assert.match(storyModeTreeBrowser, /StoryModeProfileDetails/);
  assertCopy(storyModeProfileDetails, "核心驱动");
  assertCopy(storyModeProfileDetails, "读者回报");
  assertCopy(storyModeProfileDetails, "推进单元");
  assertCopy(storyModeProfileDetails, "冲突上限");
  assert.doesNotMatch(storyModeTreeBrowser, /shadow-(?:sm|md|lg|xl|2xl)/);
});

test("writing formula keeps a compact asset list and reveals the selected profile in place", () => {
  assertCopy(writingFormulaLanding, "先选一套写法，再决定要编辑、应用还是去 AI 味");
  assert.match(writingFormulaLanding, /isSelected \? \(/);
  assertCopy(writingFormulaLanding, "读感定位");
  assertCopy(writingFormulaLanding, "规则摘要");
  assertCopy(writingFormulaLanding, "我的写法资产");
  assertCopy(writingFormulaLanding, "编辑设定");
  assertCopy(writingFormulaLanding, "应用与测试");
  assertCopy(writingFormulaLanding, "去 AI 味");
  assert.doesNotMatch(writingFormulaLanding, /xl:sticky xl:top-4/);
  // create dialog keeps three entry paths (template / brief / material) plus an AI-drafts option
  assert.match(writingFormulaCreateDialog, /t\("ui\.tabs\.template"\)/);
  assert.match(writingFormulaCreateDialog, /t\("ui\.tabs\.brief"\)/);
  assert.match(writingFormulaCreateDialog, /t\("ui\.tabs\.material"\)/);
  assert.match(writingFormulaCreateDialog, /t\("ui\.(?:aiTitle|generateFormula)"\)/);
  assert.ok(writingFormulaLanding.split("\n").length < 450);
  assert.ok(writingFormulaWorkbench.split("\n").length < 350);
  assert.ok(writingFormulaCreateDialog.split("\n").length < 700);
});

test("story mode creation keeps AI assistance beside a grouped, independently scrolling draft", () => {
  assert.match(storyModePage, /StoryModeCreateDialog/);
  assert.match(storyModeCreateDialog, /AppDialogContent/);
  assert.match(storyModeCreateDialog, /lg:grid-cols-\[340px_minmax\(0,1fr\)\]/);
  assert.match(storyModeCreateDialog, /lg:overflow-y-auto/);
  assertCopy(storyModeCreateDialog, "让 AI 起草");
  assertCopy(storyModeCreateDialog, "同时创建的子类");
  assertCopy(storyModeCreateDialog, "高级设置：人工提示补充");
  assert.doesNotMatch(storyModeCreateDialog, /max-h-\[90vh\].*overflow-auto/);

  for (const section of ["核心体验", "推进节奏", "边界与防跑偏"]) {
    assert.match(storyModeProfileFields, new RegExp(section));
  }
});

test("story mode expansion recommends distinct additions from the existing library", () => {
  assert.match(storyModePage, /StoryModeExpansionDialog/);
  assert.match(storyModePage, /generateStoryModeExpansion/);
  assertCopy(storyModePage, "扩展推进模式");
  assertCopy(storyModeExpansionDialog, "扩展范围");
  assertCopy(storyModeExpansionDialog, "推荐新方向");
  assertCopy(storyModeExpansionDialog, "推进单元");
  assertCopy(storyModeExpansionDialog, "加入模式库");
  assert.doesNotMatch(storyModeExpansionDialog, /shadow-(?:sm|md|lg|xl|2xl)/);
});
