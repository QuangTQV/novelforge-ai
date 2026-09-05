import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { BUILT_IN_STORY_MODE_SEEDS, type StoryModeSeedNode } from "../../db/storyModeSeeds";
import {
  DEFAULT_ANTI_AI_RULES,
  DEFAULT_STARTER_STYLE_PROFILES,
  DEFAULT_STYLE_TEMPLATES,
  type DefaultAntiAiRuleDefinition,
  type DefaultStarterStyleProfileDefinition,
  type DefaultTemplateDefinition,
} from "../styleEngine/defaults";
import { serializeJson } from "../styleEngine/helpers";
import { serializeStoryModeProfile } from "../storyMode/storyModeProfile";

export type SystemResourceSeedMode = "missing_only" | "sync_existing";

const STARTER_STYLE_PROFILE_SOURCE_PREFIX = "starter-style-profile:";

interface GenreSeedNode {
  id: string;
  name: string;
  description: string;
  template: string;
  children?: GenreSeedNode[];
}

export interface StyleEngineSeedReport {
  styleTemplatesCreated: number;
  styleTemplatesUpdated: number;
  antiAiRulesCreated: number;
  antiAiRulesUpdated: number;
  styleProfilesCreated: number;
  styleProfilesUpdated: number;
}

export interface SystemResourceBootstrapReport extends StyleEngineSeedReport {
  genresCreated: number;
  genresUpdated: number;
  storyModesCreated: number;
  storyModesUpdated: number;
}

const EMPTY_STYLE_ENGINE_REPORT: StyleEngineSeedReport = {
  styleTemplatesCreated: 0,
  styleTemplatesUpdated: 0,
  antiAiRulesCreated: 0,
  antiAiRulesUpdated: 0,
  styleProfilesCreated: 0,
  styleProfilesUpdated: 0,
};

const EMPTY_BOOTSTRAP_REPORT: SystemResourceBootstrapReport = {
  genresCreated: 0,
  genresUpdated: 0,
  storyModesCreated: 0,
  storyModesUpdated: 0,
  ...EMPTY_STYLE_ENGINE_REPORT,
};

