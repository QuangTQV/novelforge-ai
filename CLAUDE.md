# CLAUDE.md — Hướng dẫn làm việc với AI Novel Writing Assistant

Tài liệu này dành cho Claude Code hoặc các agent coding làm việc trong repository. Đọc file này trước khi sửa code. Tài liệu kiến trúc chi tiết hơn nằm tại:

- `docs/architecture/project-flow-vi.md`
- `README.md`
- `docs/public/flow/end-to-end-production.md`
- `docs/public/flow/auto-director-pipeline.md`
- `docs/public/flow/chapter-execution.md`

## 1. Mục tiêu sản phẩm

Đây là hệ thống sản xuất tiểu thuyết dài bằng AI, không phải ứng dụng chat đơn giản. Hệ thống biến một ý tưởng thành:

```text
ý tưởng
→ book framing
→ story macro
→ world
→ characters
→ volume strategy
→ beat sheet
→ chapter list
→ chapter detail
→ chapter execution
→ audit
→ repair
→ state rehydration cho chương sau
```

Các khái niệm cần hiểu trước khi sửa workflow:

- `task`: công việc dài có trạng thái.
- `checkpoint`: điểm có thể tạm dừng/khôi phục.
- `artifact`: kết quả có cấu trúc của một step.
- `projection`: dữ liệu đã chuẩn bị để UI hiển thị.
- `state`: trạng thái truyện, nhân vật, quan hệ, sự kiện và payoff.
- `context assembly`: chọn dữ liệu phù hợp để đưa vào prompt.
- `idempotency`: chạy lại một step không tạo dữ liệu trùng.

Không được giả định rằng một request HTTP tương đương với việc hoàn thành một workflow. Request thường chỉ khởi động hoặc điều khiển task; worker/runtime mới thực hiện công việc dài.

## 2. Cấu trúc repository

```text
client/   React + Vite frontend
server/   Express API + service + Prisma + worker
shared/   type/constant dùng chung client và server
desktop/  Electron shell, local API runtime, database và updater
docs/     tài liệu sản phẩm, kiến trúc và vận hành
infra/    Qdrant, nginx và hạ tầng
```

### Client

- `client/src/main.tsx`: entrypoint, provider và router.
- `client/src/router/index.tsx`: route lazy-loaded.
- `client/src/pages`: màn hình nghiệp vụ.
- `client/src/components`: component dùng lại.
- `client/src/api`: hàm gọi HTTP.
- `client/src/hooks`: logic query/mutation và controller.
- `client/src/store`: trạng thái toàn cục.
- `client/src/i18n`: i18next, locale và language provider.

### Server

- `server/src/app.ts`: tạo Express app và mount router.
- `server/src/routes`: HTTP boundary, validation và điều phối service.
- `server/src/services`: nghiệp vụ.
- `server/src/modules`: module theo hướng application/domain/http.
- `server/src/workers`: công việc nền.
- `server/src/events`: event bus và side effects.
- `server/src/llm`: provider, model routing và LLM call.
- `server/src/prompting`: prompt asset, compiler và context.
- `server/src/db`: Prisma client và runtime database.
- `server/src/prisma/schema.sqlite.prisma`: schema database.

### Shared

Sửa request/response hoặc trạng thái dùng chung phải kiểm tra `shared/types` trước. Không tạo type frontend riêng chỉ vì chưa tìm thấy type hiện có.

Các file thường dùng:

- `shared/types/novel.ts`
- `shared/types/novelDirector.ts`
- `shared/types/directorRuntime.ts`
- `shared/types/task.ts`
- `shared/types/volumePlanning.ts`
- `shared/types/world.ts`
- `shared/types/styleEngine.ts`

## 3. Quy tắc bắt buộc khi làm việc

### Trước khi sửa

1. Đọc `git status --short`.
2. Không xóa hoặc hoàn nguyên thay đổi có sẵn của người dùng.
3. Tìm cả nơi gọi và nơi được gọi, không chỉ sửa file đang mở.
4. Xác định dữ liệu là source data hay derived data.
5. Kiểm tra shared type và query key liên quan.

### Khi sửa

