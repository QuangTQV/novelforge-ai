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

## 10. Giải thích chi tiết từng bước tạo nội dung chương

Phần này giải thích chính xác hơn chuỗi xử lý ở trên. Cần nhớ rằng đây là **luồng chuẩn về mặt khái niệm**. Một số bước có thể đã được tạo từ trước trong Auto Director; một số bước được `GenerationContextAssembler` dựng lại hoặc bổ sung ngay trước khi viết chương.

Các file runtime quan trọng:

- `server/src/services/novel/runtime/ChapterRuntimeCoordinator.ts`
- `server/src/services/novel/runtime/ChapterStreamGenerationOrchestrator.ts`
- `server/src/services/novel/runtime/GenerationContextAssembler.ts`
- `server/src/services/novel/production/ContextAssemblyService.ts`
- `server/src/services/novel/runtime/ChapterContentFinalizationService.ts`
- `server/src/services/novel/runtime/ChapterTimelineFinalizationService.ts`
- `server/src/services/novel/production/NovelPipelineExecutor.ts`
- `server/src/prompting/prompts/novel/chapterLayeredContext.ts`

### 10.1. Bức tranh tổng quát

Có thể chia một lần tạo chương thành bốn pha:

```text
Pha A — Chuẩn bị kế hoạch và dữ liệu
  Chapter task → kế hoạch chương → context assembly

Pha B — Xây context cho model
  book/world/character/state/RAG/style → context package → prompt blocks

Pha C — Sinh và lưu nội dung
  prompt compiler → LLM stream → draft → finalize

Pha D — Kiểm tra và hồi lưu
  audit → repair/review → state/fact/payoff/artifact sync
```

Kết quả cuối cùng không chỉ là một chuỗi `content`. Hệ thống cố gắng tạo một gói kết quả gồm:

- nội dung chương;
- artifact bản nháp;
- audit report;
- trạng thái chapter;
- timeline event;
- character/resource changes;
- payoff/reader promise changes;
- thông tin cho chương tiếp theo;
- token usage và runtime trace.

---

### 10.2. Bước 1 — Chapter task

`Chapter task` là nhiệm vụ “viết chương X”, không phải nội dung chương hoàn chỉnh.

Task thường chứa hoặc liên kết tới:

- `novelId`;
- `chapterId`;
- số chương;
- execution scope;
- provider/model;
- run mode;
- retry policy;
- workflow task id;
- trạng thái hiện tại;
- checkpoint và resume target.

Task được tạo khi người dùng bấm viết chương, hoặc khi `NovelPipelineExecutor` chạy batch.

Nhiệm vụ của task là trả lời:

```text
Viết chương nào?
Đang chạy theo chế độ nào?
Được phép tự động đến đâu?
Nếu lỗi thì tiếp tục từ đâu?
```

Task không chứa toàn bộ context. Context được dựng lại ở thời điểm chạy để tránh dùng dữ liệu cũ.

---

### 10.3. Bước 2 — Book contract

Book contract là “hợp đồng cấp sách”, giúp mỗi chương vẫn thuộc cùng một cuốn sách.

Các trường chính trong `shared/types/novelWorkflow.ts` gồm:

- `readingPromise`: độc giả sẽ nhận được trải nghiệm gì;
- `protagonistFantasy`: mong muốn/trải nghiệm trung tâm của nhân vật chính;
- `coreSellingPoint`: điểm bán cốt lõi;
- `chapter3Payoff`: phần thưởng hoặc cam kết sớm;
- `chapter10Payoff`: cam kết trung hạn;
- `chapter30Payoff`: cam kết lớn hơn;
- `escalationLadder`: xung đột và phần thưởng tăng dần thế nào;
- `relationshipMainline`: tuyến quan hệ chính;
- `absoluteRedLines`: những điều không được vi phạm.

Book contract không viết hộ chương. Nó đặt giới hạn cấp sách để model không tạo một chương hay nhưng lệch khỏi lời hứa ban đầu.

Ví dụ:

```text
Book contract:
  - nhân vật chính phải liên tục giành lại quyền chủ động;
  - tuyến tình cảm phải tiến triển từng bước;
  - không được tiết lộ bí mật X trước chương 30;
  - mỗi giai đoạn phải có phần thưởng rõ ràng.
```

