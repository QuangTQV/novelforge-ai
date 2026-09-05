-- Mức độ suy luận (reasoning effort) chuẩn hóa theo provider và theo từng giai đoạn (TaskType).
ALTER TABLE "APIKey" ADD COLUMN "reasoningEffort" TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE "ModelRouteConfig" ADD COLUMN "reasoningEffort" TEXT;
