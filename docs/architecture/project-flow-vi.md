# Kiến trúc và luồng hoạt động của AI Novel Writing Assistant

Tài liệu này giải thích dự án từ góc nhìn của người muốn đọc code, sửa lỗi và tiếp tục cải tiến hệ thống. Mục tiêu không chỉ là biết mỗi màn hình làm gì, mà là hiểu một yêu cầu đi qua frontend, API, service, database, LLM, worker và các trạng thái như thế nào.

---

## 1. Dự án đang giải quyết bài toán gì?

Đây là một hệ thống sản xuất tiểu thuyết dài bằng AI. Nó không chỉ nhận một prompt rồi trả về một đoạn văn, mà cố gắng quản lý toàn bộ vòng đời của một cuốn sách:

```text
Ý tưởng ban đầu
  ↓
Định vị cuốn sách
  ↓
Thế giới + nhân vật + story mode
  ↓
Kế hoạch vĩ mô
  ↓
Chia tập + nhịp truyện + danh sách chương
  ↓
Nhiệm vụ từng chương
  ↓
Tạo正文 / nội dung chương
  ↓
Kiểm tra chất lượng
  ↓
Sửa lỗi
  ↓
Cập nhật trạng thái để viết chương tiếp theo
```

Điểm khác biệt quan trọng so với một ứng dụng chat là hệ thống phải bảo đảm ba điều:

1. Một cuốn sách có thể được tạo trong nhiều bước.
2. Công việc dài có thể tạm dừng, chờ người dùng hoặc khôi phục sau lỗi.
3. Những gì đã xác nhận phải được lưu thành tài sản có cấu trúc để các chương sau sử dụng lại.

Vì vậy, các khái niệm quan trọng nhất của dự án là:

- workflow;
- task;
- checkpoint;
- artifact;
- state snapshot;
- context assembly;
- LLM routing;
- event và side effect.

---

## 2. Cấu trúc monorepo

Root project dùng pnpm workspace. Các package chính:

```text
AI-Novel-Writing-Assistant/
├── client/       React + Vite frontend
├── server/       Express API + nghiệp vụ + Prisma
├── shared/       Type dùng chung client/server
├── desktop/      Electron shell và runtime local
├── docs/         Tài liệu kiến trúc, sản phẩm và vận hành
├── infra/        Cấu hình Qdrant, nginx và hạ tầng
├── package.json  Script cấp monorepo
└── pnpm-workspace.yaml
```

### 2.1. `client`

Frontend chịu trách nhiệm:

- hiển thị UI;
- nhận thao tác người dùng;
- gọi HTTP API;
- quản lý loading, error và cache;
- theo dõi task/realtime;
- hiển thị artifact và projection;
- chọn ngôn ngữ, theme và route.

Các thư mục chính:

| Thư mục | Vai trò |
|---|---|
| `client/src/pages` | Các màn hình nghiệp vụ theo route |
| `client/src/components` | Component dùng lại |
| `client/src/api` | Hàm gọi backend |
| `client/src/hooks` | Logic dùng lại và điều khiển query/mutation |
| `client/src/store` | Trạng thái toàn cục |
| `client/src/i18n` | i18next và locale |
| `client/src/lib` | Tiện ích, cấu hình và helper |
| `client/src/router` | Khai báo route |

Frontend không truy cập Prisma hoặc database trực tiếp.

### 2.2. `server`

Backend chịu trách nhiệm:

- nhận và validate request;
- kiểm tra quyền và điều kiện nghiệp vụ;
- đọc/ghi database;
- gọi LLM;
- chạy workflow nền;
- lưu task, checkpoint và artifact;
- phát event;
- xử lý RAG;
- cung cấp realtime hoặc trạng thái để frontend polling.

Các vùng quan trọng:

| Thư mục | Vai trò |
|---|---|
| `server/src/routes` | HTTP route cho các module |
| `server/src/services` | Nghiệp vụ chính |
| `server/src/modules` | Một số module được tổ chức theo kiểu application/module |
| `server/src/workers` | Tác vụ nền |
| `server/src/events` | Event bus và side effect |
| `server/src/llm` | Provider, routing và gọi model |
| `server/src/prompting` | Prompt asset, compiler và context |
| `server/src/db` | Prisma client, migration và database runtime |
| `server/src/prisma` | Schema database |

### 2.3. `shared`