Khi tạo prompt chương, contract thường được chuyển thành một context block bằng `buildBookContractContext`.

---

### 10.4. Bước 3 — Story macro

Story macro là bản đồ vĩ mô của toàn bộ câu chuyện. Nó đứng giữa book contract và kế hoạch tập/chương.

Các trường quan trọng:

- premise mở rộng;
- protagonist core;
- conflict engine;
- conflict layers: external, internal, relational;
- mystery box;
- emotional line;
- setpiece seeds;
- tone reference;
- selling point;
- main hook;
- progression loop;
- growth path;
- major payoffs;
- ending flavor;
- constraints.

Story macro trả lời:

```text
Câu chuyện vận hành nhờ xung đột nào?
Nhân vật chính thay đổi ra sao?
Những bí mật và phần thưởng lớn nào đang chờ?
Nhịp tiến triển lặp lại của truyện là gì?
Điểm kết thúc cần giữ cảm giác nào?
```

Nó không quyết định từng câu văn. Nó giúp chapter plan và volume plan không đi lệch khỏi hướng chính.

---

### 10.5. Bước 4 — Volume strategy

Volume strategy là chiến lược của tập hiện tại. Một cuốn dài được chia thành nhiều tập để model không phải lập kế hoạch toàn bộ chi tiết ngay từ đầu.

Một volume thường có:

- mục tiêu tập;
- opening hook;
- main promise;
- pressure source;
- core selling point;
- escalation mode;
- protagonist change;
- mid-volume risk;
- climax;
- payoff type;
- next volume hook;
- reset point;
- open payoffs.

Volume strategy trả lời:

```text
Tập này muốn đạt điều gì?
Áp lực chính của tập là gì?
Nhân vật phải thay đổi ra sao?
Cuối tập cần trả phần thưởng nào?
Tập tiếp theo được kéo bằng hook nào?
```

Khi tạo một chương, hệ thống thường chỉ lấy cửa sổ volume liên quan thay vì toàn bộ kế hoạch của mọi tập.

---

### 10.6. Bước 5 — Beat sheet

Beat sheet chia volume thành các nhịp lớn hơn chương.

Một beat có thể mô tả:

- key/id;
- label;
- title;
- mục tiêu;
- xung đột;
- reveal;
- emotion beat;
- khoảng chương;
- phần thưởng hoặc thay đổi cần đạt.

Beat sheet giúp chương biết mình đang đứng ở đoạn nào của đường cong:

```text
thiết lập → áp lực → thử thách → đảo chiều → trả thưởng → mở hướng mới
```

Nếu chương chỉ nhìn vào title mà không nhìn beat sheet, nó dễ tạo nội dung rời rạc hoặc giải quyết vấn đề quá sớm.

---

### 10.7. Bước 6 — Chapter task sheet

Chapter task sheet là hợp đồng trực tiếp cho một chương. Đây là phần gần với “đề bài viết” nhất.

Nó có thể chứa:

- mục tiêu chương;
- vai trò chương trong volume;
- participants;
- reveals;
- risk notes;
- `mustAdvance`;
- `mustPreserve`;
- hook target;
- scenes;
- source issue ids;
- payoff references.

Một task sheet tốt trả lời được:

```text
Chương này phải làm gì?
Nhân vật nào cần tham gia?
Điều gì bắt buộc phải tiến triển?
Điều gì phải giữ nguyên?
Điều gì chưa được tiết lộ?
Cuối chương cần tạo lực kéo nào?
```

Trong chế độ full-book autopilot, `ChapterPlanJITService` có thể tạo hoặc đảm bảo task sheet ngay trước khi viết nếu chương chưa có đủ execution contract.

Đây là lý do task sheet có thể được tạo “just in time” thay vì luôn tạo toàn bộ danh sách kế hoạch từ đầu cuốn sách.

---

### 10.8. Bước 7 — Chọn nhân vật tham gia chương

Hệ thống không nên đưa tất cả nhân vật của tiểu thuyết vào prompt. `resolveChapterResourceCharacterIds` và các helper liên quan chọn nhóm nhân vật cục bộ.

Nguồn để chọn gồm:

- participants trong chapter plan;
- nhân vật được nêu trong scene;
- nhân vật có quan hệ với người tham gia;
- nhân vật đang mang trạng thái hoặc mục tiêu cần xử lý;
- nhân vật bắt buộc theo task sheet.

