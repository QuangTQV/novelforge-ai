import { translateUi } from "@/i18n/legacy";
import { Dialog, AppDialogContent } from "@/components/ui/dialog";
import { VisualAssetLibrary } from "./VisualAssetLibrary";
import type { VisualAssetLibraryDialogProps } from "./visualAssetLibrary.types";

export function VisualAssetLibraryDialog({
  open,
  onOpenChange,
  selectionMode = "browse",
  ...libraryProps
}: VisualAssetLibraryDialogProps) {
  const isPicker = selectionMode !== "browse";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        title={isPicker ? translateUi("选择视觉素材") : translateUi("视觉资源库")}
        description={isPicker ? translateUi("从已有素材中选择，确认后带回当前创作。") : translateUi("查看并整理作品中的图片素材。")}
        className="h-[min(88dvh,900px)] w-[min(90vw,1440px)] max-w-none"
        bodyClassName="overflow-hidden p-0"
      >
        <VisualAssetLibrary {...libraryProps} selectionMode={selectionMode} />
      </AppDialogContent>
    </Dialog>
  );
}