const BUILT_IN_GENRE_SEEDS: GenreSeedNode[] = [
  {
    id: "genre_action_root",
    name: "动作",
    description: "以战斗、冒险、对抗和主角成长为主要驱动力。",
    template: "突出动作场面、明确目标、持续升级的对手与阶段性胜负。",
    children: [
      {
        id: "genre_action_battle",
        name: "战斗冒险",
        description: "围绕旅程、战斗、伙伴和不断升级的挑战展开。",
        template: "强调战斗节奏、招式变化、伙伴协作和关卡突破。",
      },
      {
        id: "genre_action_superpower",
        name: "超能力",
        description: "角色拥有特殊能力，并在对抗、训练和选择中不断成长。",
        template: "强调能力规则、代价、对手克制和力量成长。",
      },
      {
        id: "genre_action_martial_arts",
        name: "武侠格斗",
        description: "以武术、门派、江湖关系和个人信念推动故事。",
        template: "强调招式对决、门派冲突、荣誉与个人抉择。",
      },
    ],
  },
  {
    id: "genre_adventure_root",
    name: "冒险",
    description: "以探索未知、旅行、宝藏和发现新世界为主要驱动力。",
    template: "突出旅程目标、地图推进、未知发现和阶段性冒险回报。",
    children: [
      {
        id: "genre_adventure_treasure",
        name: "寻宝探险",
        description: "围绕遗迹、宝藏、谜题和危险旅程展开。",
        template: "强调线索解谜、地点探索、队伍协作和冒险回报。",
      },
      {
        id: "genre_adventure_isekai",
        name: "异世界冒险",
        description: "角色进入陌生世界，在适应环境和完成目标中展开旅程。",
        template: "强调异世界规则、旅途见闻、伙伴关系和成长挑战。",
      },
    ],
  },
  {
    id: "genre_comedy_root",
    name: "喜剧 Comedy",
    description: "以幽默、反差、误会和轻松互动制造主要阅读乐趣。",
    template: "突出人物反差、节奏轻快、误会化解和连续笑点。",
  },
  {
    id: "genre_drama_root",
    name: "Drama",
    description: "以人物关系、人生选择、情感变化和现实冲突为核心。",
    template: "突出人物弧光、关系变化、情绪积累和关键选择。",
  },
  {
    id: "genre_horror_root",
    name: "Horror",
    description: "以恐惧、未知威胁、压迫氛围和生存危机推动故事。",
    template: "突出恐惧来源、信息缺口、氛围递进和代价兑现。",
  },
  {
    id: "genre_apocalypse_root",
    name: "末世 Apocalypse",
    description: "以灾难、资源危机、秩序崩溃和重建社会为核心。",
    template: "突出环境压力、资源争夺、团队关系和新秩序建立。",
    children: [
      {
        id: "genre_apocalypse_zombie",
        name: "丧尸末世",
        description: "在丧尸灾变和资源匮乏中求生，并寻找新的安全秩序。",
        template: "强调生存路线、资源管理、团队信任和危险升级。",
      },
      {
        id: "genre_apocalypse_disaster",
        name: "灾难求生",
        description: "角色在自然或人为灾难后寻找生存方式和重建机会。",
        template: "强调环境变化、有限资源、现实抉择和秩序重建。",
      },
    ],
  },
  {
    id: "genre_sports_root",
    name: "Sports",
    description: "以训练、比赛、团队协作和突破极限为主要驱动力。",
    template: "突出训练成长、比赛目标、队友关系和关键胜负。",
  },
  {
    id: "genre_school_life_root",
    name: "School Life",
    description: "以校园生活、成长、人际关系和青春日常为核心。",
    template: "突出校园场景、同伴关系、成长烦恼和阶段性目标。",
  },
  {
    id: "genre_adult_root",
    name: "成人 Adult",
    description: "面向成年读者的成熟主题、亲密关系、欲望和现实冲突分类。",
    template: "根据作者设定处理成熟关系、亲密场景和情绪张力，并保持前后一致的内容分级。",
  },
  {
    id: "genre_ecchi_root",
    name: "Ecchi",
    description: "包含暧昧、性感幽默、身体吸引力和轻度成人向表达。",
    template: "根据作者设定控制暧昧、性感和亲密表达的强度，并与故事情节和人物关系保持一致。",
  },
  {
    id: "genre_isekai_root",
    name: "异世界 Isekai",
    description: "角色穿越、转生或被召唤到另一个世界展开新人生。",
    template: "突出异世界规则、身份变化、能力成长和新生活目标。",
  },
  {
    id: "genre_mecha_root",
    name: "Mecha",
    description: "以机甲、载具、驾驶员和大型战斗为核心视觉与冲突。",
    template: "强调机体设定、驾驶协作、战术对抗和战争代价。",
  },
  {
    id: "genre_supernatural_root",
    name: "Supernatural",
    description: "现代或现实世界中出现灵异、神秘力量和超自然事件。",
    template: "强调异常规则、隐藏世界、调查过程和能力代价。",
  },
  {
    id: "genre_gl_root",
    name: "百合 GL",
    description: "以女性角色之间的情感、羁绊和关系发展为核心。",
    template: "突出女性角色关系、情感变化、陪伴和相互成长。",
  },
  {
    id: "genre_bl_root",
    name: "耽美 BL",
    description: "以男性角色之间的情感、羁绊和关系发展为核心。",
    template: "突出男性角色关系、情感变化、陪伴和相互成长。",
  },
  {
    id: "genre_fantasy_root",
    name: "Fantasy",
    description: "以魔法、神话、异世界和超自然设定为核心。",
    template: "突出世界观规则、奇观探索和角色成长。",
    children: [
      {
        id: "genre_fantasy_eastern",
        name: "东方 Fantasy",
        description: "修炼体系、宗门势力与家国叙事并重。",
        template: "强调境界突破与势力博弈。",
      },
      {
        id: "genre_fantasy_western",
        name: "西方 Fantasy",
        description: "骑士、法师、神话生物等经典元素。",
        template: "强调冒险任务与史诗冲突。",
      },
      {
        id: "genre_fantasy_xianxia",
        name: "仙侠 Fantasy",
        description: "以修真体系、道统因果、飞升长生为核心母题。",
        template: "强调修行路径、因果代价与宗门/仙途抉择。",
      },
      {
        id: "genre_fantasy_high_martial",
        name: "高武 Fantasy",
        description: "高强度力量体系、战斗成长和世界阶层跃迁并重。",
        template: "强调力量升级、战斗压制与秩序层级突破。",
      },
    ],
  },
  {
    id: "genre_urban_root",
    name: "Slice of Life",
    description: "以现代城市为主要舞台，强调现实冲突与人物关系。",
    template: "突出节奏感与生活化细节。",
    children: [
      {
        id: "genre_urban_superpower",
        name: "Urban Supernatural",
        description: "现代都市框架下叠加超常能力、隐秘规则或特殊职业。",
        template: "强调现实秩序与异能设定碰撞后的反差感和升级空间。",
      },
      {
        id: "genre_urban_workplace",
        name: "Urban Workplace",
        description: "围绕职业成长、组织关系与现实利益推进剧情。",
        template: "强调项目压力、职场博弈和能力兑现。",
      },
      {
        id: "genre_urban_life",
        name: "日常生活",
        description: "以现实生活、邻里关系、家庭与日常经营为主要舞台。",
        template: "强调生活感、细碎推进与持续回暖或积累。",
      },
    ],
  },
  {
    id: "genre_history_root",
    name: "历史 Historical",
    description: "以古代或历史类社会结构为舞台，强调时代约束与局势变化。",
    template: "突出时代氛围、身份阶层与大势推进。",
    children: [
      {
        id: "genre_history_alt",
        name: "Alternate History",
        description: "借用历史质感与制度逻辑，但允许重构关键势力和事件走向。",
        template: "强调时代氛围、制度博弈与命运改写。",
      },
      {
        id: "genre_history_power",
        name: "政治权谋",
        description: "围绕朝局、派系、官场生存与政治选择展开。",
        template: "强调派系博弈、局势反转与代价明确的权力选择。",
      },
      {
        id: "genre_history_war",
        name: "战争争霸",
        description: "围绕势力扩张、战争推进和大格局重组持续展开。",
        template: "强调征伐节奏、资源调度与版图变化。",
      },
    ],
  },
  {
    id: "genre_scifi_root",
    name: "Sci-Fi",
    description: "以科技变革、未来秩序、宇宙探索或末世生存为核心驱动力。",
    template: "突出技术设定、未来规则与生存代价。",
    children: [
      {
        id: "genre_scifi_near_future",
        name: "近未来 Sci-Fi",
        description: "基于现实延展的近未来社会、技术和日常冲突。",
        template: "强调技术变革如何改写现实生活、制度和关系结构。",
      },
      {
        id: "genre_scifi_cyberpunk",
        name: "Cyberpunk",
        description: "高科技低生活、资本垄断、义体改造与身份异化并存。",
        template: "强调技术压迫、阶层撕裂和个人反抗。",
      },
      {
        id: "genre_scifi_apocalypse",
        name: "末世科幻",
        description: "灾变、资源危机和秩序重建共同驱动人物选择。",
        template: "强调生存压力、资源争夺与新秩序搭建。",
      },
      {
        id: "genre_scifi_space",
        name: "星际冒险",
        description: "以远航、未知文明、舰队行动或星际任务推进剧情。",
        template: "强调探索未知、群体协作和文明碰撞。",
      },
    ],
  },
  {
    id: "genre_suspense_root",
    name: "Mystery",
    description: "以谜团、异常、危险逼近和真相回收驱动持续阅读。",
    template: "突出线索推进、异常细节和压力递增。",
    children: [
      {
        id: "genre_suspense_detective",
        name: "Detective",
        description: "围绕案件调查、证据链和逻辑推演持续推进。",
        template: "强调案件结构、侦查过程与推理回收。",
      },
      {
        id: "genre_suspense_thriller",
        name: "Thriller",
        description: "危险持续逼近，未知威胁和心理压迫感并重。",
        template: "强调风险升级、信息缺口和压迫氛围。",
      },
      {
        id: "genre_suspense_weird_rules",
        name: "规则怪谈 Weird Rules",
        description: "围绕规则、禁忌、异常逻辑和错误代价组织故事。",
        template: "强调规则辨识、试探边界和异常回收。",
      },
      {
        id: "genre_suspense_infinite",
        name: "无限副本 Survival",
        description: "通过一个个副本、关卡或循环空间推进生存与破局。",
        template: "强调副本目标、通关机制、死亡压力与阶段性逃脱。",
      },
    ],
  },
  {
    id: "genre_romance_root",
    name: "Romance",
    description: "以关系推进、情绪兑现和人物陪伴感为主要阅读驱动力。",
    template: "突出关系变化、情绪拉扯与阶段性回应。",
    children: [
      {
        id: "genre_romance_modern",
        name: "Modern Romance",
        description: "现代生活语境中的关系推进、情绪拉扯与现实选择。",
        template: "强调生活场景、关系误读和情绪回收。",
      },
      {
        id: "genre_romance_ancient",
        name: "Historical Romance",
        description: "古代礼法、身份约束和命运纠葛共同作用于关系发展。",
        template: "强调礼法限制、身份差与关系抉择。",
      },
      {
        id: "genre_romance_campus",
        name: "校园青春 School Life",
        description: "围绕成长、同伴关系、试探靠近和青春氛围展开。",
        template: "强调成长心事、关系试探和阶段性心动兑现。",
      },
    ],
  },
  {
    id: "genre_game_root",
    name: "Game",
    description: "围绕比赛、职业体系、数值成长或系统化任务持续推进。",
    template: "突出规则目标、阶段成长与结果兑现。",
    children: [
      {
        id: "genre_game_esports",
        name: "Esports",
        description: "以赛事对抗、团队磨合、训练成长和成绩突破为主线。",
        template: "强调比赛节奏、团队配合与关键局兑现。",
      },
      {
        id: "genre_game_online",
        name: "MMO",
        description: "围绕职业体系、副本、工会关系和游戏世界成长展开。",
        template: "强调系统成长、副本推进和资源竞争。",
      },
    ],
  },
];