Mục tiêu:

```text
6 nhân vật liên quan có ích
  tốt hơn
30 nhân vật không liên quan
```

Nếu chọn quá ít, chương có thể quên nhân vật phụ quan trọng. Nếu chọn quá nhiều, prompt dài, chi phí cao và model bị loãng.

---

### 10.9. Bước 8 — Character resource ledger

Character resource ledger không chỉ là bảng tên nhân vật. Nó là sổ các tài nguyên kể chuyện đang thuộc về hoặc liên quan tới nhân vật.

Ví dụ resource:

- năng lực;
- vật phẩm;
- bí mật;
- thông tin;
- quan hệ;
- quyền lực;
- món nợ;
- vết thương;
- lời hứa;
- bằng chứng;
- thân phận;
- trạng thái đã được xác nhận.

Mỗi resource có thể có:

- owner;
- loại resource;
- trạng thái;
- nguồn xuất hiện;
- chapter refs;
- rủi ro;
- có được phép sử dụng ngay hay chưa;
- đang chờ người dùng xác nhận hay không.

Ledger giúp tránh lỗi như:

```text
Chương 12 dùng một thanh kiếm
nhưng thanh kiếm chưa từng được tạo hoặc trao cho nhân vật.
```

Các resource chưa được xác nhận không nên bị viết như sự thật chắc chắn. Chúng có thể trở thành proposal hoặc issue chờ review.

---

### 10.10. Bước 9 — World slice

World slice là phần nhỏ của world cần dùng cho chương hiện tại, không phải toàn bộ world.

Nó có thể gồm:

- sân khấu chính;
- địa điểm hiện tại;
- địa điểm sắp đi tới;
- thế lực liên quan;
- quy tắc cứng;
- giới hạn thân phận;
- tài nguyên thế giới;
- điều cấm;
- áp lực môi trường;
- các quan hệ kiểm soát hoặc đối đầu.

Ví dụ, nếu chương diễn ra trong một khu chợ thuộc thành phố hiện thực, prompt không nhất thiết cần toàn bộ lịch sử của cả thế giới. Nó cần:

```text
Địa điểm: khu chợ phía nam
Thế lực: gia tộc đang kiểm soát khu vực
Quy tắc: không sử dụng phép thuật công khai
Giới hạn: nhân vật chính chưa được lộ thân phận
Áp lực: thời hạn giao hàng và sự giám sát
```

`WorldContextGateway` và các service world slice chịu trách nhiệm chọn dữ liệu này.

World slice giúp giảm hallucination và ngăn model tự ý mở rộng luật thế giới.

---

### 10.11. Bước 10 — Timeline và payoff

#### Timeline

Timeline cho biết những gì đã xảy ra, đang xảy ra và chưa được phép xảy ra.

Nó có thể chứa:

- sự kiện các chương trước;
- thời gian hiện tại;
- địa điểm;
- event bắt buộc trong chương;
- event bị cấm tiết lộ sớm;
- thay đổi trạng thái;
- hook đang mở;
- hook đã được xử lý.

Timeline ngăn lỗi continuity như:

- nhân vật xuất hiện ở nơi chưa thể tới;
- sự kiện bị lặp;
- bí mật đã tiết lộ nhưng lại được coi là bí mật;
- vật phẩm bị mất rồi vẫn được dùng.

#### Payoff ledger

Payoff ledger theo dõi lời hứa và phần thưởng cần trả cho độc giả.

Trạng thái có thể gồm:

```text
setup → hinted → pending_payoff → paid_off
                         ├→ overdue
                         └→ failed
```

Trong `ContextAssemblyService`, các payoff quá hạn/khẩn cấp/đang chờ được chọn giới hạn số lượng. Với mỗi payoff, hệ thống tạo directive:

- `seed`: mới gieo;
- `touch`: chạm nhẹ;
- `pressure`: tạo áp lực để chuẩn bị trả;
- `forbid`: không được tiết lộ vì chạm protected secret.

Điều này quan trọng: chương không phải lúc nào cũng được phép “trả” payoff. Có payoff chỉ được gieo hoặc gây áp lực.

---

### 10.12. Bước 11 — Knowledge/RAG retrieval

RAG là bước tìm lại tư liệu liên quan bằng ngữ nghĩa. Nó không phải nơi lưu toàn bộ trạng thái nghiệp vụ của cuốn sách.