- Giữ route backend mỏng; logic nghiệp vụ nằm trong service.
- Giữ component UI đơn giản; logic workflow nằm trong hook/controller/service.
- Tái sử dụng `apiClient`, `queryKeys`, schema và helper hiện có.
- Không gọi Axios trực tiếp rải rác trong component.
- Không gọi LLM trực tiếp từ frontend.
- Không đưa toàn bộ database vào prompt nếu chỉ cần một phần context.
- Không tự ý đổi enum, ID, API contract hoặc prompt contract để sửa text UI.
- Dùng transaction khi nhiều bản ghi phải thay đổi cùng nhau.
- Task/worker phải chịu được retry và chạy lại.
- Không ghi đè source data bằng summary, audit, embedding hoặc projection.

### Sau khi sửa

Chạy kiểm tra phù hợp với phạm vi thay đổi:

```bash
pnpm --filter @ai-novel/client typecheck
pnpm --filter @ai-novel/client build
pnpm typecheck
pnpm build
git diff --check
```

Nếu sửa i18n:

```bash
pnpm --filter @ai-novel/client i18n:scan
pnpm --filter @ai-novel/client i18n:check
```

Nếu sửa backend workflow, chạy thêm test backend phù hợp. Không bỏ qua lỗi typecheck hoặc lỗi migration.

## 4. Luồng frontend

Entrypoint:

```text
client/src/main.tsx
  → ThemeProvider
  → LanguageProvider
  → QueryClientProvider
  → BrowserRouter hoặc HashRouter
  → DesktopBootstrapBoundary
  → ServerStartupGate
  → AppRouter
```

Web dùng `BrowserRouter`; desktop dùng `HashRouter`.

Luồng đọc dữ liệu:

```text
Page/component
  → useQuery
  → client/src/api/*.ts
  → apiClient
  → Express route
  → service
  → Prisma/provider
  → ApiResponse
  → React Query cache
  → render
```

Luồng ghi dữ liệu:

```text
user action
  → mutation
  → API client
  → backend route
  → service
  → transaction/database hoặc tạo task
  → response/event
  → invalidate query
  → UI cập nhật
```

Sau mutation, luôn kiểm tra query nào cần invalidate. Dữ liệu lưu thành công nhưng cache không được làm mới là lỗi rất thường gặp.

## 5. Luồng backend

`server/src/app.ts` mount API dưới `/api`:

```text
/api/novels
/api/novels/director
/api/creation-studio
/api/genres
/api/story-modes
/api/knowledge
/api/rag
/api/tasks
/api/drama
/api/comic
/api/market-radar
/api/writing-formula
/api/settings
```

Route nên làm bốn việc:

1. Nhận request.
2. Validate bằng Zod hoặc schema hiện có.
3. Gọi service.
4. Trả `ApiResponse`.

Route không nên chứa logic tạo prompt, gọi LLM, xử lý nhiều bước hoặc cập nhật nhiều bảng.

Service/application layer chịu trách nhiệm nghiệp vụ. Nếu nghiệp vụ có side effect, xem xét event bus thay vì nhồi toàn bộ vào route.

## 6. Auto Director

Các file quan trọng:

- `client/src/pages/novels/autoDirector/AutoDirectorCreatePage.tsx`
- `client/src/pages/novels/autoDirector/useAutoDirectorCreateController.ts`
- `client/src/pages/novels/autoDirector/directorCreateStages.ts`
- `server/src/services/novel/director/NovelDirectorService.ts`
- `server/src/services/novel/director/http/novelDirector.ts`
- `server/src/services/novel/director/`
- `server/src/workers/directorWorker.ts`

Frontend page chủ yếu dựng UI. Controller quản lý form, query, candidate, confirm, continue, restore và trạng thái task.

Luồng xác nhận hướng truyện:

```text
nhập ý tưởng
  → lấy genre/story mode/world/style options
  → tạo candidate
  → người dùng chọn candidate
  → confirm API
  → tạo/liên kết Novel
  → tạo workflow/director task
  → worker chạy từng step
  → lưu artifact/checkpoint
  → chạy tiếp hoặc chờ approval
```

Khi sửa Auto Director, phải kiểm tra cả ba phần:

1. UI stage và controller.
2. API route/service.
3. Runtime step, task và checkpoint.

Không coi việc bấm “Confirm” là hoàn tất. Nó chỉ khởi động workflow dài.

## 7. Task, worker và recovery

Task thường có các trạng thái:

```text
queued → running → succeeded
             ├→ waiting_approval
             ├→ failed
             └→ cancelled
```

Task cần giữ được:

- tiến độ;
- step hiện tại;
- lỗi gần nhất;
- số lần thử;
- checkpoint;
- resume target;
- model/provider;
- token usage;
- artifact đã tạo.

Khi thêm step mới, cần trả lời:

- Step bắt đầu từ checkpoint nào?
- Điều kiện đầu vào là gì?
- Output được lưu ở đâu?
- Chạy lại có tạo trùng không?
- Lỗi nào retry được?
- Lỗi nào phải chờ người dùng?
- Có thể resume sau restart server không?
- Projection/UI biết step đã hoàn tất bằng cách nào?

Mọi step dài phải có idempotency. Ưu tiên idempotency key, upsert, kiểm tra artifact tồn tại và transaction.

## 8. Luồng tạo chương

```text
chapter task
  → book contract
  → story macro
  → volume strategy
  → beat sheet
  → chapter task sheet
  → character context
  → world slice
  → timeline/payoff
  → RAG retrieval
  → style profile
  → anti-AI rules
  → prompt compiler
  → LLM
  → lưu draft
  → audit
  → repair hoặc approval
  → cập nhật state/fact/payoff
```

Không đưa toàn bộ nhân vật và world vào prompt. Context phải được chọn theo chương, người tham gia, mục tiêu và trạng thái hiện tại.

Audit và repair cần phân biệt:

- lỗi nhỏ, cục bộ, an toàn: có thể auto repair;
- lỗi đổi hướng truyện: cần approval hoặc replan;
- lỗi provider/model/output: retry hoặc đổi model.

## 9. LLM và prompt

Luồng chuẩn:

```text
frontend request
  → backend route
  → application service
  → context/prompt compiler
  → provider factory/router
  → LLM
  → parser/normalizer
  → persistence
```

Khi sửa prompt phải kiểm tra:

- input schema;
- output schema;
- parser/normalizer;
- retry/failure handling;
- token budget;
- prompt version;
- các test liên quan.

Không dùng codemod i18n để dịch prompt. Prompt là dữ liệu nghiệp vụ gửi tới model, không phải UI.

## 10. Database và dữ liệu

Schema:

```text
server/src/prisma/schema.sqlite.prisma
```

Các model lõi gồm `Novel`, `Chapter`, `Character`, `World`, `NovelWorld`, `VolumePlan`, `BookContract`, `NovelWorkflowTask`, `DirectorRun`, `DirectorArtifact`, `DirectorStepRun`, `QualityReport`, `StoryStateSnapshot`, `CharacterState`, `ForeshadowState`, `PayoffLedgerItem`, `StyleProfile` và knowledge/RAG models.

Phân biệt:

### Source data

Nội dung người dùng hoặc dữ liệu đã xác nhận: tên sách, nội dung chương, nhân vật, world, lựa chọn và cấu hình.

### Derived data

Summary, audit report, embedding, state snapshot, world slice, payoff projection và task projection.

Derived data có thể tạo lại. Source data không được tự động ghi đè khi retry hoặc regenerate.

Nếu thay đổi schema:

1. Sửa Prisma schema.
2. Kiểm tra migration/runtime migration.
3. Cập nhật service.
4. Cập nhật shared type.
5. Cập nhật API client và UI.
6. Kiểm tra database cũ và desktop import/restore.

## 11. Event và side effect

```text
nghiệp vụ chính commit
  → phát event
  → snapshot/state sync
  → RAG indexing
  → task projection
  → notification/realtime
```

Event handler phải có khả năng chạy lại an toàn. Kiểm tra thứ tự commit trước event, retry và xử lý lỗi. Không để một side effect không quan trọng làm rollback nghiệp vụ chính nếu không cần thiết.

## 12. RAG

SQLite/PostgreSQL giữ metadata, job và trạng thái. Qdrant giữ vector và payload tìm kiếm.

Indexing:

```text
document/chapter/analysis
  → chunk
  → embedding
  → Qdrant
  → metadata/job trong database
```

Retrieval:

```text
context query
  → embedding query
  → Qdrant search
  → filter/rank
  → retrieval trace
  → prompt context
```

RAG chỉ hỗ trợ tìm kiếm ngữ nghĩa; không thay thế state nghiệp vụ hoặc dữ liệu đã xác nhận.