function mergeBootstrapReport(
  base: SystemResourceBootstrapReport,
  patch: Partial<SystemResourceBootstrapReport>,
): SystemResourceBootstrapReport {
  return {
    genresCreated: base.genresCreated + (patch.genresCreated ?? 0),
    genresUpdated: base.genresUpdated + (patch.genresUpdated ?? 0),
    storyModesCreated: base.storyModesCreated + (patch.storyModesCreated ?? 0),
    storyModesUpdated: base.storyModesUpdated + (patch.storyModesUpdated ?? 0),
    styleTemplatesCreated: base.styleTemplatesCreated + (patch.styleTemplatesCreated ?? 0),
    styleTemplatesUpdated: base.styleTemplatesUpdated + (patch.styleTemplatesUpdated ?? 0),
    antiAiRulesCreated: base.antiAiRulesCreated + (patch.antiAiRulesCreated ?? 0),
    antiAiRulesUpdated: base.antiAiRulesUpdated + (patch.antiAiRulesUpdated ?? 0),
    styleProfilesCreated: base.styleProfilesCreated + (patch.styleProfilesCreated ?? 0),
    styleProfilesUpdated: base.styleProfilesUpdated + (patch.styleProfilesUpdated ?? 0),
  };
}

function mergeStyleEngineReport(
  base: StyleEngineSeedReport,
  patch: Partial<StyleEngineSeedReport>,
): StyleEngineSeedReport {
  return {
    styleTemplatesCreated: base.styleTemplatesCreated + (patch.styleTemplatesCreated ?? 0),
    styleTemplatesUpdated: base.styleTemplatesUpdated + (patch.styleTemplatesUpdated ?? 0),
    antiAiRulesCreated: base.antiAiRulesCreated + (patch.antiAiRulesCreated ?? 0),
    antiAiRulesUpdated: base.antiAiRulesUpdated + (patch.antiAiRulesUpdated ?? 0),
    styleProfilesCreated: base.styleProfilesCreated + (patch.styleProfilesCreated ?? 0),
    styleProfilesUpdated: base.styleProfilesUpdated + (patch.styleProfilesUpdated ?? 0),
  };
}

