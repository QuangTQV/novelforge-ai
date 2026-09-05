const test = require("node:test");
const assert = require("node:assert/strict");

const {
  candidateId,
  parseBackupKeys,
  serializeBackupKeys,
  buildProviderKeyPool,
  weightedShuffle,
  orderKeyPool,
  resetRoundRobinCursorsForTests,
  isCandidateInCooldown,
  markCandidateCooldown,
  clearCandidateCooldown,
  resetCooldownsForTests,
  deprioritizeCandidatesInCooldown,
  classifyRotationTrigger,
} = require("../dist/llm/providerRotation.js");

test("candidateId is a stable provider+key composite", () => {
  assert.equal(candidateId("deepseek", "sk-abc"), "deepseek::sk-abc");
  assert.notEqual(candidateId("deepseek", "sk-abc"), candidateId("openai", "sk-abc"));
});

test("parseBackupKeys ignores malformed entries and applies defaults", () => {
  const json = JSON.stringify([
    { key: "k1" },
    { key: "k2", weight: 3, isActive: false, label: "backup 2" },
    { key: "" },
    { notAKey: true },
    "not-an-object",
  ]);
  const parsed = parseBackupKeys(json);
  assert.deepEqual(parsed, [
    { key: "k1", weight: 1, isActive: true },
    { key: "k2", weight: 3, isActive: false, label: "backup 2" },
  ]);
  assert.deepEqual(parseBackupKeys(null), []);
  assert.deepEqual(parseBackupKeys(undefined), []);
  assert.deepEqual(parseBackupKeys("not json"), []);
});

test("serializeBackupKeys round-trips through parseBackupKeys", () => {
  const keys = [
    { key: "k1", weight: 2, isActive: true, label: "primary backup" },
    { key: "k2", weight: 1, isActive: false },
  ];
  const roundTripped = parseBackupKeys(serializeBackupKeys(keys));
  assert.deepEqual(roundTripped, keys);
});

test("buildProviderKeyPool combines primary key with active backups and dedupes", () => {
  const pool = buildProviderKeyPool({
    key: "primary",
    apiKeyWeight: 2,
    backupKeysJson: JSON.stringify([
      { key: "backup1", weight: 1, isActive: true },
      { key: "backup2", weight: 1, isActive: false },
      { key: "primary", weight: 5, isActive: true },
    ]),
  });
  assert.deepEqual(pool, [
    { key: "primary", weight: 2 },
    { key: "backup1", weight: 1 },
  ]);
});

test("buildProviderKeyPool returns empty when no primary key and no backups", () => {
  assert.deepEqual(buildProviderKeyPool({ key: null, backupKeysJson: null }), []);
});

test("orderKeyPool sequential keeps the configured order untouched", () => {
  const pool = [{ key: "a", weight: 1 }, { key: "b", weight: 1 }, { key: "c", weight: 1 }];
  assert.deepEqual(orderKeyPool(pool, "sequential", "cursor-seq"), pool);
});

test("orderKeyPool round_robin rotates the starting offset across successive calls", (t) => {
  t.after(() => resetRoundRobinCursorsForTests());
  const pool = [{ key: "a", weight: 1 }, { key: "b", weight: 1 }, { key: "c", weight: 1 }];
  const first = orderKeyPool(pool, "round_robin", "cursor-rr");
  const second = orderKeyPool(pool, "round_robin", "cursor-rr");
  const third = orderKeyPool(pool, "round_robin", "cursor-rr");
  const fourth = orderKeyPool(pool, "round_robin", "cursor-rr");
  assert.deepEqual(first.map((e) => e.key), ["a", "b", "c"]);
  assert.deepEqual(second.map((e) => e.key), ["b", "c", "a"]);
  assert.deepEqual(third.map((e) => e.key), ["c", "a", "b"]);
  assert.deepEqual(fourth.map((e) => e.key), ["a", "b", "c"]);
});

test("orderKeyPool round_robin cursor is independent per cursorId", (t) => {
  t.after(() => resetRoundRobinCursorsForTests());
  const pool = [{ key: "a", weight: 1 }, { key: "b", weight: 1 }];
  orderKeyPool(pool, "round_robin", "provider-x");
  const stillFirstForY = orderKeyPool(pool, "round_robin", "provider-y");
  assert.deepEqual(stillFirstForY.map((e) => e.key), ["a", "b"]);
});

test("orderKeyPool returns the same array reference for pools of size <= 1", () => {
  const single = [{ key: "only", weight: 1 }];
  assert.equal(orderKeyPool(single, "random", "x"), single);
  const empty = [];
  assert.equal(orderKeyPool(empty, "round_robin", "x"), empty);
});

test("weightedShuffle returns a permutation containing exactly the same items", () => {
  const items = [{ key: "a", weight: 1 }, { key: "b", weight: 5 }, { key: "c", weight: 1 }];
  const shuffled = weightedShuffle(items);
  assert.equal(shuffled.length, items.length);
  assert.deepEqual([...shuffled].map((i) => i.key).sort(), ["a", "b", "c"]);
});

