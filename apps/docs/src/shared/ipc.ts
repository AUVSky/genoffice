import type { ActionCommandId, CommandMenuState } from './commands'
import type { KeyOverrides } from './keybindings'
import type { HeadlessExportTarget } from '@genoffice/electron-utils/headless-export'
import type { FaceVerticalMetrics } from '@genoffice/font-metrics'
import type { SaveAsExportFormat } from './save-as-format'

export interface OpenFileResult {
  path: string
  name: string
  /** one-shot URL serving the docx bytes (fetch it exactly once) */
  dataUrl: string
  /** sha256 of the original file; original archived under this hash */
  hash: string
  /** the on-disk file is password protected (opened via decrypt; saves re-encrypt) */
  encrypted?: boolean
  /** content came from a newer crash-recovery copy and still needs an explicit save */
  recovered?: boolean
  /** a template picked by New from Template: opens as an untitled document (`path` is '') */
  template?: boolean
  /** a document made in the app that no file holds yet: closing it asks to save */
  unsaved?: boolean
}

/** Password-protected (ECMA-376 encrypted) docx: the renderer prompts for the
 *  open password and retries via openDocxDecrypt. */
export interface OpenFileNeedsPassword {
  needsPassword: true
  path: string
  name: string
}

export type OpenDocxResult = OpenFileResult | OpenFileNeedsPassword | null

/** a file of the templates folder, as the template gallery shows it */
export interface TemplateEntry {
  /** file name inside the templates folder */
  name: string
  /** the preview picture the template carries, as a data URL */
  thumbnail?: string
}

/** where the first page is on screen (CSS px of the window), for a template's preview picture */
export interface TemplatePreviewRect {
  x: number
  y: number
  width: number
  height: number
}

/** a .docx picked to be read, not opened: the tab's own document stays what it was */
/** the Styles Organizer's other file: its bytes, and the path changes are written back to */
export type OrganizerFileResult =
  { name: string; path: string; dataUrl: string } | { needsPassword: true } | null
export type PickDocxResult = { name: string; dataUrl: string } | { needsPassword: true } | null

/** result of an openDocxDecrypt attempt; wrong-password keeps the prompt open */
export type DecryptOpenResult =
  | { ok: true; result: OpenFileResult }
  | { ok: false; reason: 'wrong-password' | 'unsupported' | 'error'; error?: string }

export interface PickImageResult {
  /** raw image bytes, base64 encoded */
  base64: string
  mime: 'image/png' | 'image/jpeg' | 'image/gif'
  name: string
}

// ---- mail merge (genoffice#2097) ----

/** the answer to File > Rename… / Move…: the file's new path, or why it stayed where it was */
export type DocMoveResult =
  { ok: true; path: string } | { ok: false; error: 'missing' | 'badName' | 'exists' | 'failed' }

/** the open document's file as the file system has it */
export interface DocFileInfo {
  path: string
  sizeBytes: number
  createdMs: number
  modifiedMs: number
}

/** a recipient list read from a local .xlsx or .csv */
export interface MergeDataSource {
  /** absolute path of the file the records came from */
  path: string
  /** the file's name, for the UI */
  name: string
  /** the column names, in file order */
  fields: string[]
  /** one entry per record */
  records: Record<string, string>[]
}

/** the answer to a data-source pick: null when the user canceled the dialog */
export type MergeDataSourceResponse =
  { ok: true; source: MergeDataSource } | { ok: false; error: string } | null

/** one merged document, ready to be written */
export interface MergeOutputFile {
  /** the file name, without a folder */
  name: string
  /** the .docx bytes */
  data: ArrayBuffer
}

/** where the merged documents go: one file for all records, one per record, a
 * label sheet, or one envelope per record */
export type MergeOutputMode = 'single' | 'perRecord' | 'labels' | 'envelopes'

export interface MergeOutputRequest {
  mode: MergeOutputMode
  files: MergeOutputFile[]
}

export interface MergeOutputResponse {
  ok: boolean
  /** the file that was written (single mode) */
  path?: string
  /** the folder the files went into (per-record mode) */
  folder?: string
  /** how many documents were written */
  count?: number
  /** the user closed the dialog without choosing */
  canceled?: boolean
  error?: string
}