async function seedGenreNode(
  tx: Prisma.TransactionClient,
  node: GenreSeedNode,
  parentId: string | null,
  mode: SystemResourceSeedMode,
): Promise<Pick<SystemResourceBootstrapReport, "genresCreated" | "genresUpdated">> {
  let report = { genresCreated: 0, genresUpdated: 0 };
  const existing = await tx.novelGenre.findUnique({
    where: { id: node.id },
    select: { id: true },
  });

  if (existing) {
    if (mode === "sync_existing") {
      await tx.novelGenre.update({
        where: { id: node.id },
        data: {
          name: node.name,
          description: node.description,
          template: node.template,
          parentId,
        },
      });
      report = { genresCreated: 0, genresUpdated: 1 };
    }
  } else {
    await tx.novelGenre.create({
      data: {
        id: node.id,
        name: node.name,
        description: node.description,
        template: node.template,
        parentId,
      },
    });
    report = { genresCreated: 1, genresUpdated: 0 };
  }

  for (const child of node.children ?? []) {
    const childReport = await seedGenreNode(tx, child, node.id, mode);
    report = {
      genresCreated: report.genresCreated + childReport.genresCreated,
      genresUpdated: report.genresUpdated + childReport.genresUpdated,
    };
  }

  return report;
}

async function seedStoryModeNode(
  tx: Prisma.TransactionClient,
  node: StoryModeSeedNode["children"][number] | StoryModeSeedNode,
  parentId: string | null,
  mode: SystemResourceSeedMode,
): Promise<Pick<SystemResourceBootstrapReport, "storyModesCreated" | "storyModesUpdated">> {
  let report = { storyModesCreated: 0, storyModesUpdated: 0 };
  const existing = await tx.novelStoryMode.findUnique({
    where: { id: node.id },
    select: { id: true },
  });

  const data = {
    name: node.name,
    description: node.description,
    template: node.template,
    profileJson: serializeStoryModeProfile(node.profile),
    parentId,
  };

  if (existing) {
    if (mode === "sync_existing") {
      await tx.novelStoryMode.update({
        where: { id: node.id },
        data,
      });
      report = { storyModesCreated: 0, storyModesUpdated: 1 };
    }
  } else {
    await tx.novelStoryMode.create({
      data: {
        id: node.id,
        ...data,
      },
    });
    report = { storyModesCreated: 1, storyModesUpdated: 0 };
  }

  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      const childReport = await seedStoryModeNode(tx, child, node.id, mode);
      report = {
        storyModesCreated: report.storyModesCreated + childReport.storyModesCreated,
        storyModesUpdated: report.storyModesUpdated + childReport.storyModesUpdated,
      };
    }
  }

  return report;
}

