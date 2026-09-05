import type { ChatOpenAI } from "@langchain/openai";
import {
  classifyRotationTrigger,
  markCandidateCooldown,
  type RotationCandidate,
} from "./providerRotation";

const LLM_ROTATION_PATCHED = Symbol("LLM_ROTATION_PATCHED");

type PatchableChatOpenAI = ChatOpenAI & {
  [LLM_ROTATION_PATCHED]?: boolean;
};

export interface RotationFailoverMeta {
  cooldownMs: number;
  onRotate?: (input: { from: RotationCandidate; to: RotationCandidate; reason: string | null }) => void;
}

/**
 * Bọc thêm khả năng tự chuyển sang candidate (key/provider) kế tiếp khi gặp lỗi kiểu
 * rate-limit/hết quota/key sai — theo đúng thứ tự `remainingCandidates` đã sắp xếp sẵn
 * theo chiến thuật xoay tua. `buildClientForCandidate` phải trả về một client MỚI, CHƯA
 * qua `attachLLMRotationFailover` (nhưng đã bọc đầy đủ debug/usage/guard/limiter như
 * client chính) — nếu bọc lại rotation ở đó sẽ không gây lỗi, nhưng vô nghĩa vì hàm này
 * tự quản lý toàn bộ chuỗi candidate rồi.
 *
 * Quan trọng: phải chụp lại `invoke`/`stream` GỐC của `llm` trước khi ghi đè, vì hàm này
 * ghi đè thuộc tính ngay trên object `llm` truyền vào (giống các wrapper debug/usage
 * khác trong codebase) — gọi lại `llm.invoke` sau khi đã ghi đè sẽ gọi trúng chính nó,
 * gây đệ quy vô hạn.
 *
 * Chỉ retry `stream()` khi lỗi xảy ra TRƯỚC khi có bất kỳ chunk nào được yield — lỗi
 * giữa chừng nghĩa là caller đã nhận một phần output, chuyển key sẽ tạo output trùng.
 */
export function attachLLMRotationFailover(
  llm: ChatOpenAI,
  initialCandidate: RotationCandidate,
  remainingCandidates: RotationCandidate[],
  buildClientForCandidate: (candidate: RotationCandidate) => Promise<ChatOpenAI>,
  meta: RotationFailoverMeta,
): ChatOpenAI {
  if (remainingCandidates.length === 0) {
    return llm;
  }

  const patchable = llm as PatchableChatOpenAI;
  if (patchable[LLM_ROTATION_PATCHED]) {
    return llm;
  }

  const originalInvoke = llm.invoke.bind(llm);
  const originalStream = llm.stream.bind(llm);

  async function runInvokeWithFailover(...args: Parameters<ChatOpenAI["invoke"]>): ReturnType<ChatOpenAI["invoke"]> {
    let invoker = originalInvoke;
    let currentCandidate = initialCandidate;
    const queue = [...remainingCandidates];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await invoker(...args);
      } catch (error) {
        const trigger = classifyRotationTrigger(error, meta.cooldownMs);
        if (!trigger.shouldRotate || queue.length === 0) {
          throw error;
        }
        markCandidateCooldown(currentCandidate.id, trigger.cooldownMs);
        const nextCandidate = queue.shift()!;
        meta.onRotate?.({ from: currentCandidate, to: nextCandidate, reason: trigger.reason });
        const nextClient = await buildClientForCandidate(nextCandidate);
        invoker = nextClient.invoke.bind(nextClient);
        currentCandidate = nextCandidate;
      }
    }
  }

  async function runStreamWithFailover(...args: Parameters<ChatOpenAI["stream"]>) {
    let streamer = originalStream;
    let currentCandidate = initialCandidate;
    const queue = [...remainingCandidates];
    let yieldedAny = false;

    async function* generate() {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          const stream = await streamer(...args);
          for await (const chunk of stream) {
            yieldedAny = true;
            yield chunk;
          }
          return;
        } catch (error) {
          const trigger = yieldedAny ? null : classifyRotationTrigger(error, meta.cooldownMs);
          if (!trigger?.shouldRotate || queue.length === 0) {
            throw error;
          }
          markCandidateCooldown(currentCandidate.id, trigger.cooldownMs);
          const nextCandidate = queue.shift()!;
          meta.onRotate?.({ from: currentCandidate, to: nextCandidate, reason: trigger.reason });
          const nextClient = await buildClientForCandidate(nextCandidate);
          streamer = nextClient.stream.bind(nextClient);
          currentCandidate = nextCandidate;
        }
      }
    }

    return generate();
  }

  patchable.invoke = runInvokeWithFailover as ChatOpenAI["invoke"];
  patchable.stream = runStreamWithFailover as ChatOpenAI["stream"];
  patchable[LLM_ROTATION_PATCHED] = true;
  return patchable;
}
