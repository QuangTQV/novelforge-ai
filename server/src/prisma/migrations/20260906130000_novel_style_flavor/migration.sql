-- Phong cách văn phong áp cho nội dung tiểu thuyết do AI sinh. NULL ⇒ coi như "manga".
ALTER TABLE "Novel" ADD COLUMN "styleFlavor" TEXT;