function buildStyleTemplateWriteData(template: DefaultTemplateDefinition) {
  return {
    name: template.name,
    description: template.description,
    category: template.category,
    tagsJson: serializeJson(template.tags),
    applicableGenresJson: serializeJson(template.applicableGenres),
    analysisMarkdown: template.analysisMarkdown,
    narrativeRulesJson: serializeJson(template.narrativeRules),
    characterRulesJson: serializeJson(template.characterRules),
    languageRulesJson: serializeJson(template.languageRules),
    rhythmRulesJson: serializeJson(template.rhythmRules),
    defaultAntiAiRuleKeysJson: serializeJson(template.defaultAntiAiRuleKeys),
  };
}

function buildAntiAiRuleWriteData(rule: DefaultAntiAiRuleDefinition) {
  return {
    name: rule.name,
    type: rule.type,
    severity: rule.severity,
    description: rule.description,
    detectPatternsJson: serializeJson(rule.detectPatterns),
    rewriteSuggestion: rule.rewriteSuggestion,
    promptInstruction: rule.promptInstruction,
    autoRewrite: rule.autoRewrite,
    enabled: rule.enabled,
    globalBaselineEnabled: rule.globalBaselineEnabled,
  };
}

function buildStarterStyleProfileSourceRef(definition: DefaultStarterStyleProfileDefinition): string {
  return `${STARTER_STYLE_PROFILE_SOURCE_PREFIX}${definition.key}`;
}

