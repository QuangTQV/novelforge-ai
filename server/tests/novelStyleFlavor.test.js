const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveNovelStyleFlavor,
  buildStyleFlavorDirective,
  NOVEL_STYLE_FLAVOR_VALUES,
  DEFAULT_NOVEL_STYLE_FLAVOR,
} = require("../../shared/dist/utils/novelStyleFlavor.js");

test("resolveNovelStyleFlavor falls back to manga for empty / unknown values", () => {
  assert.equal(DEFAULT_NOVEL_STYLE_FLAVOR, "manga");
  assert.equal(resolveNovelStyleFlavor(null), "manga");
  assert.equal(resolveNovelStyleFlavor(undefined), "manga");
  assert.equal(resolveNovelStyleFlavor(""), "manga");
  assert.equal(resolveNovelStyleFlavor("webtoon"), "manga");
  assert.equal(resolveNovelStyleFlavor("none"), "none");
  for (const flavor of NOVEL_STYLE_FLAVOR_VALUES) {
    assert.equal(resolveNovelStyleFlavor(flavor), flavor);
  }
});

test("buildStyleFlavorDirective is null for none and localized per prompt language otherwise", () => {
  assert.equal(buildStyleFlavorDirective("none", "vi"), null);
  assert.equal(buildStyleFlavorDirective("none", "zh"), null);
  assert.equal(buildStyleFlavorDirective("none", "en"), null);

  const mangaVi = buildStyleFlavorDirective("manga", "vi");
  assert.match(mangaVi, /MANGA/);
  assert.match(mangaVi, /LIGHT NOVEL NHẬT/);

  const manhwaZh = buildStyleFlavorDirective("manhwa", "zh");
  assert.match(manhwaZh, /韩式漫画/);

  const manhuaEn = buildStyleFlavorDirective("manhua", "en");
  assert.match(manhuaEn, /CHINESE MANHUA/);
});
