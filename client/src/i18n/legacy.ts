type LegacyTranslator = (source: string, variables?: Record<string, unknown>) => string;

let translator: LegacyTranslator = (source) => source;

/** Configure the bridge from the i18next bootstrap without creating an import cycle. */
export function configureLegacyTranslator(nextTranslator: LegacyTranslator): void {
  translator = nextTranslator;
}

/** Compatibility bridge for static UI copy during the full namespace migration. */
export function translateUi(source: string, variables?: Record<string, unknown>): string {
  if (!source.trim()) return source;
  return translator(source, variables);
}