function buildStarterStyleProfileWriteData(input: {
  definition: DefaultStarterStyleProfileDefinition;
  template: DefaultTemplateDefinition;
}) {
  return {
    name: input.definition.name,
    description: input.definition.description,
    category: input.template.category,
    tagsJson: serializeJson(input.template.tags),
    applicableGenresJson: serializeJson(input.template.applicableGenres),
    sourceType: "manual",
    sourceRefId: buildStarterStyleProfileSourceRef(input.definition),
    sourceContent: null,
    extractedFeaturesJson: serializeJson([]),
    analysisMarkdown: input.template.analysisMarkdown,
    narrativeRulesJson: serializeJson(input.template.narrativeRules),
    characterRulesJson: serializeJson(input.template.characterRules),
    languageRulesJson: serializeJson(input.template.languageRules),
    rhythmRulesJson: serializeJson(input.template.rhythmRules),
    status: "active",
  };
}

async function seedStarterStyleProfiles(
  tx: Prisma.TransactionClient,
  mode: SystemResourceSeedMode,
): Promise<StyleEngineSeedReport> {
  let report = { ...EMPTY_STYLE_ENGINE_REPORT };
  const totalProfiles = await tx.styleProfile.count();
  if (mode === "missing_only" && totalProfiles > 0) {
    return report;
  }

  for (const definition of DEFAULT_STARTER_STYLE_PROFILES) {
    const template = DEFAULT_STYLE_TEMPLATES.find((item) => item.key === definition.templateKey);
    if (!template) {
      continue;
    }

    const sourceRefId = buildStarterStyleProfileSourceRef(definition);
    const existing = await tx.styleProfile.findFirst({
      where: { sourceRefId },
      select: { id: true },
    });
    const antiAiRules = template.defaultAntiAiRuleKeys.length > 0
      ? await tx.antiAiRule.findMany({
        where: {
          key: {
            in: template.defaultAntiAiRuleKeys,
          },
        },
        select: { id: true },
      })
      : [];

    if (existing) {
      if (mode === "sync_existing") {
        await tx.styleProfile.update({
          where: { id: existing.id },
          data: buildStarterStyleProfileWriteData({ definition, template }),
        });
        await tx.styleProfileAntiAiRule.deleteMany({
          where: { styleProfileId: existing.id },
        });
        if (antiAiRules.length > 0) {
          await tx.styleProfileAntiAiRule.createMany({
            data: antiAiRules.map((rule) => ({
              styleProfileId: existing.id,
              antiAiRuleId: rule.id,
              enabled: true,
            })),
          });
        }
        report = mergeStyleEngineReport(report, { styleProfilesUpdated: 1 });
      }
      continue;
    }

    const created = await tx.styleProfile.create({
      data: {
        ...buildStarterStyleProfileWriteData({ definition, template }),
      },
      select: { id: true },
    });
    if (antiAiRules.length > 0) {
      await tx.styleProfileAntiAiRule.createMany({
        data: antiAiRules.map((rule) => ({
          styleProfileId: created.id,
          antiAiRuleId: rule.id,
          enabled: true,
        })),
      });
    }
    report = mergeStyleEngineReport(report, { styleProfilesCreated: 1 });
  }

  return report;
}