#### RAG truy xuất dữ liệu gì?

Tùy cấu hình indexing, RAG có thể truy xuất các loại dữ liệu sau:

1. **Tài liệu người dùng nhập vào knowledge base**
   - tư liệu tham khảo;
   - nghiên cứu;
   - ghi chú thế giới;
   - tài liệu bối cảnh;
   - tài liệu dùng để xây dựng phong cách.

2. **Nội dung các chương trước**
   - đoạn văn liên quan đến nhân vật;
   - lần xuất hiện của địa điểm/vật phẩm;
   - cách một sự kiện đã được mô tả;
   - chi tiết cần giữ nhất quán.

3. **Kết quả phân tích sách**
   - hồ sơ nhân vật;
   - bằng chứng nhân vật trong văn bản;
   - timeline được trích xuất;
   - motif hoặc đặc điểm phong cách;
   - kết luận từ các vùng đã phân tích.

4. **Các production artifact được phép index**
   - summary;
   - world notes;
   - story macro fragments;
   - chapter facts;
   - các tài liệu đã được xác nhận.

RAG **không nên là nguồn duy nhất** cho:

- trạng thái hiện tại của task;
- enum nghiệp vụ;
- quyền chỉnh sửa;
- chapter status;
- payoff status chính thức;
- dữ liệu đang chờ user approval;
- source data mới nhất nếu database đã có bản canonical.

#### Ví dụ query RAG

Khi chuẩn bị chương 12, query có thể được dựng từ:

```text
Tên sách: Thành phố sau cơn mưa
Chương: 12
Nhân vật: An, Minh, bà chủ tiệm
Địa điểm: khu chợ phía nam
Mục tiêu: tìm bằng chứng trước khi bị theo dõi
Từ khóa cần giữ: chiếc nhẫn bạc, lời hứa của Minh
```

RAG có thể trả về:

```text
Chunk A: chương 3 — chiếc nhẫn bạc có vết nứt ở mặt trong
Chunk B: chương 7 — Minh đã nói dối về nguồn gốc chiếc nhẫn
Chunk C: tài liệu world — khu chợ phía nam cấm giao dịch sau giờ giới nghiêm
Chunk D: phân tích nhân vật — An thường che giấu sợ hãi bằng cách kiểm tra đồ vật
```

Các chunk này được đưa vào context như **tư liệu tham khảo có nguồn**, sau đó prompt yêu cầu model ưu tiên dữ liệu đã xác nhận và không biến suy đoán thành sự thật.

#### RAG indexing và retrieval khác nhau

```text
Indexing:
  document/chapter/artifact → chunk → embedding → Qdrant

Retrieval:
  chapter query → embedding query → search Qdrant → rank/filter → context block
```

Metadata và trạng thái job nằm trong database; vector nằm trong Qdrant. Nếu Qdrant lỗi, hệ thống vẫn phải dùng được canonical database context ở mức tối thiểu.

---

### 10.13. Bước 12 — State-driven context

Ngoài các artifact như book contract hoặc beat sheet, runtime còn dựng canonical state.

`ContextAssemblyService` gọi `canonicalStateService.getSnapshot(...)` để lấy snapshot theo novel/chapter và cửa sổ timeline.

Snapshot có thể cung cấp:

- current chapter;
- current chapter goal;
- local characters;
- open conflicts;
- overdue/urgent/pending payoffs;
- recent timeline;
- hidden knowledge;
- protected secrets;
- pending review proposals;
- trạng thái điều khiển hiện tại.

Sau đó `generationDecisionEngine` quyết định hành động tiếp theo, ví dụ:

```text
generate_chapter
hold_for_review
repair_existing_draft
replan_window
```

Đây là lớp bảo vệ để hệ thống không viết tiếp khi đang có vấn đề cần người dùng xử lý.

---

### 10.14. Bước 13 — Style profile

Style profile là cách viết cấp sách hoặc cấp mục tiêu, không phải nội dung cốt truyện.

Nó có thể quy định:

- độ dài câu;
- nhịp đoạn;
- giọng kể;
- mức mô tả;
- cách dùng đối thoại;
- mật độ hành động;
- mức trữ tình;
- ví dụ văn phong;
- điều cần tránh;
- profile đã bind cho novel hay chưa.

