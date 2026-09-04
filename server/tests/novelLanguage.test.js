const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveNovelLanguage,
  buildOutputLanguageDirective,
  buildPromptLanguageDirective,
  resolvePromptLanguage,
  NOVEL_LANGUAGE_VALUES,
} = require("../../shared/dist/utils/novelLanguage.js");
const {
  countNarrativeLength,
  narrativeLengthUnitLabel,
  isSpaceDelimitedLanguage,
} = require("../../shared/dist/utils/narrativeLength.js");

test("resolveNovelLanguage falls back to zh for empty / unknown values", () => {
  assert.equal(resolveNovelLanguage(null), "zh");
  assert.equal(resolveNovelLanguage(undefined), "zh");
  assert.equal(resolveNovelLanguage(""), "zh");
  assert.equal(resolveNovelLanguage("klingon"), "zh");
  assert.equal(resolveNovelLanguage("vi"), "vi");
  for (const lang of NOVEL_LANGUAGE_VALUES) {
    assert.equal(resolveNovelLanguage(lang), lang);
  }
});

test("buildOutputLanguageDirective is null for zh and forceful for others", () => {
  assert.equal(buildOutputLanguageDirective("zh"), null);
  const vi = buildOutputLanguageDirective("vi");
  assert.ok(vi && vi.includes("Tiếng Việt"));
  assert.ok(vi.includes("ƯU TIÊN CAO NHẤT"));
  assert.ok(buildOutputLanguageDirective("ja").includes("日本語"));
});

test("prompt language follows output language and falls back to English", () => {
  assert.equal(resolvePromptLanguage("vi"), "vi");
  assert.equal(resolvePromptLanguage("zh"), "zh");
  assert.equal(resolvePromptLanguage("en"), "en");
  assert.equal(resolvePromptLanguage("ja"), "en");
  assert.match(buildPromptLanguageDirective("vi", "vi"), /Không được giữ lại chữ Hán/);
  assert.match(buildPromptLanguageDirective("fr", "en"), /Mandatory output language/);
});

test("countNarrativeLength counts words for space-delimited languages and chars for CJK", () => {
  assert.equal(countNarrativeLength("một hai ba bốn năm", "vi"), 5);
  assert.equal(countNarrativeLength("one two three", "en"), 3);
  // CJK: whitespace stripped, characters counted
  assert.equal(countNarrativeLength("你好 世界", "zh"), 4);
  assert.equal(countNarrativeLength("", "vi"), 0);
});

test("isSpaceDelimitedLanguage / unit label", () => {
  assert.equal(isSpaceDelimitedLanguage("vi"), true);
  assert.equal(isSpaceDelimitedLanguage("en"), true);
  assert.equal(isSpaceDelimitedLanguage("zh"), false);
  assert.equal(isSpaceDelimitedLanguage("ja"), false);
  assert.equal(narrativeLengthUnitLabel("vi"), "词");
  assert.equal(narrativeLengthUnitLabel("zh"), "字");
});
