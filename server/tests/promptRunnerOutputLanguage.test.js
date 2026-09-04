const test = require("node:test");
const assert = require("node:assert/strict");

const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const {
  appendOutputLanguageDirective,
  resolveNovelOutputLanguage,
  resolveNovelStyleFlavorSetting,
  setNovelOutputLanguageResolverForTests,
} = require("../dist/prompting/core/novelOutputLanguage.js");

test("appendOutputLanguageDirective always appends a prompt-language directive, plus a hard override for non-zh novels", async () => {
  const base = [new SystemMessage("你是写作助手。"), new HumanMessage("写第一章。")];

  try {
    setNovelOutputLanguageResolverForTests(async () => ({ lang: "vi", styleFlavor: "none" }));
    const withVi = await appendOutputLanguageDirective(base, "novel-vi");
    // base + prompt-language directive + hard output-language override (styleFlavor "none" adds nothing)
    assert.equal(withVi.length, base.length + 2);
    const promptDirective = withVi[base.length];
    const overrideDirective = withVi[base.length + 1];
    assert.ok(promptDirective instanceof SystemMessage);
    assert.ok(overrideDirective instanceof SystemMessage);
    assert.match(String(overrideDirective.content), /Tiếng Việt/);
    assert.match(String(overrideDirective.content), /ƯU TIÊN CAO NHẤT/);

    setNovelOutputLanguageResolverForTests(async () => ({ lang: "zh", styleFlavor: "none" }));
    const withZh = await appendOutputLanguageDirective(base, "novel-zh");
    // zh has no hard override (it's the prompts' native language), but still gets
    // the business-language directive so instructions stay unambiguous.
    assert.equal(withZh.length, base.length + 1);
    assert.ok(withZh[base.length] instanceof SystemMessage);

    // no novelId ⇒ default settings (zh / manga) ⇒ prompt directive + style-flavor directive
    const withNone = await appendOutputLanguageDirective(base, undefined);
    assert.equal(withNone.length, base.length + 2);
    assert.match(String(withNone[base.length + 1].content), /漫画/);
  } finally {
    setNovelOutputLanguageResolverForTests();
  }
});

test("appendOutputLanguageDirective appends a style-flavor directive unless styleFlavor is none", async () => {
  const base = [new SystemMessage("你是写作助手。")];

  try {
    setNovelOutputLanguageResolverForTests(async () => ({ lang: "en", styleFlavor: "manhwa" }));
    const withManhwa = await appendOutputLanguageDirective(base, "novel-manhwa");
    // prompt directive + hard override (en != zh) + style-flavor directive
    assert.equal(withManhwa.length, base.length + 3);
    assert.match(String(withManhwa[base.length + 2].content), /MANHWA/);

    setNovelOutputLanguageResolverForTests(async () => ({ lang: "en", styleFlavor: "none" }));
    const withNoFlavor = await appendOutputLanguageDirective(base, "novel-none");
    assert.equal(withNoFlavor.length, base.length + 2);
  } finally {
    setNovelOutputLanguageResolverForTests();
  }
});

test("explicit styleFlavor/language passed to appendOutputLanguageDirective overrides the resolved novel settings", async () => {
  const base = [new SystemMessage("你是写作助手。")];

  try {
    setNovelOutputLanguageResolverForTests(async () => ({ lang: "zh", styleFlavor: "manga" }));
    const withOverride = await appendOutputLanguageDirective(base, "novel-x", "vi", "manhua");
    assert.equal(withOverride.length, base.length + 3);
    assert.match(String(withOverride[base.length + 1].content), /Tiếng Việt/);
    assert.match(String(withOverride[base.length + 2].content), /MANHUA/);
  } finally {
    setNovelOutputLanguageResolverForTests();
  }
});

test("resolveNovelOutputLanguage returns zh when novelId is missing", async () => {
  assert.equal(await resolveNovelOutputLanguage(undefined), "zh");
  assert.equal(await resolveNovelOutputLanguage(null), "zh");
});

test("resolveNovelStyleFlavorSetting returns manga when novelId is missing", async () => {
  assert.equal(await resolveNovelStyleFlavorSetting(undefined), "manga");
  assert.equal(await resolveNovelStyleFlavorSetting(null), "manga");
});