`StyleBindingService` tìm profile đang được liên kết, sau đó compiler tạo các block nhẹ hoặc đầy đủ tùy giai đoạn.

Style profile trả lời:

```text
Viết như thế nào?
```

Trong khi book contract trả lời:

```text
Viết câu chuyện gì và phải giữ lời hứa nào?
```

Không nên trộn hai khái niệm này vào một object duy nhất.

---

### 10.15. Bước 14 — Anti-AI rules

Anti-AI rules là các rule giảm cảm giác văn bản máy móc hoặc lỗi biểu đạt.

Ví dụ:

- không giải thích tâm lý trực tiếp quá nhiều;
- không kết luận chủ đề ở cuối mọi đoạn;
- tránh các đoạn có cấu trúc giống hệt nhau;
- tránh lặp từ/câu;
- giữ hành động và phản ứng cụ thể;
- không dùng quá nhiều câu chung chung;
- giữ khác biệt giọng nói giữa nhân vật.

Các rule này không được phép phá vỡ story contract. Ví dụ, rule tránh giải thích không có nghĩa là được bỏ mất thông tin bắt buộc của chapter task sheet.

Style và anti-AI rules thường được biên dịch thành prompt blocks, thay vì nối chuỗi tùy tiện trong component.

---

### 10.16. Bước 15 — GenerationContextAssembler

Đây là bước hợp nhất các nguồn trên thành `GenerationContextPackage`.

Trong code, `GenerationContextAssembler` thực hiện nhiều việc:

1. Đọc novel và chapter.
2. Đảm bảo chapter plan/execution contract nếu cần.
3. Xác định nhân vật liên quan.
4. Đọc plan, scene cards và previous chapters.
5. Đọc book contract/story macro/volume window.
6. Đọc world context/world slice.
7. Đọc character hard facts/resource ledger.
8. Đọc timeline và payoff.
9. Chạy RAG retrieval.
10. Đọc style binding.
11. Đọc pending proposals và audit issues.
12. Tính readiness và next action.
13. Tạo các context blocks có giới hạn token.

Kết quả không phải là một prompt duy nhất ngay lập tức. Nó là package có cấu trúc, sau đó prompt asset mới quyết định cách ghép thành messages.

---

### 10.17. Bước 16 — Prompt compiler

Prompt compiler nhận context package và biến nó thành input cho model.

Một prompt thường gồm các phần:

```text
system instructions
  + book contract
  + story/volume context
  + chapter mission
  + character context
  + world context
  + timeline/payoff constraints
  + RAG evidence
  + style rules
  + anti-AI rules
  + output requirements
```

`chapterLayeredContext.ts` chia context thành các lớp để:

- bật/tắt theo loại tác vụ;
- giới hạn token;
- dùng context khác nhau cho write/review/repair;
- tránh nhồi tất cả dữ liệu vào mọi prompt.

Prompt compiler cũng cần bảo vệ thứ tự ưu tiên:

```text
hard constraints / confirmed facts
  > chapter task
  > relevant context
  > style preference
  > optional inspiration
```

Nếu RAG trả về thông tin mâu thuẫn với canonical state, canonical state và dữ liệu đã xác nhận phải được ưu tiên.

---

### 10.18. Bước 17 — LLM streaming

`ChapterWritingGraph` nhận:

- novel id;
- novel title;
- chapter;
- context package;
- request options.

Sau đó gọi provider thông qua LLM runtime và trả về stream.

Frontend có thể nhận từng chunk để hiển thị tiến độ. Nhưng nội dung tạm thời trong stream chưa phải bản ghi cuối cùng.

Trong lúc stream:

- không nên coi draft là đã hoàn tất;
- không nên chạy state sync cuối cùng;
- cần xử lý connection interruption;
- cần lưu/tiếp tục theo cơ chế runtime phù hợp.

Khi stream xong, callback `onDone` mới bắt đầu pha finalize.

---

### 10.19. Bước 18 — Draft và finalize

Sau khi LLM trả text, `ChapterStreamGenerationOrchestrator`:

1. Kiểm tra nội dung có rỗng không.
2. Có thể retry nếu output rỗng.
3. Chuẩn hóa text.
4. Ghi draft/artifact.
5. Chạy quality gate/acceptance assessment.
6. Lưu chapter content và status.
7. Chuẩn bị runtime package.

Các trạng thái chapter có thể chuyển qua:

```text
pending_generation
  → generating
  → pending_review
  → completed

hoặc

generating
  → needs_repair
```

Cần phân biệt:

- text đang stream;
- draft đã lưu;
- draft đã qua acceptance;
- chapter đã hoàn tất toàn bộ hậu xử lý.

---

### 10.20. Bước 19 — Audit

Audit kiểm tra draft sau khi sinh. Các loại audit chính gồm:

- `continuity`: có khớp timeline/fact không;
- `character`: nhân vật có hành động/giọng nói đúng không;
- `plot`: có hoàn thành nhiệm vụ chương không;
- `mode_fit`: có đúng story mode không.

Ngoài audit nội dung, runtime còn có thể kiểm tra:

- độ dài;
- opening diversity;
- chapter obligations;
- protected secrets;
- resource consistency;
- payoff coverage;
- quality debt.

Audit tạo issue có:

- code;
- type;
- severity;
- description;
- chapter reference;
- status;
- repair hint.

Audit report là derived artifact. Nó không được âm thầm sửa source data.

---

### 10.21. Bước 20 — Repair hoặc chờ người dùng

Sau audit, `ChapterQualityGateService` và acceptance assessment quyết định hướng đi:

```text
Không có issue chặn
  → chấp nhận và tiếp tục

Có issue nhỏ, sửa được
  → patch/heavy repair

Có issue đổi hướng truyện
  → chờ review hoặc replan

Output lỗi/rỗng/provider lỗi
  → retry hoặc đổi model
```

Repair không nên viết lại toàn bộ chương nếu chỉ có lỗi cục bộ. Nó nên nhận:

- draft hiện tại;
- issue list;
- repair guidance;
- chapter task;
- context package cần thiết;
- RAG context liên quan;
- giới hạn vùng được sửa.

Sau repair cần audit lại. Không nên đánh dấu thành công chỉ vì model trả về một chuỗi mới.

---

### 10.22. Bước 21 — State rehydration

Đây là bước biến nội dung vừa viết thành dữ liệu có ích cho các chương sau.

Hệ thống có thể trích xuất và đồng bộ:

- sự kiện timeline;
- trạng thái nhân vật;
- thay đổi quan hệ;
- facts mới;
- resource changes;
- foreshadow state;
- payoff progress;
- open conflicts;
- chapter summary;
- quality debt;
- artifact dependency;
- RAG indexing job.

Ví dụ:

```text
Chương 12:
  An tìm thấy nhẫn bạc
  Minh phủ nhận biết nguồn gốc chiếc nhẫn
  Quan hệ An–Minh tăng căng thẳng
  Bí mật chiếc nhẫn vẫn chưa được trả
  Hook “người theo dõi” chuyển sang trạng thái active
```

Chương 13 khi được tạo sẽ đọc các state này thay vì chỉ đọc lại toàn bộ văn bản chương 12.

Đây là ý nghĩa của “rehydration”: xây lại context hiện tại từ các dữ liệu đã được lưu và xác nhận.

---

### 10.23. RAG khác state rehydration như thế nào?

Hai khái niệm này dễ bị nhầm:

| Thành phần | Mục đích | Ví dụ |
|---|---|---|
| Canonical state | Sự thật nghiệp vụ hiện tại | An đang bị thương, payoff X đang chờ trả |
| RAG | Tìm đoạn tư liệu liên quan | Đoạn chương 3 mô tả chiếc nhẫn |
| Chapter plan | Việc chương phải làm | Chương 12 phải tìm bằng chứng |
| Book contract | Lời hứa cấp sách | Bí mật chỉ được tiết lộ sau chương 30 |
| Style profile | Cách diễn đạt | Câu ngắn, nhiều hành động |
| Audit report | Vấn đề sau khi viết | Chương chưa trả mục tiêu |

Quy tắc thực tế:

```text
State quyết định sự thật hiện tại.
RAG cung cấp bằng chứng/tư liệu liên quan.
Plan quyết định nhiệm vụ.
Contract quyết định giới hạn.
Style quyết định cách viết.
Audit kiểm tra kết quả.
```

---

### 10.24. Ví dụ đầy đủ: tạo chương 12

Giả sử chapter 12 có nhiệm vụ “An tìm bằng chứng trong khu chợ phía nam”.

#### Input đã lưu

