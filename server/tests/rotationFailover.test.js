const test = require("node:test");
const assert = require("node:assert/strict");

const { attachLLMRotationFailover } = require("../dist/llm/rotationFailover.js");
const { resetCooldownsForTests, isCandidateInCooldown, candidateId } = require("../dist/llm/providerRotation.js");

function candidate(provider, key) {
  return { id: candidateId(provider, key), provider, key, isPrimaryProvider: provider === "deepseek" };
}

function rateLimitError() {
  return Object.assign(new Error("Rate limit exceeded"), { status: 429 });
}

function badRequestError() {
  return Object.assign(new Error("model does not exist"), { status: 400 });
}

function makeFakeClient({ invokeImpl, streamImpl } = {}) {
  return {
    invoke: invokeImpl ?? (async () => "default-invoke-result"),
    stream: streamImpl ?? (async () => (async function* () { yield "default-chunk"; })()),
  };
}

test("attachLLMRotationFailover returns the same client unchanged when there are no remaining candidates", () => {
  const client = makeFakeClient();
  const wrapped = attachLLMRotationFailover(client, candidate("deepseek", "k1"), [], async () => client, { cooldownMs: 1000 });
  assert.equal(wrapped, client);
});

test("attachLLMRotationFailover.invoke rotates to the next candidate on a rate-limit error and succeeds", async () => {
  resetCooldownsForTests();
  const primary = makeFakeClient({ invokeImpl: async () => { throw rateLimitError(); } });
  const backup = makeFakeClient({ invokeImpl: async () => "backup-succeeded" });
  const rotations = [];

  const wrapped = attachLLMRotationFailover(
    primary,
    candidate("deepseek", "k1"),
    [candidate("deepseek", "k2")],
    async (nextCandidate) => {
      assert.equal(nextCandidate.key, "k2");
      return backup;
    },
    {
      cooldownMs: 1000,
      onRotate: (info) => rotations.push(info),
    },
  );

  const result = await wrapped.invoke("hello");
  assert.equal(result, "backup-succeeded");
  assert.equal(rotations.length, 1);
  assert.equal(rotations[0].reason, "rate_limit");
  assert.equal(isCandidateInCooldown(candidateId("deepseek", "k1")), true);
});

test("attachLLMRotationFailover.invoke does not rotate on a non-triggering error", async () => {
  resetCooldownsForTests();
  const primary = makeFakeClient({ invokeImpl: async () => { throw badRequestError(); } });
  let buildCalled = false;

  const wrapped = attachLLMRotationFailover(
    primary,
    candidate("deepseek", "k1"),
    [candidate("deepseek", "k2")],
    async () => {
      buildCalled = true;
      return makeFakeClient();
    },
    { cooldownMs: 1000 },
  );

  await assert.rejects(() => wrapped.invoke("hello"), /model does not exist/);
  assert.equal(buildCalled, false);
});

test("attachLLMRotationFailover.invoke exhausts all candidates and throws the last error", async () => {
  resetCooldownsForTests();
  const primary = makeFakeClient({ invokeImpl: async () => { throw rateLimitError(); } });
  const secondary = makeFakeClient({ invokeImpl: async () => { throw Object.assign(new Error("still limited"), { status: 429 }); } });

  const wrapped = attachLLMRotationFailover(
    primary,
    candidate("deepseek", "k1"),
    [candidate("deepseek", "k2")],
    async () => secondary,
    { cooldownMs: 1000 },
  );

  await assert.rejects(() => wrapped.invoke("hello"), /still limited/);
});

test("attachLLMRotationFailover.invoke can fail over across providers", async () => {
  resetCooldownsForTests();
  const primary = makeFakeClient({ invokeImpl: async () => { throw rateLimitError(); } });
  const fallback = makeFakeClient({ invokeImpl: async () => "openai-fallback-result" });
  const seenCandidates = [];

  const wrapped = attachLLMRotationFailover(
    primary,
    candidate("deepseek", "k1"),
    [candidate("openai", "sk-openai")],
    async (nextCandidate) => {
      seenCandidates.push(nextCandidate.provider);
      return fallback;
    },
    { cooldownMs: 1000 },
  );

  const result = await wrapped.invoke("hello");
  assert.equal(result, "openai-fallback-result");
  assert.deepEqual(seenCandidates, ["openai"]);
});

test("attachLLMRotationFailover.stream retries before the first chunk is yielded", async () => {
  resetCooldownsForTests();
  const primary = makeFakeClient({
    streamImpl: async () => { throw rateLimitError(); },
  });
  const backup = makeFakeClient({
    streamImpl: async () => (async function* () { yield "a"; yield "b"; })(),
  });

  const wrapped = attachLLMRotationFailover(
    primary,
    candidate("deepseek", "k1"),
    [candidate("deepseek", "k2")],
    async () => backup,
    { cooldownMs: 1000 },
  );

  const stream = await wrapped.stream("hello");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  assert.deepEqual(chunks, ["a", "b"]);
});

test("attachLLMRotationFailover.stream does NOT retry once a chunk has already been yielded", async () => {
  resetCooldownsForTests();
  const primary = makeFakeClient({
    streamImpl: async () => (async function* () {
      yield "first-chunk";
      throw rateLimitError();
    })(),
  });
  let buildCalled = false;

  const wrapped = attachLLMRotationFailover(
    primary,
    candidate("deepseek", "k1"),
    [candidate("deepseek", "k2")],
    async () => {
      buildCalled = true;
      return makeFakeClient();
    },
    { cooldownMs: 1000 },
  );

  const stream = await wrapped.stream("hello");
  const chunks = [];
  await assert.rejects(async () => {
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
  }, /Rate limit exceeded/);
  assert.deepEqual(chunks, ["first-chunk"]);
  assert.equal(buildCalled, false);
});
