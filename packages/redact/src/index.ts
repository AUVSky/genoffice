/**
 * OOXML redaction marker constants.
 *
 * The interactive "hide from the model" feature is gone from this build; these
 * strings remain only so the docx/pptx engines keep round-tripping documents
 * that already carry the custom marker element.
 */
export const REDACT_NS = 'https://genspark.ai/genoffice/redaction/2026'
export const REDACT_PREFIX = 'go'
export const REDACT_EL = `${REDACT_PREFIX}:redact`
