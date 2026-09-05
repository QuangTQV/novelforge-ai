-- Xoay tua nhiều API key (round_robin/random/sequential) và fallback liên-provider khi provider chính lỗi.
ALTER TABLE "APIKey" ADD COLUMN "rotationStrategy" TEXT NOT NULL DEFAULT 'round_robin';
ALTER TABLE "APIKey" ADD COLUMN "apiKeyWeight" REAL NOT NULL DEFAULT 1;
ALTER TABLE "APIKey" ADD COLUMN "backupKeysJson" TEXT;
ALTER TABLE "APIKey" ADD COLUMN "cooldownSeconds" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "APIKey" ADD COLUMN "fallbackOrder" INTEGER;