test("weightedShuffle favors higher-weight items to land first, statistically", () => {
  const items = [{ key: "low", weight: 1 }, { key: "high", weight: 20 }];
  let highFirstCount = 0;
  const iterations = 300;
  for (let i = 0; i < iterations; i += 1) {
    const shuffled = weightedShuffle(items);
    if (shuffled[0].key === "high") {
      highFirstCount += 1;
    }
  }
  // With weight 20 vs 1, "high" should land first the vast majority of the time.
  assert.ok(highFirstCount > iterations * 0.8, `expected high-weight item to lead most draws, got ${highFirstCount}/${iterations}`);
});

test("cooldown: a marked candidate is reported in cooldown until it expires", () => {
  resetCooldownsForTests();
  const id = "deepseek::sk-1";
  assert.equal(isCandidateInCooldown(id, 1000), false);
  markCandidateCooldown(id, 5000, 1000);
  assert.equal(isCandidateInCooldown(id, 1000), true);
  assert.equal(isCandidateInCooldown(id, 5999), true);
  assert.equal(isCandidateInCooldown(id, 6000), false);
});

test("cooldown: marking again with a shorter duration does not shorten an existing cooldown", () => {
  resetCooldownsForTests();
  const id = "deepseek::sk-2";
  markCandidateCooldown(id, 10_000, 0);
  markCandidateCooldown(id, 1_000, 0);
  assert.equal(isCandidateInCooldown(id, 9_000), true);
});

test("clearCandidateCooldown removes an active cooldown", () => {
  resetCooldownsForTests();
  const id = "deepseek::sk-3";
  markCandidateCooldown(id, 10_000, 0);
  clearCandidateCooldown(id);
  assert.equal(isCandidateInCooldown(id, 0), false);
});

test("deprioritizeCandidatesInCooldown pushes cooling candidates to the end, preserving relative order", () => {
  resetCooldownsForTests();
  // No explicit `now` here — deprioritizeCandidatesInCooldown always checks against the
  // real wall clock, so the cooldown must be anchored to real "now" too.
  markCandidateCooldown("b", 10_000);
  const items = ["a", "b", "c", "d"];
  const ordered = deprioritizeCandidatesInCooldown(items, (item) => item);
  assert.ok(ordered.indexOf("b") > ordered.indexOf("a"));
  assert.ok(ordered.indexOf("b") > ordered.indexOf("c"));
  assert.ok(ordered.indexOf("b") > ordered.indexOf("d"));
  assert.deepEqual(ordered.filter((x) => x !== "b"), ["a", "c", "d"]);
  resetCooldownsForTests();
});

test("classifyRotationTrigger detects rate limiting via status code and via message", () => {
  const byStatus = classifyRotationTrigger({ status: 429, message: "boom" }, 60_000);
  assert.equal(byStatus.shouldRotate, true);
  assert.equal(byStatus.reason, "rate_limit");
  assert.equal(byStatus.cooldownMs, 60_000);

  const byMessage = classifyRotationTrigger(new Error("Rate limit exceeded, please slow down"), 60_000);
  assert.equal(byMessage.shouldRotate, true);
  assert.equal(byMessage.reason, "rate_limit");
});

test("classifyRotationTrigger honors a Retry-After header for rate limits, clamped to 15 minutes", () => {
  const error = { status: 429, message: "rate limited", headers: { "retry-after": "5" } };
  const result = classifyRotationTrigger(error, 60_000);
  assert.equal(result.cooldownMs, 5000);

  const hugeRetryAfter = { status: 429, message: "rate limited", headers: { "retry-after": "999999" } };
  const clamped = classifyRotationTrigger(hugeRetryAfter, 60_000);
  assert.equal(clamped.cooldownMs, 15 * 60 * 1000);
});

test("classifyRotationTrigger detects insufficient quota with an extended cooldown floor", () => {
  const result = classifyRotationTrigger({ status: 402, message: "payment required" }, 1000);
  assert.equal(result.shouldRotate, true);
  assert.equal(result.reason, "insufficient_quota");
  assert.equal(result.cooldownMs, 15 * 60 * 1000);

  const byMessage = classifyRotationTrigger(new Error("insufficient_quota: your account balance is exhausted"), 1000);
  assert.equal(byMessage.reason, "insufficient_quota");
});

test("classifyRotationTrigger detects invalid/unauthorized keys", () => {
  const result = classifyRotationTrigger(new Error("Incorrect API key provided"), 1000);
  assert.equal(result.shouldRotate, true);
  assert.equal(result.reason, "invalid_key");

  const byStatus = classifyRotationTrigger({ status: 401, message: "" }, 1000);
  assert.equal(byStatus.reason, "invalid_key");
});

test("classifyRotationTrigger detects content filter blocks and server errors", () => {
  const filtered = classifyRotationTrigger(new Error("Blocked by content management policy"), 1000);
  assert.equal(filtered.reason, "content_filter");

  const serverError = classifyRotationTrigger({ status: 503, message: "" }, 1000);
  assert.equal(serverError.reason, "server_error");
});

test("classifyRotationTrigger detects timeouts and connection errors", () => {
  const result = classifyRotationTrigger(new Error("connect ETIMEDOUT 1.2.3.4:443"), 1000);
  assert.equal(result.shouldRotate, true);
  assert.equal(result.reason, "timeout");
});

test("classifyRotationTrigger does not rotate on a generic bad-request error", () => {
  const result = classifyRotationTrigger(new Error("model 'nonexistent-model' does not exist"), 1000);
  assert.equal(result.shouldRotate, false);
  assert.equal(result.cooldownMs, 0);
  assert.equal(result.reason, null);
});
