import { useTranslation } from "react-i18next";
import type { BasicTabProps } from "./NovelEditView.types";
import NovelWorldManagerCard from "./NovelWorldManagerCard";
import DirectorTakeoverEntryPanel from "./DirectorTakeoverEntryPanel";
import { SectionBlock } from "./workspaceShell";

export default function WorldSetupTab(props: BasicTabProps) {
  const { t } = useTranslation("novelWorld");
  return (
    <div className="space-y-5">
      <DirectorTakeoverEntryPanel
        title={t("worldSetupTab.directorTakeover.title")}
        description={t("worldSetupTab.directorTakeover.description")}
        entry={props.directorTakeoverEntry}
      />
      <SectionBlock
        title={t("worldSetupTab.section.title")}
        description={t("worldSetupTab.section.description")}
      >
        <NovelWorldManagerCard
          view={props.novelWorldView}
          syncDiff={props.novelWorldSyncDiff}
          worldOptions={props.worldOptions}
          selectedWorldId={props.basicForm.worldId}
          isLoading={props.isLoadingNovelWorld}
          isImporting={props.isImportingNovelWorld}
          isGenerating={props.isGeneratingNovelWorld}
          isCreatingManual={props.isCreatingManualNovelWorld}
          isSavingToLibrary={props.isSavingNovelWorldToLibrary}
          isLoadingSyncDiff={props.isLoadingNovelWorldSyncDiff}
          isSyncing={props.isSyncingNovelWorld}
          usageView={props.worldSliceView}
          usageMessage={props.worldSliceMessage}
          isRefreshingWorldSlice={props.isRefreshingWorldSlice}
          isSavingWorldSliceOverrides={props.isSavingWorldSliceOverrides}
          onImport={props.onImportNovelWorld}
          onCreateManual={props.onCreateManualNovelWorld}
          onGenerate={props.onGenerateNovelWorld}
          onSaveToLibrary={props.onSaveNovelWorldToLibrary}
          onSync={props.onSyncNovelWorld}
          onRefreshWorldSlice={props.onRefreshWorldSlice}
          onSaveWorldSliceOverrides={props.onSaveWorldSliceOverrides}
        />
      </SectionBlock>
    </div>
  );
}