`shared` chứa type và constant được dùng ở cả frontend lẫn backend. Đây là hợp đồng dữ liệu giữa hai phía.

Ví dụ:

- `shared/types/novel.ts`: Novel, Chapter và các type liên quan.
- `shared/types/task.ts`: trạng thái task và task projection.
- `shared/types/novelDirector.ts`: input/output của Auto Director.
- `shared/types/directorRuntime.ts`: artifact, step run, checkpoint và runtime.
- `shared/types/volumePlanning.ts`: chiến lược tập, beat sheet và chapter list.
- `shared/types/world.ts`: world và world wizard.
- `shared/types/styleEngine.ts`: style profile và style runtime.

Nếu sửa response backend, nên sửa type trong `shared` trước hoặc đồng thời. Không nên để frontend tự đoán shape của response.

### 2.4. `desktop`

Desktop dùng Electron để đóng gói ứng dụng local. Desktop shell thường đảm nhiệm:

1. Chuẩn bị runtime.
2. Khởi chạy API server local.
3. Xác định đường dẫn database, log và asset.
4. Mở cửa sổ Electron.
5. Quản lý update và import dữ liệu cũ.

Các file nên đọc:

- `desktop/src/main.ts`
- `desktop/src/runtime/server.ts`
- `desktop/src/runtime/paths.ts`
- `desktop/src/runtime/dataImport.ts`
- `desktop/src/runtime/updater.ts`

---

## 3. Cách chạy dự án

Ở root:

```bash
pnpm install
pnpm dev
```

Script `dev` khởi chạy đồng thời:

```text
dev:shared  → TypeScript watch cho shared
dev:server  → Express API
dev:client  → Vite frontend
```

Các lệnh thường dùng:

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm test:client
pnpm --filter @ai-novel/client i18n:scan
pnpm --filter @ai-novel/client i18n:check
```

`pnpm typecheck` kiểm tra toàn bộ shared, server, client và desktop. Khi thay đổi client, ít nhất nên chạy:

```bash
pnpm --filter @ai-novel/client typecheck
pnpm --filter @ai-novel/client build
```

---

## 4. Luồng khởi động frontend

Điểm vào của client là:

```text
client/src/main.tsx
```

Thứ tự bao ngoài của ứng dụng:

```text
React.StrictMode
  └── ThemeProvider
      └── LanguageProvider
          └── QueryClientProvider
              └── BrowserRouter hoặc HashRouter
                  ├── DesktopBootstrapBoundary
                  ├── ServerStartupGate
                  ├── AppRouter
                  └── Toaster
```

### 4.1. `ThemeProvider`

Quản lý theme sáng/tối và các thiết lập liên quan đến giao diện.

### 4.2. `LanguageProvider`

Quản lý:

- ngôn ngữ hiện tại;
- danh sách ngôn ngữ hỗ trợ;
- đổi ngôn ngữ;
- lưu ngôn ngữ vào local storage;
- đồng bộ `document.documentElement.lang`.

### 4.3. `QueryClientProvider`

React Query quản lý:

- cache response;
- trạng thái loading/error;
- retry;
- invalidation sau mutation;
- đồng bộ lại dữ liệu sau khi tạo hoặc cập nhật.

Một lỗi phổ biến khi sửa UI là mutation chạy thành công nhưng không invalidate đúng query key, khiến màn hình vẫn hiển thị dữ liệu cũ.

### 4.4. Router

File:

```text
client/src/router/index.tsx
```

Các page được lazy load. Ví dụ:

```text
/novels/auto-director → AutoDirectorCreatePage
/novels              → NovelList
/novels/:id/edit     → NarrativeFormNovelEditRoute
/novels/:id/chapters/:chapterId → NovelChapterEdit
/creative-hub        → CreativeHubPage
/tasks               → TaskCenterPage
/knowledge           → KnowledgePage
/genres              → GenreManagementPage
/story-modes         → StoryModeManagementPage
```

Web dùng `BrowserRouter`. Desktop dùng `HashRouter` để route hoạt động ổn định trong Electron.

---

## 5. Luồng request thông thường

Một request đọc dữ liệu có dạng:

```text
Component
  ↓
useQuery()
  ↓