```text
Book contract:
  Không tiết lộ nguồn gốc thật của chiếc nhẫn trước chương 30.

Volume strategy:
  Tập 1 phải làm An chuyển từ bị động sang chủ động.

Beat sheet:
  Beat 4: tìm dấu vết nhưng bị theo dõi.

Chapter task sheet:
  - An phải tìm được một manh mối.
  - Minh phải xuất hiện.
  - Không được giải thích toàn bộ thân phận Minh.
  - Cuối chương phải mở nguy cơ bị phát hiện.
```

#### Context từ state

```text
An: đang nghi ngờ Minh nhưng chưa có bằng chứng.
Minh: từng nói dối về chiếc nhẫn.
Open conflict: có người theo dõi An.
Payoff: nguồn gốc chiếc nhẫn — chỉ được tạo áp lực, chưa được trả.
Protected secret: thân phận thật của Minh.
```

#### Context từ RAG

```text
Chương 3: chiếc nhẫn có vết nứt bên trong.
Chương 7: Minh né tránh câu hỏi về chiếc nhẫn.
World document: khu chợ phía nam đóng cửa sau giờ giới nghiêm.
```

#### Prompt instruction kết hợp

```text
Viết chương 12.
Phải để An tìm được manh mối mới.
Không được tiết lộ nguồn gốc chiếc nhẫn.
Không được biến suy đoán về Minh thành sự thật.
Phải giữ quy tắc giờ giới nghiêm của khu chợ.
Cuối chương tạo nguy cơ An nhận ra mình đang bị theo dõi.
Giữ phong cách câu ngắn, hành động rõ và tránh giải thích tâm lý trực tiếp.
```

#### Kết quả sau khi viết

Audit kiểm tra:

- An có thực sự tìm được manh mối chưa?
- Minh có bị tiết lộ quá sớm không?
- Quy tắc khu chợ có bị vi phạm không?
- Cuối chương có tạo nguy cơ mới không?
- Chiếc nhẫn có bị mô tả mâu thuẫn chương 3 không?

Sau đó state rehydration ghi nhận manh mối và nguy cơ mới, nhưng payoff nguồn gốc chiếc nhẫn vẫn ở trạng thái chưa trả.

---

### 10.25. Nên đọc code theo thứ tự nào cho luồng này?

Để hiểu thực thi thật, đọc theo thứ tự:

1. `server/src/modules/novel/production/http/novelChapterGeneration.ts`
2. `server/src/services/novel/runtime/ChapterRuntimeCoordinator.ts`
3. `server/src/services/novel/runtime/ChapterStreamGenerationOrchestrator.ts`
4. `server/src/services/novel/runtime/GenerationContextAssembler.ts`
5. `server/src/services/novel/production/ContextAssemblyService.ts`
6. `server/src/prompting/prompts/novel/chapterLayeredContext.ts`
7. `server/src/services/novel/chapterWritingGraph.ts`
8. `server/src/services/novel/runtime/ChapterContentFinalizationService.ts`
9. `server/src/services/audit/AuditService.ts`
10. `server/src/services/novel/runtime/repair/`
11. `server/src/services/novel/runtime/ChapterTimelineFinalizationService.ts`
12. `server/src/services/novel/runtime/ChapterArtifactDeltaService.ts`
13. `server/src/services/rag/`
14. `server/src/services/novel/state/CanonicalStateService.ts`

Khi đọc mỗi file, hãy ghi lại bốn cột:

| Cột | Câu hỏi |
|---|---|
| Reads | Nó đọc dữ liệu gì? |
| Transforms | Nó biến đổi dữ liệu ra sao? |
| Writes | Nó ghi artifact/state nào? |
| Blocks | Điều kiện nào khiến nó dừng? |

Nếu trả lời được bốn cột này, bạn đã hiểu được phần lớn luồng tạo nội dung.

---

## 11. LLM và prompt system

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

## 12. RAG và knowledge base

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

## 13. Event bus và side effects

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

## 14. i18n

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

## 15. Cách lần code khi muốn sửa một chức năng

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

## 16. Các nguyên tắc kiến trúc nên giữ

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

## 17. Rủi ro cần chú ý khi cải tiến

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

## 18. Lộ trình đọc code đề xuất

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

## 19. Checklist trước khi merge một thay đổi

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

## 20. Kết luận ngắn

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
