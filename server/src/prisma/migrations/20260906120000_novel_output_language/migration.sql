-- Ngôn ngữ đầu ra cho nội dung tiểu thuyết do AI sinh. NULL ⇒ coi như "zh".
ALTER TABLE "Novel" ADD COLUMN "novelLanguage" TEXT;