client/src/api/*.ts
  ↓
apiClient (Axios)
  ↓ HTTP
Express route
  ↓ validate request
Service
  ↓ Prisma/service khác
Database hoặc provider ngoài
  ↓
ApiResponse
  ↓
React Query cache
  ↓
Component render
```

Ví dụ lấy danh sách thể loại:

```text
AutoDirectorCreatePage
  ↓ useQuery(queryKeys.genres.all)
getGenreTree()
  ↓ GET /api/genres
genreRouter
  ↓
Genre service / Prisma
  ↓
GenreTreeNode[]
  ↓
flattenGenreTreeOptions()
  ↓
Select hoặc picker hiển thị
```

### 5.1. `apiClient`

File:

```text
client/src/api/client.ts
```

Đây là điểm dùng chung cho Axios. Nó xử lý:

- base URL;
- timeout;
- lỗi HTTP;
- lỗi mạng;
- toast lỗi chung;
- chuyển response lỗi thành `ApiHttpError`.

Khi thêm API mới, nên tạo hàm trong `client/src/api`, không gọi Axios rải rác trong component.

### 5.2. Route backend

File:

```text
server/src/app.ts
```

`app.ts` mount các router:

```text
/api/novels
/api/novels/director
/api/creation-studio
/api/genres
/api/story-modes
/api/knowledge
/api/rag
/api/drama
/api/comic
/api/market-radar
/api/tasks
/api/settings
/api/writing-formula
...
```

Route nên làm các việc sau:

- nhận request;
- validate bằng Zod;
- lấy tham số;
- gọi service;
- trả `ApiResponse`.

Route không nên chứa workflow lớn hoặc logic gọi LLM trực tiếp.

---

## 6. Database và mô hình dữ liệu

Schema chính:

```text
server/src/prisma/schema.sqlite.prisma
```

Database mặc định là SQLite. Runtime cũng có thể hỗ trợ PostgreSQL thông qua Prisma adapter.

### 6.1. Quan hệ cấp cao

```text
Novel
├── Chapter
├── Character
├── NovelWorld
├── VolumePlan
├── StoryMacroPlan
├── BookContract
├── NovelWorkflowTask
├── DirectorRun
├── DirectorArtifact
├── StateSnapshot
├── QualityReport
└── PayoffLedgerItem
```

### 6.2. Dữ liệu nguồn và dữ liệu dẫn xuất

Đây là phân biệt rất quan trọng.

#### Dữ liệu nguồn

Là dữ liệu người dùng hoặc hệ thống xác nhận trực tiếp:

- tên tiểu thuyết;
- mô tả;
- nội dung chương;
- tên nhân vật;
- thiết lập thế giới;
- lựa chọn của người dùng;
- cấu hình model.

#### Dữ liệu dẫn xuất

Là dữ liệu được tạo từ dữ liệu nguồn:

- chapter summary;
- character state;
- consistency fact;
- quality report;
- RAG embedding;
- payoff status;
- world slice;
- projection cho task.

Dữ liệu dẫn xuất có thể được tạo lại. Dữ liệu nguồn không nên bị tự động ghi đè khi chạy lại workflow.

### 6.3. Artifact

Artifact là sản phẩm có cấu trúc của một bước workflow. Một artifact tốt nên biết:

- được tạo bởi bước nào;
- phiên bản schema nào;
- model nào đã tạo;
- prompt version nào;
- trạng thái hiện tại;
- artifact phụ thuộc vào artifact nào;
- có phải nội dung do người dùng bảo vệ hay không.

Khi cải tiến pipeline, không nên chỉ thay đổi text output mà bỏ qua version và dependency của artifact.

---

## 7. Auto Director

Auto Director là workflow trung tâm để biến một ý tưởng thành một dự án tiểu thuyết có thể viết.

Các file chính:

- `client/src/pages/novels/autoDirector/AutoDirectorCreatePage.tsx`
- `client/src/pages/novels/autoDirector/useAutoDirectorCreateController.ts`
- `client/src/pages/novels/autoDirector/directorCreateStages.ts`
- `server/src/services/novel/director/NovelDirectorService.ts`
- `server/src/services/novel/director/http/novelDirector.ts`
- `server/src/services/novel/director/`
- `server/src/workers/directorWorker.ts`

### 7.1. Phần frontend

`AutoDirectorCreatePage` chủ yếu làm nhiệm vụ:

- dựng layout;
- hiển thị từng stage;
- lấy dữ liệu lựa chọn;
- hiển thị candidate;
- nhận confirm;
- hiển thị trạng thái task.

Logic chính nằm trong:

```text
useAutoDirectorCreateController.ts
```

Controller quản lý:

- form cơ bản;
- ý tưởng;
- run mode;
- director task;
- candidate;
- confirm mutation;
- continue mutation;
- trạng thái lỗi;
- restore workflow;
- selected genre/story mode/world/style.

### 7.2. Các stage

Luồng khái niệm:

```text
Idea
  ↓
Book framing
  ↓
Candidate selection
  ↓
Story macro
  ↓
World
  ↓
Characters
  ↓
Volume strategy
  ↓
Volume skeleton
  ↓
Beat sheet
  ↓
Chapter list
  ↓
Chapter detail
  ↓
Chapter execution
```

Mỗi stage có thể có:

- input;
- điều kiện sẵn sàng;
- LLM call;
- output schema;
- persistence;
- checkpoint;
- approval gate;
- next action.

### 7.3. Sau khi người dùng xác nhận candidate

Luồng thường là:

```text
User chọn candidate
  ↓
POST confirm director
  ↓
Tạo hoặc liên kết Novel
  ↓
Tạo NovelWorkflowTask / Director task
  ↓
Lưu seed payload
  ↓
Đưa task vào worker/runtime
  ↓
Chạy các step theo policy
```

Không nên coi việc bấm nút confirm là đã hoàn tất toàn bộ cuốn sách. Nó chỉ tạo một task và bắt đầu một workflow có thể kéo dài.

---

## 8. Task, worker và checkpoint

Task là cách hệ thống biểu diễn một công việc dài.

Các trạng thái thường gặp:

```text
queued
  ↓
running
  ├── waiting_approval
  ├── failed
  └── succeeded

running → cancelled
```

Một task thường chứa:

- `id`;
- `kind`;
- `status`;
- `progress`;
- `currentStage`;
- `currentItemKey`;
- `attemptCount`;
- `maxAttempts`;
- `lastError`;
- `checkpointType`;
- `checkpointSummary`;
- `resumeTarget`;
- `tokenUsage`;
- `provider` và `model`;
- metadata.

### 8.1. Vì sao cần checkpoint?

Nếu một workflow tạo cả cuốn sách bị dừng ở bước nhân vật, hệ thống không nên chạy lại từ đầu. Checkpoint cho biết:

- bước cuối đã hoàn tất;
- artifact nào đã được tạo;
- bước tiếp theo là gì;
- có cần người dùng xác nhận không;
- có thể retry từ đâu;
- lỗi có thể tự sửa hay phải can thiệp.

### 8.2. Nguyên tắc idempotency

Một step có thể bị gọi lại do:

- người dùng refresh;
- worker restart;
- mạng bị ngắt;
- request bị retry;
- desktop app mở lại.

Vì vậy step phải tránh tạo bản ghi trùng. Nên dùng:

- idempotency key;
- kiểm tra artifact hiện có;
- upsert;
- transaction;
- checkpoint trước/sau step rõ ràng.

---

## 9. Luồng tạo một chương

Đây là luồng có nhiều lớp context nhất:

```text
Chapter task
  ↓
Book contract
  ↓
Story macro
  ↓
Volume strategy
  ↓
Beat sheet
  ↓
Chapter task sheet
  ↓
Nhân vật tham gia chương
  ↓
Character resource ledger
  ↓
World slice
  ↓
Timeline và payoff
  ↓
Knowledge/RAG retrieval
  ↓
Style profile
  ↓
Anti-AI rules
  ↓
Prompt compiler
  ↓
LLM
  ↓
Draft
  ↓
Audit
  ↓
Repair nếu cần
  ↓
State rehydration
```

### 9.1. Context assembly

Không nên đưa toàn bộ database vào prompt. Context assembler chọn dữ liệu liên quan:

- nhân vật thực sự xuất hiện;
- mục tiêu chương;
- xung đột;
- trạng thái hiện tại;
- facts đã xác nhận;
- world rules cần tuân thủ;
- payoff gần hạn;
- phần knowledge được truy hồi;
- style và anti-AI policy.

Điểm này ảnh hưởng trực tiếp đến chất lượng và chi phí token.

### 9.2. Audit và repair

Sau khi tạo draft, hệ thống có thể kiểm tra:

- continuity;
- character consistency;
- plot;
- mode fit;
- độ dài;
- chất AI;
- các điều kiện nội dung.

Không phải lỗi nào cũng nên tự sửa. Nên phân loại:

```text
Lỗi an toàn, rõ ràng, có thể sửa cục bộ
  → auto repair

Lỗi cần đổi hướng câu chuyện
  → waiting approval / replan

Lỗi do model/provider
  → retry hoặc switch model
```

---

## 10. LLM và prompt system

Frontend không nên gọi LLM trực tiếp. Luồng đúng:

```text
Frontend API call
  ↓
Backend route
  ↓
Application service
  ↓
Prompt/context compiler
  ↓
LLM provider factory
  ↓
OpenAI / Azure / DeepSeek / SiliconFlow / ...
```

Các vùng nên đọc:

- `server/src/llm/`
- `server/src/prompting/`
- `server/src/services/planner/`
- `server/src/services/audit/`
- `server/src/services/styleEngine/`

Khi sửa prompt, cần kiểm tra đồng thời:

1. Input schema.
2. Output schema.
3. Parser/normalizer.
4. Retry policy.
5. Token budget.
6. Prompt version.
7. Các test đang kiểm tra output.

Không nên dịch hoặc thay đổi prompt system bằng codemod ngôn ngữ. Prompt gửi cho model là contract nghiệp vụ, không phải UI text.

---

## 11. RAG và knowledge base

RAG gồm hai phần:

```text
SQLite/PostgreSQL
  → metadata, document, chunk, job, trạng thái

Qdrant
  → vector embedding và payload tìm kiếm
```

Luồng indexing:

```text
Document / chapter / analysis result
  ↓
Chia thành chunk
  ↓
Tạo embedding
  ↓
Lưu vector vào Qdrant
  ↓
Lưu metadata và trạng thái job
```

Luồng retrieval:

```text
Chapter/context query
  ↓
Embedding query
  ↓
Qdrant search
  ↓
Lọc/sắp xếp chunk
  ↓
Retrieval trace
  ↓
Context compiler
  ↓
LLM
```

RAG không thay thế dữ liệu nghiệp vụ. Ví dụ, trạng thái nhân vật quan trọng vẫn phải được lưu trong database/state service; không nên chỉ hy vọng vector search tìm được nó.

Các vùng nên đọc:

- `server/src/services/rag/`
- `server/src/routes/rag.ts`
- `server/src/services/knowledge/`
- `docs/public/flow/knowledge-and-rag.md`

---

## 12. Event bus và side effects

Một nghiệp vụ chính có thể phát event để các tác vụ phụ xử lý:

```text
Step hoàn tất
  ↓
Commit dữ liệu chính
  ↓
Phát event
  ├── cập nhật snapshot
  ├── cập nhật task projection
  ├── tạo RAG indexing job
  ├── cập nhật character state
  ├── cập nhật payoff ledger
  └── gửi realtime update
```

Lợi ích:

- service chính không phải biết mọi side effect;
- dễ mở rộng;
- có thể retry side effect;
- tách workflow chính khỏi indexing hoặc notification.

Khi sửa event handler, cần kiểm tra:

- handler có chạy trùng được không;
- có transaction không;
- lỗi có làm hỏng nghiệp vụ chính không;
- event có được phát sau khi commit không;
- dữ liệu downstream có thể tạo lại không.

---

## 13. i18n

Các file chính:

- `client/src/i18n/config.ts`
- `client/src/i18n/index.ts`
- `client/src/i18n/resources.ts`
- `client/src/i18n/LanguageProvider.tsx`
- `client/src/i18n/locales/vi/`
- `client/src/i18n/locales/en/`

Luồng đổi ngôn ngữ:

```text
LanguageSelector
  ↓
LanguageProvider.setLanguage()
  ↓
i18n.changeLanguage()
  ↓
React components rerender
  ↓
t(namespace.key) hoặc translateUi(source)
```

### 13.1. Cách dịch nên dùng

Code mới nên dùng key có namespace:

```tsx
const { t } = useTranslation("chapterDetail");

return <h1>{t("ui.title")}</h1>;
```

`translateUi` là cầu nối cho code cũ:

```tsx
return <Button>{translateUi("保存")}</Button>;
```

### 13.2. Phân biệt UI và dữ liệu

Nên dịch:

- title của nút;
- label;
- placeholder;
- toast;
- confirm;
- trạng thái hiển thị;
- tên dữ liệu hệ thống đã biết.

Không nên dịch tự động:

- tên tiểu thuyết do người dùng nhập;
- tên nhân vật do người dùng nhập;
- nội dung chương;
- prompt gửi cho LLM;
- ID;
- enum backend;
- token API;
- tên model/provider.

### 13.3. Kiểm tra i18n

```bash
pnpm --filter @ai-novel/client i18n:scan
pnpm --filter @ai-novel/client i18n:check
```

Khi thêm namespace mới, cần có file tương ứng ở locale tiếng Việt. Tiếng Việt là fallback bắt buộc của dự án.

---

## 14. Cách lần code khi muốn sửa một chức năng

Không nên bắt đầu bằng việc sửa component đầu tiên nhìn thấy. Hãy lần theo chuỗi sau:

```text
Route UI
  ↓
Page
  ↓
Hook/controller
  ↓
API client function
  ↓
Shared request/response type
  ↓
Backend route
  ↓
Service
  ↓
Database / LLM / event
  ↓
Response projection
  ↓
React Query invalidation
  ↓
UI render
```

### Ví dụ: sửa nút “Tạo chương”

1. Tìm text hoặc handler trong `client/src/pages/novels`.
2. Xác định component nhận `onGenerate`.
3. Lần lên page hoặc hook truyền callback.
4. Tìm hàm trong `client/src/api`.
5. Tìm route tương ứng ở `server/src/routes`.
6. Đọc service mà route gọi.
7. Kiểm tra mutation có lưu task/chapter không.
8. Kiểm tra worker có chạy tiếp không.
9. Kiểm tra response có invalidate chapter/task query không.
10. Kiểm tra UI loading/error/success.

### Ví dụ: sửa chất lượng nội dung AI

Không bắt đầu ở text editor. Hãy đọc:

1. chapter task;
2. context assembler;
3. prompt compiler;
4. provider routing;
5. output parser;
6. audit;
7. repair;
8. state rehydration.

Nếu chỉ sửa UI, nguyên nhân chất lượng thường vẫn còn ở context hoặc prompt.

---

## 15. Các nguyên tắc kiến trúc nên giữ

### 15.1. Route mỏng, service rõ

Route chỉ điều phối HTTP. Logic nghiệp vụ nằm trong service/application layer.

### 15.2. Không để component biết quá nhiều

Component nên hiển thị và phát event. Logic mutation phức tạp nên nằm trong hook/controller.

### 15.3. Dùng type chung

Không tạo một interface frontend gần giống nhưng khác với backend response.

### 15.4. Task dài phải khôi phục được

Mọi workflow nhiều bước cần có:

- trạng thái;
- checkpoint;
- retry policy;
- idempotency;
- lỗi có ý nghĩa;
- resume target.

### 15.5. Dữ liệu nguồn không bị ghi đè bởi dữ liệu dẫn xuất

Audit, summary, embedding hoặc state snapshot không được âm thầm thay thế nội dung người dùng.

### 15.6. Prompt phải có version

Nếu prompt thay đổi, cần biết artifact nào được tạo bởi prompt cũ.

### 15.7. UI không nên chứa dữ liệu backend dạng text đã dịch

Backend nên trả code/enum ổn định. Frontend chịu trách nhiệm hiển thị label theo ngôn ngữ.

---

## 16. Rủi ro cần chú ý khi cải tiến

### Cache cũ

Mutation thành công nhưng query không invalidate khiến người dùng tưởng thao tác thất bại.

### Gọi LLM trùng

Refresh hoặc retry có thể tạo nhiều generation job nếu thiếu idempotency.

### State không đồng nhất

Chapter đã lưu nhưng task vẫn `running`, hoặc task đã `succeeded` nhưng projection chưa cập nhật.

### Context quá lớn

Đưa toàn bộ nhân vật/world/history vào prompt làm tăng token và giảm chất lượng.

### Fallback dữ liệu không rõ

Nếu thiếu bản dịch hoặc thiếu field, UI cần fallback rõ ràng thay vì hiển thị `undefined`, key i18n hoặc text gốc ngoài ý muốn.

### Side effect bị lặp

Indexing, snapshot hoặc state sync phải chịu được việc chạy lại.

### Dữ liệu người dùng bị dịch nhầm

Không dùng hàm dịch UI cho toàn bộ dữ liệu tự do. Tên riêng và nội dung sáng tác phải được giữ nguyên.

---

## 17. Lộ trình đọc code đề xuất

### Mức 1: hiểu sản phẩm

1. `README.md`
2. `docs/public/introduction.md`
3. `docs/public/flow/end-to-end-production.md`
4. `docs/public/flow/auto-director-pipeline.md`
5. `docs/public/flow/chapter-execution.md`

### Mức 2: hiểu frontend

1. `client/src/main.tsx`
2. `client/src/router/index.tsx`
3. `client/src/api/client.ts`
4. `client/src/api/queryKeys.ts`
5. `client/src/pages/novels/autoDirector/AutoDirectorCreatePage.tsx`
6. `client/src/pages/novels/autoDirector/useAutoDirectorCreateController.ts`

### Mức 3: hiểu backend

1. `server/src/app.ts`
2. `server/src/routes`
3. `server/src/db/prisma.ts`
4. `server/src/prisma/schema.sqlite.prisma`
5. `server/src/services/novel/director`
6. `server/src/services/task`
7. `server/src/workers`
8. `server/src/events`

### Mức 4: hiểu AI runtime

1. `server/src/llm`
2. `server/src/prompting`
3. `server/src/services/planner`
4. `server/src/services/audit`
5. `server/src/services/state`
6. `server/src/services/rag`
7. `server/src/services/styleEngine`

### Mức 5: hiểu các module mở rộng

- `server/src/modules/drama`
- `server/src/modules/comic`
- `server/src/modules/marketRadar`
- `server/src/modules/novel`
- `server/src/modules/setup`

---

## 18. Checklist trước khi merge một thay đổi

### Nếu sửa frontend

- [ ] Component có dùng đúng namespace i18n không?
- [ ] Loading/error/empty state đã xử lý chưa?
- [ ] Mutation có invalidate query đúng không?
- [ ] Dữ liệu người dùng có bị dịch nhầm không?
- [ ] Desktop route có bị ảnh hưởng không?
- [ ] Có cần cập nhật shared type không?

### Nếu sửa backend

- [ ] Request đã validate bằng schema chưa?
- [ ] Service có transaction khi cần không?
- [ ] Retry có tạo bản ghi trùng không?
- [ ] Error có đủ thông tin để recovery không?
- [ ] Có cập nhật task/checkpoint không?
- [ ] Event có bị phát trước khi commit không?
- [ ] Có cần migration không?

### Nếu sửa LLM/prompt

- [ ] Input/output schema còn tương thích không?
- [ ] Parser có xử lý output mới không?
- [ ] Token budget có phù hợp không?
- [ ] Prompt version đã cập nhật chưa?
- [ ] Audit và repair có bị ảnh hưởng không?
- [ ] Có test cho trường hợp model trả output thiếu hoặc sai không?

### Nếu sửa i18n

- [ ] Tiếng Việt luôn có key fallback chưa?
- [ ] Tiếng Anh có bản dịch tương ứng chưa?
- [ ] Không còn CJK trong locale `vi/en` chưa?
- [ ] Có dịch nhầm prompt hoặc dữ liệu người dùng không?
- [ ] Đã chạy `i18n:scan` và `i18n:check` chưa?

---

## 19. Kết luận ngắn

Có thể hiểu dự án qua bốn tầng:

```text
UI
  → API
  → Workflow/Service
  → Asset/State/LLM
```

Trong đó:

- UI giúp người dùng chọn và kiểm soát.
- API tạo ranh giới giữa client và server.
- Workflow điều phối các bước dài và có thể khôi phục.
- Asset lưu kết quả có cấu trúc.
- State giữ cho các chương sau nhất quán.
- LLM tạo nội dung nhưng không phải nguồn sự thật duy nhất.
- Database lưu trạng thái lâu dài.
- RAG giúp tìm lại thông tin, nhưng không thay thế dữ liệu nghiệp vụ.

Khi cải tiến, câu hỏi quan trọng nhất cần trả lời là:

> Thay đổi này đang tác động vào UI, dữ liệu nguồn, artifact dẫn xuất, workflow, hay context gửi cho AI?

Trả lời đúng câu hỏi đó trước khi sửa code sẽ giúp tránh nhiều lỗi dây chuyền trong hệ thống.
