import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { VIEW_IMAGE_CHANNEL, type MarkdownImage, type PdfInternalLink } from '../shared/ipc'
import { toCommandMenuState, type CommandMenuState } from '../shared/commands'
import type { KeyOverrides } from '../shared/keybindings'
import type {
  DesktopApi,
  MenuCommand,
  AutoSaveDefault,
  PrintJobOptions,
  PrintPaper,
  DocTheme,
  UiTheme,
  ZoteroRendererRequest,
  MergeOutputRequest,
  TemplatePreviewRect,
} from '../shared/ipc'
import { installDropOpenBridge } from '@genoffice/electron-utils/drop-open'

const api: DesktopApi = {
  getLanguage: () => ipcRenderer.invoke('app:get-language'),
  getSystemLocale: () => ipcRenderer.invoke('docs:system-locale'),
  onLanguageChanged: (handler) => {
    const listener = (
      _event: IpcRendererEvent,
      lang: 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'th' | 'id' | 'ru' | 'ar',
    ) => handler(lang)
    ipcRenderer.on('app:language-changed', listener)
    return () => ipcRenderer.removeListener('app:language-changed', listener)
  },
  getTheme: () => ipcRenderer.invoke('app:get-theme'),
  onThemeChanged: (handler) => {
    const listener = (_event: IpcRendererEvent, theme: UiTheme) => handler(theme)
    ipcRenderer.on('app:theme-changed', listener)
    return () => ipcRenderer.removeListener('app:theme-changed', listener)
  },
  getDocumentTheme: async () => {
    const result: unknown = await ipcRenderer.invoke('app:get-document-theme')
    return result === 'dark' || result === 'light' ? result : 'follow'
  },
  onDocumentThemeChanged: (handler) => {
    const listener = (_event: IpcRendererEvent, theme: DocTheme) => handler(theme)
    ipcRenderer.on('app:document-theme-changed', listener)
    return () => ipcRenderer.removeListener('app:document-theme-changed', listener)
  },
  getAutoSaveDefault: () => ipcRenderer.invoke('app:get-auto-save-default'),
  onAutoSaveDefaultChanged: (handler) => {
    const listener = (_event: IpcRendererEvent, value: AutoSaveDefault) => handler(value)
    ipcRenderer.on('app:auto-save-default-changed', listener)
    return () => ipcRenderer.removeListener('app:auto-save-default-changed', listener)
  },
  getAuthorName: () => ipcRenderer.invoke('app:get-author-name'),
  onAuthorNameChanged: (handler) => {
    const listener = (_event: IpcRendererEvent, name: unknown) => {
      if (typeof name === 'string') handler(name)
    }
    ipcRenderer.on('app:author-name-changed', listener)
    return () => ipcRenderer.removeListener('app:author-name-changed', listener)
  },
  onChromePressed: (handler) => {
    const listener = () => handler()
    ipcRenderer.on('app:chrome-pressed', listener)
    return () => ipcRenderer.removeListener('app:chrome-pressed', listener)
  },
  zoteroAvailable: () => ipcRenderer.invoke('zotero:available'),
  zoteroCommand: (command) => ipcRenderer.invoke('zotero:command', command),
  onZoteroRequest: (handler) => {
    const listener = (_event: IpcRendererEvent, request: ZoteroRendererRequest) => handler(request)
    ipcRenderer.on('zotero:request', listener)
    return () => ipcRenderer.removeListener('zotero:request', listener)
  },
  respondToZotero: (response) => ipcRenderer.send('zotero:response', response),
  openDocx: () => ipcRenderer.invoke('docs:open'),
  openDocxPath: (path: string) => ipcRenderer.invoke('docs:open-path', path),
  confirmDocumentReplace: () => ipcRenderer.invoke('docs:confirm-document-replace'),
  convertAltChunkHtml: (html: string) => ipcRenderer.invoke('docs:altchunk-html-to-docx', html),
  openDocxDecrypt: (path: string, password: string) =>
    ipcRenderer.invoke('docs:open-decrypt', path, password),
  setDocPassword: (filePath: string | null, password: string | null) =>
    ipcRenderer.invoke('docs:set-password', filePath, password),
  docPasswordIntentRevision: async () => {
    const revision: unknown = await ipcRenderer.invoke('docs:password-intent-revision')
    return typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0
      ? revision
      : 0
  },
  discardDocPasswordIntents: (throughRevision: number) =>
    ipcRenderer.invoke('docs:discard-password-intents', throughRevision),
  consumePendingOpenDocx: () => ipcRenderer.invoke('docs:consume-pending-open'),
  consumeNewBlankDoc: () => ipcRenderer.invoke('docs:consume-new-blank'),
  consumeHeadlessExport: () => ipcRenderer.invoke('docs:consume-headless-export'),
  headlessExportDone: (result: { ok: boolean; error?: string }) =>
    ipcRenderer.send('docs:headless-export-done', result),
  onOpenDocx: (handler) => {
    const listener = (_event: IpcRendererEvent, result: Parameters<typeof handler>[0]) =>
      handler(result)
    ipcRenderer.on('docs:opened', listener)
    return () => ipcRenderer.removeListener('docs:opened', listener)
  },
  onRenamedDocx: (handler) => {
    const listener = (_event: IpcRendererEvent, paths: Parameters<typeof handler>[0]) =>
      handler(paths)
    ipcRenderer.on('docs:renamed', listener)
    return () => ipcRenderer.removeListener('docs:renamed', listener)
  },
  saveDocx: (path: string, data: ArrayBuffer, auto?: boolean) =>
    ipcRenderer.invoke('docs:save', path, data, auto === true),
  writeRecoveryCopy: (path: string, data: ArrayBuffer) =>
    ipcRenderer.invoke('docs:write-recovery', path, data),
  onTeardown: (handler) => {
    const listener = () => handler()
    ipcRenderer.on('docs:teardown', listener)
    return () => ipcRenderer.removeListener('docs:teardown', listener)
  },
  armContextMenu: () => ipcRenderer.send('docs:context-menu-arm'),
  claimContextMenu: (seq: number) => {
    ipcRenderer.sendSync('docs:context-menu-claim', seq)
  },
  saveTemplate: (defaultName: string, data: ArrayBuffer, preview?: TemplatePreviewRect) =>
    ipcRenderer.invoke('docs:save-template', defaultName, data, preview),
  openTemplate: (fromGallery?: string) => ipcRenderer.invoke('docs:open-template', fromGallery),
  listTemplates: () => ipcRenderer.invoke('docs:list-templates'),
  saveDocxAs: (defaultName: string, data: ArrayBuffer, sourcePath?: string | null) =>
    ipcRenderer.invoke('docs:save-as', defaultName, data, sourcePath ?? null),
  saveDocxNew: (defaultName: string, data: ArrayBuffer) =>
    ipcRenderer.invoke('docs:save-new', defaultName, data),
  getRecentFiles: () => ipcRenderer.invoke('docs:recent'),
  pickImage: () => ipcRenderer.invoke('docs:pick-image'),
  pickDocx: () => ipcRenderer.invoke('docs:pick-docx'),
  organizerOpen: () => ipcRenderer.invoke('docs:organizer-open'),
  organizerSave: (path: string, data: ArrayBuffer) =>
    ipcRenderer.invoke('docs:organizer-save', path, data),
  openResultTab: (data: Uint8Array) => ipcRenderer.invoke('docs:open-result-tab', data),
  renameDoc: (name: string) => ipcRenderer.invoke('docs:rename-doc', name),
  moveDoc: () => ipcRenderer.invoke('docs:move-doc'),
  fileInfo: () => ipcRenderer.invoke('docs:file-info'),
  pickMergeDataSource: () => ipcRenderer.invoke('docs:merge-data-source'),
  writeMergeOutput: (request: MergeOutputRequest) =>
    ipcRenderer.invoke('docs:merge-output', request),
  fontMetrics: (family: string) => ipcRenderer.invoke('docs:font-metrics', family),
  fontAliases: (names: readonly string[]) => ipcRenderer.invoke('docs:font-aliases', names),
  print: (scale?: number, job?: PrintJobOptions, paper?: PrintPaper) =>
    ipcRenderer.invoke('docs:print', scale, job, paper),
  listPrinters: () => ipcRenderer.invoke('docs:printers'),
  exportPdf: (
    defaultName: string,
    pageWidthTwips: number,
    pageHeightTwips: number,
    outPath?: string,
    scale?: number,
    links?: PdfInternalLink[],
  ) =>
    ipcRenderer.invoke(
      'docs:export-pdf',
      defaultName,
      pageWidthTwips,
      pageHeightTwips,
      outPath,
      scale,
      links,
    ),
  exportHtml: (defaultName: string, html: string, outPath?: string) =>
    ipcRenderer.invoke('docs:export-html', defaultName, html, outPath),
  exportMarkdown: (
    defaultName: string,
    markdown: string,
    images: MarkdownImage[],
    outPath?: string,
  ) => ipcRenderer.invoke('docs:export-markdown', defaultName, markdown, images, outPath),
  printPdfBuffer: (pageWidthTwips: number, pageHeightTwips: number, scale?: number) =>
    ipcRenderer.invoke('docs:print-pdf-buffer', pageWidthTwips, pageHeightTwips, scale),
  saveMergedPdf: (
    defaultName: string,
    base64Parts: string[],
    outPath?: string,
    links?: PdfInternalLink[],
  ) => ipcRenderer.invoke('docs:save-merged-pdf', defaultName, base64Parts, outPath, links),
  pickExportImagesTarget: () => ipcRenderer.invoke('docs:pick-export-images-target'),
  takeExportPdf: (pdfPath: string) => ipcRenderer.invoke('docs:take-export-pdf', pdfPath),
  writeExportImage: (dir: string, fileName: string, pngBase64: string) =>
    ipcRenderer.invoke('docs:write-export-image', dir, fileName, pngBase64),
  saveImageAs: (src: string) => ipcRenderer.invoke('docs:save-image-as', src),
  fetchImage: (url: string) => ipcRenderer.invoke('docs:fetch-image', url),
  onViewImage: (handler) => {
    const listener = (_event: IpcRendererEvent, src: string) => handler(src)
    ipcRenderer.on(VIEW_IMAGE_CHANNEL, listener)
    return () => ipcRenderer.removeListener(VIEW_IMAGE_CHANNEL, listener)
  },
  copyImageToClipboard: (dataUrl: string, metaJson?: string) =>
    ipcRenderer.invoke('docs:copy-image-to-clipboard', dataUrl, metaJson),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  openNewTab: (openPath?: string | null) => ipcRenderer.invoke('win:new', openPath ?? null),
  listDocsTabs: () => ipcRenderer.invoke('win:list'),
  arrangeAllWindows: () => ipcRenderer.invoke('win:arrange-all'),
  gatherWindows: () => ipcRenderer.invoke('win:gather'),
  detachedWindowCount: () => ipcRenderer.invoke('win:detached-count'),
  onDetachedWindowsChanged: (handler: (count: number) => void) => {
    const listener = (_event: IpcRendererEvent, count: number) => handler(count)
    ipcRenderer.on('win:detached-changed', listener)
    return () => ipcRenderer.removeListener('win:detached-changed', listener)
  },
  focusDocsTab: (id: string) => ipcRenderer.invoke('win:focus', id),
  onMenuCommand: (handler: (command: MenuCommand, payload?: string) => void) => {
    const listener = (_event: IpcRendererEvent, command: MenuCommand, payload?: string) =>
      handler(command, payload)
    ipcRenderer.on('menu:command', listener)
    return () => ipcRenderer.removeListener('menu:command', listener)
  },
  onCloseCheck: (handler: () => void) => {
    const listener = () => handler()
    ipcRenderer.on('docs:close-check', listener)
    return () => ipcRenderer.removeListener('docs:close-check', listener)
  },
  reportCommandState: (state: CommandMenuState) =>
    ipcRenderer.send('docs:command-state', toCommandMenuState(state)),
  keyCatalog: () => ipcRenderer.invoke('docs:key-catalog'),
  getKeyOverrides: () => ipcRenderer.invoke('docs:key-overrides'),
  setKeyOverrides: (overrides) => ipcRenderer.invoke('docs:set-key-overrides', overrides),
  onKeyOverridesChanged: (handler) => {
    const listener = (_event: IpcRendererEvent, overrides: KeyOverrides) => handler(overrides)
    ipcRenderer.on('docs:key-overrides-changed', listener)
    return () => ipcRenderer.removeListener('docs:key-overrides-changed', listener)
  },
  reportCloseCheck: (state: { dirty: boolean; autoSave: boolean; filePath?: string | null }) =>
    ipcRenderer.send('docs:close-check-result', {
      dirty: state?.dirty === true,
      autoSave: state?.autoSave === true,
      filePath: typeof state?.filePath === 'string' ? state.filePath : null,
    }),
  onCloseSaveRequest: (handler: () => void) => {
    const listener = () => handler()
    ipcRenderer.on('docs:close-save-request', listener)
    return () => ipcRenderer.removeListener('docs:close-save-request', listener)
  },
  reportCloseSaveResult: (ok: boolean) => ipcRenderer.send('docs:close-save-result', ok === true),
}

contextBridge.exposeInMainWorld('desktop', api)

// open documents dragged from the OS onto this tab as a new shell tab
installDropOpenBridge()