export type { FaceVerticalMetrics }

// ---- PDF export ----

/**
 * In-document link to stamp into an exported PDF as a GoTo annotation. All
 * coordinates are fractions of the page box (top-left origin) so the main
 * process can scale them to whatever page size Chromium produced.
 */
export interface PdfInternalLink {
  page: number
  x: number
  y: number
  w: number
  h: number
  toPage: number
  toY: number
}

// ---- Markdown export ----

export interface MarkdownImage {
  /** file name inside the media folder */
  name: string
  /** data: URL or lazy docx-media URL the main process resolves */
  src: string
}

/**
 * Folder token the Markdown references pictures under; the writer swaps it
 * for the real `<file>_files` folder once the save path is known. User text
 * can never spell it: `_` is escaped on the way out.
 */
export const MARKDOWN_MEDIA_DIR_TOKEN = '__genoffice_media__'

/** an open docs tab, for View → Switch Tab */
export interface DocsTabInfo {
  id: string
  title: string
  focused: boolean
}

/** commands dispatched from the native application menu to the renderer */
export type MenuCommand = ActionCommandId

export type UiTheme = 'light' | 'dark' | 'system'

/**
 * Document page theme preference (genoffice#1811): what the canvas/paper does relative
 * to the UI theme. 'follow' keeps the previous single-theme behavior.
 */
export type DocTheme = 'follow' | 'light' | 'dark'

/** shell-wide AutoSave default; updatedAt is 0 until the user has ever set it */
export interface AutoSaveDefault {
  on: boolean
  updatedAt: number
}

export type ZoteroCommand =
  'addEditCitation' | 'addEditBibliography' | 'refresh' | 'setDocPrefs' | 'removeCodes'

export type ZoteroCommandErrorCode =
  'connection-refused' | 'unsupported-command' | 'operation-failed'

export interface ZoteroCommandResult {
  ok: boolean
  errorCode?: ZoteroCommandErrorCode
  error?: string
}

export interface ZoteroRendererRequest {
  requestId: string
  command: string
  args: unknown[]
}

export interface ZoteroRendererResponse {
  requestId: string
  ok: boolean
  result?: unknown
  error?: string
}

/** Chromium's misspelling data for a claimed body right-click (`seq` = the claim it answers) */
export type PrintDuplex = 'simplex' | 'longEdge' | 'shortEdge'

/** job options from the in-app print dialog; deviceName null = system dialog, '' = OS default printer */
export interface PrintJobOptions {
  deviceName: string | null
  copies?: number
  collate?: boolean
  duplex?: PrintDuplex
}

/** the document's own paper size in twips, read off the pagination preview's
 * first sheet: the CUPS print route bakes printToPDF pages at this size
 * instead of Chromium's Letter default. Optional — absent falls back. */
export interface PrintPaper {
  widthTwips: number
  heightTwips: number
}

export interface PrinterInfo {
  name: string
  displayName: string
}