## 13. i18n

File chính:

- `client/src/i18n/config.ts`
- `client/src/i18n/index.ts`
- `client/src/i18n/resources.ts`
- `client/src/i18n/LanguageProvider.tsx`
- `client/src/i18n/locales/vi/`
- `client/src/i18n/locales/en/`

Tiếng Việt luôn là fallback bắt buộc.

Code mới ưu tiên:

```tsx
const { t } = useTranslation("chapterDetail");
return <h1>{t("ui.title")}</h1>;
```

`translateUi("...")` chỉ là bridge cho code cũ.

Được dịch:

- button, label, placeholder;
- toast/confirm;
- trạng thái hiển thị;
- tên dữ liệu hệ thống có dictionary.

Không dịch tự động:

- tên người dùng nhập;
- nội dung chương;
- tên nhân vật tự do;
- prompt;
- ID/enum/API field;
- tên model/provider.

Khi thêm locale, không dùng bản dịch máy làm tiêu chuẩn cuối cùng cho các câu UI quan trọng. Câu phải tự nhiên, nhất quán thuật ngữ và có ngữ cảnh.

## 14. Cách lần code một chức năng

Luôn lần theo chuỗi:

```text
UI page
  → hook/controller
  → client API
  → shared request/response type
  → server route
  → service
  → database/LLM/event
  → response projection
  → React Query invalidation
  → UI
```

Ví dụ sửa nút tạo chương:

1. Tìm component và callback.
2. Tìm hook/controller truyền callback.
3. Tìm API client.
4. Tìm route backend.
5. Tìm service.
6. Kiểm tra task/worker.
7. Kiểm tra persistence và checkpoint.
8. Kiểm tra query invalidation.
9. Kiểm tra loading/error/success.

Nếu chỉ sửa component mà không đọc service, rất dễ sửa sai nguyên nhân.

## 15. Quy tắc git và an toàn

- Không chạy `git reset --hard`.
- Không chạy `git checkout -- ...` để xóa thay đổi người dùng.
- Không xóa database, asset hoặc migration nếu chưa được yêu cầu rõ ràng.
- Trước thao tác có thể mất dữ liệu, xác định chính xác target và phạm vi.
- Giữ thay đổi không liên quan.
- Khi có lỗi do code đang dirty, không tự ý hoàn nguyên toàn bộ repository.
- Dùng `apply_patch` cho chỉnh sửa cục bộ có chủ đích.

## 16. Checklist bàn giao

### Frontend

- [ ] Có loading/error/empty state.
- [ ] Query key ổn định.
- [ ] Mutation invalidate đúng dữ liệu.
- [ ] Không dịch nhầm user content.
- [ ] Desktop route không bị phá.
- [ ] Locale vi/en có key cần thiết.

### Backend

- [ ] Request đã validate.
- [ ] Logic nằm trong service, không nằm trong route.
- [ ] Transaction đúng phạm vi.
- [ ] Retry không tạo bản ghi trùng.
- [ ] Checkpoint/resume hoạt động.
- [ ] Error có thể giải thích và recovery.
- [ ] Không ghi đè source data.

### LLM/workflow

- [ ] Output schema tương thích.
- [ ] Parser xử lý output thiếu/sai.
- [ ] Token budget hợp lý.
- [ ] Prompt version được theo dõi.
- [ ] Audit/repair không bị bỏ qua.
- [ ] Worker restart không làm mất tiến độ.

### Kiểm tra cuối

```bash
pnpm typecheck
pnpm build
pnpm --filter @ai-novel/client i18n:scan
pnpm --filter @ai-novel/client i18n:check
git diff --check
```

## 17. Nguyên tắc quyết định khi chưa chắc chắn

Nếu chưa biết nên sửa ở đâu, hãy trả lời ba câu hỏi:

1. Đây là lỗi UI, API, nghiệp vụ, workflow, prompt hay dữ liệu?
2. Dữ liệu này là source data hay derived data?
3. Sau khi sửa, task, checkpoint, cache, event và bản dịch nào bị ảnh hưởng?

Nếu thay đổi tác động đến API contract, database schema, prompt contract hoặc dữ liệu người dùng, phải kiểm tra toàn bộ chuỗi phụ thuộc trước khi triển khai.