export async function seedStyleEngineStarterData(
  mode: SystemResourceSeedMode = "missing_only",
): Promise<StyleEngineSeedReport> {
  return prisma.$transaction(async (tx) => {
    let report = { ...EMPTY_STYLE_ENGINE_REPORT };

    for (const rule of DEFAULT_ANTI_AI_RULES) {
      const existing = await tx.antiAiRule.findUnique({
        where: { key: rule.key },
        select: { id: true },
      });
      if (existing) {
        if (mode === "sync_existing") {
          await tx.antiAiRule.update({
            where: { key: rule.key },
            data: buildAntiAiRuleWriteData(rule),
          });
          report = mergeStyleEngineReport(report, { antiAiRulesUpdated: 1 });
        }
        continue;
      }

      await tx.antiAiRule.create({
        data: {
          key: rule.key,
          ...buildAntiAiRuleWriteData(rule),
        },
      });
      report = mergeStyleEngineReport(report, { antiAiRulesCreated: 1 });
    }

    for (const template of DEFAULT_STYLE_TEMPLATES) {
      const existing = await tx.styleTemplate.findUnique({
        where: { key: template.key },
        select: { id: true },
      });
      if (existing) {
        if (mode === "sync_existing") {
          await tx.styleTemplate.update({
            where: { key: template.key },
            data: buildStyleTemplateWriteData(template),
          });
          report = mergeStyleEngineReport(report, { styleTemplatesUpdated: 1 });
        }
        continue;
      }

      await tx.styleTemplate.create({
        data: {
          key: template.key,
          ...buildStyleTemplateWriteData(template),
        },
      });
      report = mergeStyleEngineReport(report, { styleTemplatesCreated: 1 });
    }

    report = mergeStyleEngineReport(report, await seedStarterStyleProfiles(tx, mode));

    return report;
  });
}

export async function ensureSystemResourceStarterData(
  options: {
    mode?: SystemResourceSeedMode;
  } = {},
): Promise<SystemResourceBootstrapReport> {
  const mode = options.mode ?? "missing_only";
  let report = { ...EMPTY_BOOTSTRAP_REPORT };

  const genreReport = await prisma.$transaction(async (tx) => {
    let acc = { genresCreated: 0, genresUpdated: 0 };
    for (const root of BUILT_IN_GENRE_SEEDS) {
      const seeded = await seedGenreNode(tx, root, null, mode);
      acc = {
        genresCreated: acc.genresCreated + seeded.genresCreated,
        genresUpdated: acc.genresUpdated + seeded.genresUpdated,
      };
    }
    return acc;
  });
  report = mergeBootstrapReport(report, genreReport);

  const storyModeReport = await prisma.$transaction(async (tx) => {
    let acc = { storyModesCreated: 0, storyModesUpdated: 0 };
    for (const root of BUILT_IN_STORY_MODE_SEEDS) {
      const seeded = await seedStoryModeNode(tx, root, null, mode);
      acc = {
        storyModesCreated: acc.storyModesCreated + seeded.storyModesCreated,
        storyModesUpdated: acc.storyModesUpdated + seeded.storyModesUpdated,
      };
    }
    return acc;
  });
  report = mergeBootstrapReport(report, storyModeReport);

  const styleReport = await seedStyleEngineStarterData(mode);
  report = mergeBootstrapReport(report, styleReport);

  return report;
}

export function hasSystemResourceBootstrapChanges(report: SystemResourceBootstrapReport): boolean {
  return Object.values(report).some((value) => value > 0);
}