export interface DesktopApi {
  /** current UI language (persisted by the shell in app-settings.json) */
  getLanguage(): Promise<'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'th' | 'id' | 'ru' | 'ar'>
  /** OS regional-settings locale (BCP 47); Word derives the new-document paper size from it */
  getSystemLocale(): Promise<string>
  /** language switched from the shell home page */
  onLanguageChanged(
    handler: (
      lang: 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'th' | 'id' | 'ru' | 'ar',
    ) => void,
  ): () => void
  /** current UI theme preference (persisted by the shell in app-settings.json) */
  getTheme(): Promise<UiTheme>
  /** theme switched from the shell home page */
  onThemeChanged(handler: (theme: UiTheme) => void): () => void
  /** current document page theme preference (genoffice#1811, persisted by the shell in app-settings.json) */
  getDocumentTheme(): Promise<DocTheme>
  /** document page theme switched from the shell home page */
  onDocumentThemeChanged(handler: (theme: DocTheme) => void): () => void
  /** shell-wide AutoSave default (see useAutoSavePref) */
  getAutoSaveDefault(): Promise<AutoSaveDefault>
  onAutoSaveDefaultChanged(handler: (value: AutoSaveDefault) => void): () => void
  /** author of comments and tracked changes (Settings → General, falling back to the OS account) */
  getAuthorName(): Promise<string>
  onAuthorNameChanged(handler: (name: string) => void): () => void
  /** press on the shell chrome (tab strip is a sibling WebContentsView whose
   *  clicks produce no DOM event here) — dismiss open popovers */
  onChromePressed(handler: () => void): () => void
  /** Zotero is installed or running on this machine: the Zotero ribbon tab shows */
  zoteroAvailable(): Promise<boolean>
  /** invoke Zotero's word-processor integration and service its document callbacks */
  zoteroCommand(command: ZoteroCommand): Promise<ZoteroCommandResult>
  onZoteroRequest(handler: (request: ZoteroRendererRequest) => void): () => void
  respondToZotero(response: ZoteroRendererResponse): void
  openDocx(): Promise<OpenDocxResult>
  openDocxPath(path: string): Promise<OpenDocxResult>
  confirmDocumentReplace(): Promise<boolean>
  /** decrypt-and-open a password-protected docx (path from a needsPassword result) */
  openDocxDecrypt(path: string, password: string): Promise<DecryptOpenResult>
  /** w:altChunk HTML rendered through html2docx in a hidden window; null when conversion fails */
  convertAltChunkHtml(html: string): Promise<Uint8Array | null>
  /** Review > Protect: set (or clear with null) the desired next-save password;
   *  filePath null = document not saved yet, applied on its first successful save */
  setDocPassword(filePath: string | null, password: string | null): Promise<{ ok: boolean }>
  /** snapshot the current intent sequence before replacement cleanup is queued */
  docPasswordIntentRevision(): Promise<number>
  /** discard prior-document intents through a captured revision */
  discardDocPasswordIntents(throughRevision: number): Promise<{ ok: boolean }>
  /** mark the renderer ready and consume a file passed by Finder/Explorer at launch */
  consumePendingOpenDocx(): Promise<OpenDocxResult>
  /** returns true when this tab was created via "New Document" and should start blank */
  consumeNewBlankDoc(): Promise<boolean>
  /** Headless export mode: the path and format this hidden renderer must export, null in normal use */
  consumeHeadlessExport(): Promise<HeadlessExportTarget | null>
  /** Headless export mode: report the export outcome so the main process can quit */
  headlessExportDone(result: { ok: boolean; error?: string }): void
  /** receive documents opened from Finder/Explorer while the app is running */
  onOpenDocx(handler: (result: Exclude<OpenDocxResult, null>) => void): () => void
  /** File was renamed externally (renamed in the shell Home list) — pushes old and new paths; renderer syncs its save path and title bar */
  onRenamedDocx(handler: (paths: { oldPath: string; newPath: string }) => void): () => void
  /** auto=true marks an autosave: an externally modified file then fails with
   *  reason 'external-modified' instead of prompting (manual saves get an
   *  Overwrite/Cancel dialog in the main process) */
  saveDocx(
    path: string,
    data: ArrayBuffer,
    auto?: boolean,
  ): Promise<{
    ok: boolean
    error?: string
    reason?: 'external-modified'
    /** a newer password choice arrived after this save's snapshot */
    passwordIntentPending?: boolean
    /** one-shot URL of the saved document in full when an encrypted save absorbed
     *  lazily served pictures: the renderer reparses from it and leaves lazy mode */
    dataUrl?: string
  }>
  /** crash-recovery copy of a dirty document, stored under userData */
  writeRecoveryCopy(path: string, data: ArrayBuffer): Promise<{ ok: boolean }>
  /** tab closed but webContents kept alive (shell freeze workaround) — stop background timers */
  onTeardown(handler: () => void): () => void
  /** opt this renderer into claiming right-clicks: claimed clicks get no native menu */
  armContextMenu(): void
  /** synchronous, from the DOM contextmenu handler: the React menu answers this
   *  right-click, so Blink's request for it must not pop the native menu */
  claimContextMenu(seq: number): void
  /** writes template bytes to a .dotx the user picks; the open document is not affected */
  saveTemplate(
    defaultName: string,
    data: ArrayBuffer,
    preview?: TemplatePreviewRect,
  ): Promise<{ ok: boolean; path?: string; error?: string }>
  /** a template to start a new document from: the named one of the templates folder, or one the user picks */
  openTemplate(fromGallery?: string): Promise<OpenDocxResult>
  /** the templates folder's templates */
  listTemplates(): Promise<TemplateEntry[]>
  /** sourcePath: the document's current path — Save As uses its desired next-save
   *  password and commits that state to the chosen path only after success */
  saveDocxAs(
    defaultName: string,
    data: ArrayBuffer,
    sourcePath?: string | null,
  ): Promise<{
    ok: boolean
    path?: string
    error?: string
    /** the dialog picked another format: nothing was written, export to `path` instead */
    exportAs?: SaveAsExportFormat
    passwordIntentPending?: boolean
    dataUrl?: string
  }>
  /** first save of a new document: silently writes into the default folder, no dialog */
  saveDocxNew(
    defaultName: string,
    data: ArrayBuffer,
  ): Promise<{
    ok: boolean
    path?: string
    error?: string
    passwordIntentPending?: boolean
    dataUrl?: string
  }>
  getRecentFiles(): Promise<string[]>
  pickImage(): Promise<PickImageResult | null>
  pickDocx(): Promise<PickDocxResult>
  organizerOpen(): Promise<OrganizerFileResult>
  organizerSave(path: string, data: ArrayBuffer): Promise<{ ok: boolean; error?: string }>
  /** show a document made here (a comparison result) in a new tab, untitled and unsaved */
  openResultTab(data: Uint8Array): Promise<void>
  /** File > Rename…: the open document's file takes this name in its own folder */
  renameDoc(name: string): Promise<DocMoveResult>
  /** File > Move…: asks for a folder and moves the open document's file there; null when canceled */
  moveDoc(): Promise<DocMoveResult | null>
  /** File > Properties, General: the open document's file as it is on disk; null for one never saved */
  fileInfo(): Promise<DocFileInfo | null>
  /** Mailings tab: pick a local .xlsx or .csv and read it as a recipient list */
  pickMergeDataSource(): Promise<MergeDataSourceResponse>
  /** Mailings tab: write the merged documents (one file, or one per record) */
  writeMergeOutput(request: MergeOutputRequest): Promise<MergeOutputResponse>
  /** vertical metrics of an installed family (exact name match), null when missing */
  fontMetrics(family: string): Promise<FaceVerticalMetrics | null>
  /** the other spellings of the installed faces behind these names: a localized
   *  (CJK) family name yields the English spelling the browser resolves.
   *  Only the names that have an alias are answered (genoffice#2449). */
  fontAliases(names: readonly string[]): Promise<Record<string, readonly string[]>>
  /** print the current window; ok=false without error = canceled.
   *  scale: print scale inverting the preview's print zoom (print-zoom.ts).
   *  job: printer/copies/duplex from the in-app dialog; a named printer ('' = OS
   *  default) prints silently, null or omitted opens the system dialog.
   *  paper: the document's own page size in twips (the preview's first sheet),
   *  used by the CUPS print route to size printToPDF's pages */
  print(
    scale?: number,
    job?: PrintJobOptions,
    paper?: PrintPaper,
  ): Promise<{ ok: boolean; error?: string }>
  /** installed printers for the in-app print dialog */
  listPrinters(): Promise<PrinterInfo[]>
  /** render the document to PDF and ask where to save; size in twips.
   *  outPath is only honored when a previous export dialog chose that exact path */
  exportPdf(
    defaultName: string,
    pageWidthTwips: number,
    pageHeightTwips: number,
    outPath?: string,
    scale?: number,
    links?: PdfInternalLink[],
  ): Promise<{ ok: boolean; path?: string; error?: string }>
  exportHtml(
    defaultName: string,
    html: string,
    outPath?: string,
  ): Promise<{ ok: boolean; path?: string; error?: string }>
  exportMarkdown(
    defaultName: string,
    markdown: string,
    images: MarkdownImage[],
    outPath?: string,
  ): Promise<{ ok: boolean; path?: string; error?: string; imagesDropped?: number }>
  /** Mixed paper-size export: produce a set of PDF bytes (base64) at given sizes per the current print layout */
  printPdfBuffer(
    pageWidthTwips: number,
    pageHeightTwips: number,
    scale?: number,
  ): Promise<{ ok: boolean; base64?: string; error?: string }>
  /** Merge grouped PDF fragments in order and write to disk (missing outPath opens
   *  the save dialog; a given outPath must come from a previous export dialog) */
  saveMergedPdf(
    defaultName: string,
    base64Parts: string[],
    outPath?: string,
    links?: PdfInternalLink[],
  ): Promise<{ ok: boolean; path?: string; error?: string }>
  /** Export as images: the folder picker plus a pre-authorized temp PDF path the
   *  regular PDF export writes to silently (no reveal, no open) */
  pickExportImagesTarget(): Promise<{ dir: string; pdfPath: string } | null>
  /** Read back and delete the temp PDF written for an image export */
  takeExportPdf(pdfPath: string): Promise<{ ok: boolean; base64?: string; error?: string }>
  /** Write one page PNG into the folder chosen by pickExportImagesTarget */
  writeExportImage(
    dir: string,
    fileName: string,
    pngBase64: string,
  ): Promise<{ ok: boolean; path?: string; error?: string }>
  /** Save a picture the renderer displays (data URL) through a Save dialog */
  saveImageAs(src: string): Promise<{ ok: boolean; path?: string; error?: string }>
  /** fetch a pasted web image through SSRF-guarded main-process networking */
  fetchImage(url: string): Promise<{ base64: string; mime: string } | null>
  /** Native context menu "View Image" on a chrome surface such as the app panel */
  onViewImage(handler: (src: string) => void): () => void
  /** copy an embedded picture to the OS clipboard as a real bitmap + <img>
   *  html (r136: copying an image exported only the protected placeholder) */
  copyImageToClipboard(dataUrl: string, metaJson?: string): Promise<boolean>
  /** absolute path of a File dropped onto the window (Electron webUtils) */
  getPathForFile(file: File): string
  /** View → New Tab: open another docs tab, optionally loading the same document */
  openNewTab(openPath?: string | null): Promise<void>
  /** all open docs tabs, for View → Switch Tab */
  listDocsTabs(): Promise<DocsTabInfo[]>
  arrangeAllWindows(): Promise<void>
  /** detached Docs windows return to the tab strip */
  gatherWindows(): Promise<void>
  /** how many Docs windows stand outside the tab strip, now and whenever it changes */
  detachedWindowCount?(): Promise<number>
  onDetachedWindowsChanged?(handler: (count: number) => void): () => void
  focusDocsTab(id: string): Promise<void>
  /** subscribe to native menu commands; returns unsubscribe */
  onMenuCommand(handler: (command: MenuCommand, payload?: string) => void): () => void
  /** Close guard: main process queries pre-close state (dirty flag + autosave switch; if autosave is on, save silently without a dialog) */
  onCloseCheck(handler: () => void): () => void
  reportCloseCheck(state: { dirty: boolean; autoSave: boolean; filePath?: string | null }): void
  /** Close guard chose "Save": main process asks the renderer to run the full save flow */
  onCloseSaveRequest(handler: () => void): () => void
  reportCloseSaveResult(ok: boolean): void
  /** keep the native menu's check marks and enabled state in sync with renderer state */
  reportCommandState(state: CommandMenuState): void
  /** the menu bar's commands with their labels, for the Customize Keyboard dialog */
  keyCatalog(): Promise<{ id: string; label: string; menu: string; path: string }[]>
  /** the user's keyboard assignments, kept per machine */
  getKeyOverrides(): Promise<KeyOverrides>
  setKeyOverrides(overrides: KeyOverrides): Promise<KeyOverrides>
  onKeyOverridesChanged(handler: (overrides: KeyOverrides) => void): () => void
}

/** mirrors VIEW_IMAGE_CHANNEL in @genoffice/electron-utils (kept literal so the preload stays free of main-only deps) */
export const VIEW_IMAGE_CHANNEL = 'genoffice:view-image'
