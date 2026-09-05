const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ThinkTagStreamFilter,
  diffAccumulatedText,
  extractMiniMaxRawStreamData,
  extractReasoningTextFromChunk,
  isDeepSeekThinkingModeProvider,
  isMiniMaxCompatibleProvider,
  resolveProviderReasoningBehavior,
  supportsGenericReasoningEffort,
} = require("../dist/llm/reasoning.js");

test("deepseek v4 pro behavior maps reasoning toggle to thinking mode", () => {
  const disabled = resolveProviderReasoningBehavior({
    provider: "deepseek",
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-v4-pro",
    reasoningEffort: "none",
  });

  assert.equal(disabled.reasoningEnabled, false);
  assert.deepEqual(disabled.modelKwargs, { thinking: { type: "disabled" } });

  const enabled = resolveProviderReasoningBehavior({
    provider: "custom_gateway",
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-reasoner",
    reasoningEffort: "medium",
  });

  assert.equal(enabled.reasoningEnabled, true);
  assert.deepEqual(enabled.modelKwargs, { thinking: { type: "enabled" } });
});

test("deepseek thinking mode detection is limited to toggle-capable models", () => {
  assert.equal(isDeepSeekThinkingModeProvider("deepseek", undefined, "deepseek-v4-pro"), true);
  assert.equal(isDeepSeekThinkingModeProvider("deepseek", undefined, "deepseek-v4-flash"), true);
  assert.equal(isDeepSeekThinkingModeProvider("custom_gateway", "https://api.deepseek.com/v1", "deepseek-reasoner"), true);
  assert.equal(isDeepSeekThinkingModeProvider("deepseek", undefined, "deepseek-chat"), false);
  assert.equal(isDeepSeekThinkingModeProvider("openai", "https://api.openai.com/v1", "deepseek-v4-pro"), false);
  assert.equal(
    isDeepSeekThinkingModeProvider(
      "custom_ooioo",
      "https://ooioo.work/v1",
      "deepseek-v4-flash-0731-fast",
    ),
    true,
  );
});

test("deepseek v4 flash can disable thinking for structured generation", () => {
  const disabled = resolveProviderReasoningBehavior({
    provider: "deepseek",
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-v4-flash",
    reasoningEffort: "none",
  });

  assert.equal(disabled.reasoningEnabled, false);
  assert.deepEqual(disabled.modelKwargs, { thinking: { type: "disabled" } });
});

test("minimax provider behavior enables reasoning_split and raw response parsing", () => {
  const behavior = resolveProviderReasoningBehavior({
    provider: "minimax",
    baseURL: "https://api.minimax.io/v1",
    model: "MiniMax-M2.7",
    reasoningEffort: "none",
  });

  assert.equal(behavior.reasoningEnabled, false);
  assert.equal(behavior.includeRawResponse, true);
  assert.equal(behavior.usesAccumulatedStreamDeltas, true);
  assert.deepEqual(behavior.modelKwargs, { reasoning_split: true });
});

test("minimax detection works for provider id, baseURL and model name", () => {
  assert.equal(isMiniMaxCompatibleProvider("minimax", undefined, undefined), true);
  assert.equal(isMiniMaxCompatibleProvider("custom_gateway", "https://api.minimaxi.com/v1", undefined), true);
  assert.equal(isMiniMaxCompatibleProvider("custom_gateway", undefined, "MiniMax-M2.5-highspeed"), true);
  assert.equal(isMiniMaxCompatibleProvider("openai", "https://api.openai.com/v1", "gpt-5"), false);
});

test("diffAccumulatedText returns only the appended suffix", () => {
  assert.deepEqual(
    diffAccumulatedText("你好", "你好，世界"),
    {
      nextBuffer: "你好，世界",
      delta: "，世界",
    },
  );
  assert.deepEqual(
    diffAccumulatedText("你好，世界", "你好"),
    {
      nextBuffer: "你好",
      delta: "",
    },
  );
});

test("extractMiniMaxRawStreamData reads accumulated content and reasoning buffers", () => {
  const parsed = extractMiniMaxRawStreamData({
    choices: [{
      delta: {
        content: "最终正文",
        reasoning_details: [{
          text: "完整思考链",
        }],
      },
    }],
  });

  assert.deepEqual(parsed, {
    contentBuffer: "最终正文",
    reasoningBuffer: "完整思考链",
  });
});

test("ThinkTagStreamFilter strips think tags across split chunks", () => {
  const filter = new ThinkTagStreamFilter();
  const first = filter.push("<thi");
  const second = filter.push("nk>先思考</think>回答");
  const flushed = filter.flush();

  assert.deepEqual(first, { text: "", reasoning: "" });
  assert.deepEqual(second, { text: "", reasoning: "先思考" });
  assert.deepEqual(flushed, { text: "回答", reasoning: "" });
});

test("extractReasoningTextFromChunk supports generic reasoning payloads", () => {
  const text = extractReasoningTextFromChunk({
    content: [{
      type: "reasoning",
      reasoning: "内容里的思考",
    }],
    additional_kwargs: {
      reasoning_content: "附加字段思考",
      reasoning: {
        summary: [{
          text: "总结思考",
        }],
      },
    },
  });

  assert.equal(text, "附加字段思考总结思考内容里的思考");
});

test("supportsGenericReasoningEffort recognizes only known reasoning-effort model families", () => {
  assert.equal(supportsGenericReasoningEffort("openai", "o1-preview"), true);
  assert.equal(supportsGenericReasoningEffort("openai", "o3-mini"), true);
  assert.equal(supportsGenericReasoningEffort("openai", "o4-mini"), true);
  assert.equal(supportsGenericReasoningEffort("openai", "gpt-5.1"), true);
  assert.equal(supportsGenericReasoningEffort("openai", "gpt-4o"), false);
  assert.equal(supportsGenericReasoningEffort("grok", "grok-4-fast"), true);
  assert.equal(supportsGenericReasoningEffort("grok", "grok-2"), false);
  assert.equal(supportsGenericReasoningEffort("deepseek", "o1-clone"), false);
});

test("resolveProviderReasoningBehavior passes reasoning_effort through for recognized OpenAI/xAI reasoning models", () => {
  const low = resolveProviderReasoningBehavior({
    provider: "openai",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-5.1",
    reasoningEffort: "low",
  });
  assert.equal(low.reasoningEnabled, true);
  assert.deepEqual(low.modelKwargs, { reasoning_effort: "low" });

  const high = resolveProviderReasoningBehavior({
    provider: "grok",
    baseURL: "https://api.x.ai/v1",
    model: "grok-4-fast",
    reasoningEffort: "high",
  });
  assert.deepEqual(high.modelKwargs, { reasoning_effort: "high" });

  const off = resolveProviderReasoningBehavior({
    provider: "openai",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-5.1",
    reasoningEffort: "none",
  });
  assert.equal(off.reasoningEnabled, false);
  assert.equal(off.modelKwargs, undefined);
});

test("resolveProviderReasoningBehavior never sends reasoning_effort for unrecognized providers/models", () => {
  const behavior = resolveProviderReasoningBehavior({
    provider: "some_custom_gateway",
    baseURL: "https://gateway.example.com/v1",
    model: "some-model-v1",
    reasoningEffort: "high",
  });
  assert.equal(behavior.reasoningEnabled, true);
  assert.equal(behavior.modelKwargs, undefined);
});
