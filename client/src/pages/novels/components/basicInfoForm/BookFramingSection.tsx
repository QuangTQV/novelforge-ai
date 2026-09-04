import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { BASIC_INFO_FIELD_HINTS, type NovelBasicFormState } from "../../novelBasicInfo.shared";
import { FieldLabel } from "./BasicInfoFormPrimitives";

interface BookFramingSectionProps {
  basicForm: NovelBasicFormState;
  onFormChange: (patch: Partial<NovelBasicFormState>) => void;
  quickFill?: ReactNode;
}

export function BookFramingSection(props: BookFramingSectionProps) {
  const { basicForm, onFormChange, quickFill } = props;
  const { t } = useTranslation("novelOutline");
  const controlClassName = "rounded-xl border-0 bg-background/85 ring-1 ring-border/50 transition-colors hover:bg-background focus-visible:ring-primary/30";

  return (
    <div className="space-y-5">
      <div className="flex min-h-16 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("bookFramingSection.heading")}</h3>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">
            {t("bookFramingSection.subtitle")}
          </div>
        </div>
        {quickFill ? <div className="shrink-0">{quickFill}</div> : null}
      </div>

      <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel htmlFor="basic-target-audience" hint={BASIC_INFO_FIELD_HINTS.targetAudience}>
            {t("bookFramingSection.targetAudience.label")}
          </FieldLabel>
          <Input
            id="basic-target-audience"
            className={controlClassName}
            value={basicForm.targetAudience}
            placeholder={t("bookFramingSection.targetAudience.placeholder")}
            onChange={(event) => onFormChange({ targetAudience: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="basic-commercial-tags" hint={BASIC_INFO_FIELD_HINTS.commercialTagsText}>
            {t("bookFramingSection.commercialTags.label")}
          </FieldLabel>
          <Input
            id="basic-commercial-tags"
            className={controlClassName}
            value={basicForm.commercialTagsText}
            placeholder={t("bookFramingSection.commercialTags.placeholder")}
            onChange={(event) => onFormChange({ commercialTagsText: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="basic-competing-feel" hint={BASIC_INFO_FIELD_HINTS.competingFeel}>
            {t("bookFramingSection.competingFeel.label")}
          </FieldLabel>
          <Input
            id="basic-competing-feel"
            className={controlClassName}
            value={basicForm.competingFeel}
            placeholder={t("bookFramingSection.competingFeel.placeholder")}
            onChange={(event) => onFormChange({ competingFeel: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="basic-book-selling-point" hint={BASIC_INFO_FIELD_HINTS.bookSellingPoint}>
            {t("bookFramingSection.sellingPoint.label")}
          </FieldLabel>
          <textarea
            id="basic-book-selling-point"
            rows={3}
            className={`${controlClassName} min-h-[104px] w-full resize-y px-3 py-2.5 text-sm leading-6 outline-none`}
            value={basicForm.bookSellingPoint}
            placeholder={t("bookFramingSection.sellingPoint.placeholder")}
            onChange={(event) => onFormChange({ bookSellingPoint: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="basic-first30-promise" hint={BASIC_INFO_FIELD_HINTS.first30ChapterPromise}>
          {t("bookFramingSection.first30.label")}
        </FieldLabel>
        <textarea
          id="basic-first30-promise"
          rows={4}
          className={`${controlClassName} min-h-[120px] w-full resize-y px-3 py-2.5 text-sm leading-6 outline-none`}
          value={basicForm.first30ChapterPromise}
          placeholder={t("bookFramingSection.first30.placeholder")}
          onChange={(event) => onFormChange({ first30ChapterPromise: event.target.value })}
        />
      </div>
    </div>
  );
}
