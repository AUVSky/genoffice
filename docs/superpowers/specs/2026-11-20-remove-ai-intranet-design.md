# Design: GenOffice without AI, for an intranet macOS deployment

- Date: 2026-11-20
- Status: proposed, awaiting approval
- Base revision: `a10ba620` (snapshot 2026-11-19)
- Target: internal, air-gapped team use; macOS arm64 only

## 1. Context

GenOffice is an AI-native office suite: six Electron editors on a shared pure-TypeScript
engine layer, plus `genoffice` CLI, MCP server, skills and an agent core. The suite is
built around an AI panel in every editor and a Genspark account for models and search.

The deployment target is an intranet with no access to public AI services. AI is not a
requirement, and any AI surface is dead weight and an audit liability. The build must
behave as a conventional offline Office suite: open, edit, save, convert and export
local documents.

## 2. Goals

1. No AI capability remains in the GUI: no chat panel, agent loop, model/provider
   settings, API keys, login, web/image search, image generation, AI naming, knowledge
   base, skills, MCP, or AI actions in ribbons/menus/context menus/shortcuts.
2. **No networking at all.** The app makes no outbound connections, exposes no
   networking features, and a session-level guard cancels any external request that a
   remaining code path might attempt. Document URLs are preserved as data but never
   fetched.
3. All Office capabilities survive: every local document feature that exists today is
   kept — open/edit/save with byte-level round-trip fidelity, formatting, legacy/ODF/
   HWP import, PDF conversion and local OCR, PDF permanent redaction and form filling,
   exports. Nothing is simplified or gated beyond the AI and networking surfaces
   listed in this document.
4. The app still builds and packages on macOS arm64 without a Developer ID (ad-hoc
   signed), for internal install.
5. The result is maintainable as a one-way fork: deleting code is preferred over
   hidden feature flags, because upstream synchronization is explicitly out of scope.
6. **One flat feature set.** No accounts, roles, licenses, entitlements, quotas or
   per-user feature gates. Every person who runs the app gets every local feature.

## 3. Non-goals

- Following upstream GenOffice releases (user decision: one-way fork).
- Rebranding the product (name, icons, visual identity). Internal use only; the
  Apache-2.0 trademark caveat is accepted. Genspark-branded strings and links are still
  removed.
- Windows/Linux builds.
- Public distribution, release channels, installers for third parties, or an updater.
  The app is built for internal use only and is not distributed.
- Adding new Office features.
- Translating new strings; existing 23 UI locales are kept, with AI keys removed.

## 4. Decisions already made by the user

| Decision           | Choice                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| Upstream sync      | None; modify the latest snapshot in place                              |
| Platform           | macOS only; arm64 dmg                                                  |
| Distribution       | None; internal use only, not distributed. Ad-hoc signed, not notarized |
| UI scope           | GUI only; no CLI, MCP or external agent integration                    |
| Editors kept       | Docs, Sheets, Slides, PDF, Markdown                                    |
| Editors removed    | HTML (AI page builder; without AI it is a plain source editor)         |
| AI                 | Remove entirely, not disable                                           |
| Networking         | Remove every networking feature; enforce a hard offline guard          |
| Accounts and roles | None; no login, license or per-user feature gating                     |

## 5. What stays (document capabilities)

- Engines: `docx-engine`, `pptx-engine`, `pptx-ops`, `pptx-render`, `xlsx-gateway`,
  `zip-gate`, `compound-file`.
- Import/conversion: `doc2docx`, `ppt2pptx`, `hwp2docx`, `odf2ooxml`, `pdf2docx`,
  and the local macOS `vision-ocr` helper used for scanned PDFs.
- Shared: `i18n`, `font-metrics`, `electron-utils`, `file-parse` (also feeds the local
  file index), `ui` (minus AI widgets), `redact` (new, constants only).
- Local-only features: recent files, folder browsing, local full-text file search
  (without reranking), local templates/themes/fonts/help, local image insertion from
  disk. Document URLs (hyperlinks, remote image references) are kept as document data
  and never fetched; clicking a hyperlink hands it to the OS browser, which is outside
  the app.

## 6. Removal map

### 6.1 Packages

Delete entirely:

| Package                  | Reason                                                           |
| ------------------------ | ---------------------------------------------------------------- |
| `packages/ai-provider`   | Models, providers, stream/media protocols                        |
| `packages/ai-search`     | Genspark auth, web/image search, media tools                     |
| `packages/agent-core`    | Agent loop, skills, mind map, chat transports                    |
| `packages/cli`           | CLI + MCP server + skill installer, bundled into the desktop app |
| `packages/project-store` | Chat-history/project persistence only                            |
| `packages/pipelines`     | Used only by AI slide building and the CLI                       |
| `skills/` (root)         | AI prompt artifacts for the CLI/agent                            |

`packages/html2docx` **stays**: Docs uses it for `w:altChunk` HTML inside DOCX
(`docs-main.ts` `docs:altchunk-html-to-docx`, `renderer/parse-worker.ts`), which is a
document-open capability, not AI. Only the HTML app and the CLI are removed.

Add `packages/redact`: exports `REDACT_NS`, `REDACT_PREFIX`, `REDACT_EL` (values moved
from `agent-core/src/redact-range.ts`). `docx-engine` and `pptx-engine` switch their
imports to it. This keeps redaction XML round-trip plumbing intact without keeping the
agent core.

Keep `ee/` (empty enterprise notice) untouched.

### 6.2 App: HTML

Delete `apps/html` and every integration point in the shell:

- module registration and `createHtmlView` in `apps/shell/src/main/index.ts`
  (~lines 294, 532, 574, 3868, 3986, 4060, 4149, 4350, 4588, 4920, 5249, 5277, 5925,
  6057, 6553-6615).
- tab manager cases (`apps/shell/src/main/tab-manager.ts` ~25-28, 322, 482-511, 655,
  704), detached windows (~24, 260, 284), recent files (~96), file index extract
  (~13), `app-routing.ts` `HTML_RE`.
- packaging: HTML file associations and icons in `apps/shell/electron-builder.cjs`
  (~570-580), html module resources, `apps/shell/build/html.*`.
- root scripts (`dev`, `build:all`, `test`, `typecheck`), e2e specs importing
  `apps/html`, and `tools/gen-third-party-notices.mjs` (~33).

Note: PDF → HTML export (`exportPdfAsDocxLocal(format: 'html')`) is a headless export,
not the HTML app; keep it.

### 6.3 Per-editor AI removal

Each editor follows the same pattern: delete `src/renderer/ai/`, remove mounts and AI
state from `App.tsx`, remove the "Genspark AI" ribbon group and AI buttons, remove AI
commands/shortcuts/context-menu entries, remove AI IPC handlers and preload APIs,
remove AI i18n shards, and remove AI dependencies from `package.json`.

- **Docs** (~32 files / 14k LOC): `renderer/ai/`, `AiAskPopover`, `Ribbon.tsx`
  AI group (~3170-3310) and Name with AI (~2032), `ContextMenu` `ai-preset`,
  `shared/commands.ts` ids (`name-with-ai`, `toggle-ai`, `ai-preset`, `ai-proofread`),
  `shared/menu-layout.ts`, native menu entries in `main/docs-main.ts`,
  `renderer/shortcuts.ts` F7, `main/docs-main.ts` `registerAiIpc()` (~7874-8228) and
  `registerProjectIpc` (~8299-8438), `preload/index.ts`, AI CSS/prefs in
  `renderer/main.tsx`, `i18n/ai/*`.
- **Sheets** (~39 files / 7.7k LOC): `renderer/ai/`, `src/ai/`, AI wiring in `App.tsx`,
  `ExcelShell.tsx` mounts and ribbon (~3544-3609), `mcp-bridge.ts`, redaction menu
  (`redact-menu.ts`, `redact-actions.ts`, `univer-locales.ts` redaction labels),
  `main/sheets-main.ts` `registerSheetsAiIpc()` (~4477-4744) and AI settings/host
  document/project IPC, `shared/ipc-channels.ts`, `preload/index.ts`, `i18n/ai/*`.
  Also remove the **external-data web query** (`remote-table` refresh, ~3856): cached
  values remain, refreshing from a URL is a networking feature.
- **Slides** (~20 files / 9.5k LOC): `renderer/ai/`, `main/ai-ipc.ts`,
  `main/slides-main.ts` registrations (~5438-5440) and `slides:local-page-generate`
  (~1925-1940, used only by the AI panel), AI ribbon groups
  (`RibbonHomeTab.tsx` ~246-300, `Ribbon.tsx` ~2472-2511), Cmd+K AI action
  (`keyboard-actions.ts` ~151-159), Name with AI, `preload/index.ts`, `i18n/ai/*`.
- **PDF** (~5 files / 5k LOC): `renderer/ai/`, `AiAskPopover`, the AI ribbon group
  (~8124-8310), the AI fill-form button only, `pdf:generate-image` (~2125-2127),
  `preload/index.ts`, inline AI i18n keys. **Keep** the manual Fill Form tab (add
  text/check/cross, signature, insert image, previous/next field, complete form) and
  the separate permanent PDF redaction tool (`main/redaction.ts`, pdfium-based,
  irreversible, local pattern search) — neither is AI.
- **Markdown** (~10 files / 3.3k LOC): `renderer/ai/`, `editor/aiHighlight.ts`,
  `editor/aiQueueAnchors.ts`, AI ribbon group (~481-510) and Name with AI (~417-424),
  presets (~375-386), `markdown:ai-generate-image` (~1061-1090), `preload/index.ts`,
  inline AI i18n keys. Keep the shared manual apply path in `editor/ops.ts`.
  Also remove the **remote image host** (`main/image-host.ts`: SM.MS, GitHub, S3) and
  its settings; paste/drop inserts local files only.

Redaction: in Docs, Sheets, Slides and Markdown its only purpose is "hide this from
the model". Remove that UI (dialogs, marks, menus,
`packages/ui/src/use-redact-label.ts`, docs `editor/redaction.ts`,
`ai/redact-view.ts`). Keep the engine's inert redaction XML handling and its tests. No
UI can create new markers after this change.

PDF permanent redaction is a different feature (pdfium rasterization, irreversible,
local pattern search) and stays; only the AI-marker redaction UI is removed.

### 6.4 Shell: main process

Delete:

- AI IPC and services: `registerAiIpc()` import/call in `apps/shell/src/main/index.ts`
  (~7256), `ai:open-model-settings` / `ai:open-skills-settings` (~7267-7268),
  `registerAiNamingIpc`, `registerProjectIpc`, `registerIntegrationsIpc`,
  `registerUserSkillsIpc`.
- Files: `ai-naming.ts`, `ai-naming-service.ts`, `ai-naming-provider.ts`,
  `knowledge-base.ts`, `cloud-projects.ts`, `home-cli.ts`, `user-cli.ts`,
  `integrations-ipc.ts`, `imported-skills.ts`, `skill-target.ts`, `mcp/` (17 files),
  `control-server.ts`, `control-handlers.ts`, `cli-link.ts`,
  `file-index/rerank.ts`, `file-index/decider.ts`.
- `@genoffice/cli`, `@genoffice/agent-core`, `@genoffice/ai-provider`,
  `@genoffice/ai-search`, `@modelcontextprotocol/sdk`, `@genspark/cli` from
  `apps/shell/package.json` and every other app manifest.
- MCP start block (~7554) and control server start (~7591-7603).
- Genspark proxy plumbing: remove `setGskProxyUrl` calls (~150, 7199-7201) but keep
  the generic undici/Electron proxy configuration for corporate proxies.
- `shared/home-api.ts` AI channels/types, `shared/integrations-api.ts`,
  `shared/home-api` KB/cloud/rerank surfaces.
- `file-index` keeps `scan`, `indexer`, `store`, `tokenize`, `snippet`, `extract`,
  `extract-worker`; local search continues without reranking.
- Remove every remaining fetch path: the remote-image handlers in `docs-main.ts`
  (~8122) and `sheets-main.ts` (~4703), Markdown `image-host`, the Sheets web query,
  and the URL-download branch of `electron-utils/src/save-image.ts`. Delete
  `remote-table.ts` / `safe-remote-url.ts` if they lose their last caller.
- Add `apps/shell/src/main/offline.ts`: a session request filter
  (`webRequest.onBeforeRequest`) applied to every session the app creates. Packaged
  builds allow only app-local schemes (`file:`, `data:`, `blob:`, `devtools:`, the
  app's registered custom protocols) and cancel `http:`, `https:`, `ws:` and `wss:`.
  Development keeps the Vite loopback exception. No proxy, no allowlist.
- Add `tools/check-no-network.mjs`: fails on `fetch(`, `net.fetch`,
  `http.request` or `https.request` in shipped main/renderer code, with an explicit
  allowlist for tests. Wire it into the verification commands.

### 6.5 Shell: renderer

- `Home.tsx`: remove Ask AI tab/nav, Genspark login/account card, cloud projects,
  Jev rerank toggle, AI panel prefs. Keep recent files, folders, local search,
  new-document actions.
- Delete `KbAskPanel.tsx`, `AskAttachments.tsx`, `ask-artifacts.ts`,
  `ask-tool-notes.ts`, `IntegrationsPane.tsx`, `FoundSkills.tsx`,
  `McpServerSection.tsx`, `provider-logos.tsx`, `StarPromptCard` / star prompt logic.
- `SettingsModal.tsx`: keep General, Appearance, About (minus GitHub star count and
  update check); remove sections `account`, `aiModel`, `aiMedia`, `skills`,
  `integrations`, AI panel preferences, update channel/check, analytics opt-out.
- `Onboarding.tsx`: remove AI sign-in and telemetry slides; keep the local basics.
- Remove AI help topics (`ai-models`, `ai-panel`, `mcp`) and their images.
- Remove product links (`genoffice.ai/join`, Genspark credit page, GitHub repo) and
  the "Check for Updates" menu items.

### 6.6 Analytics and updates

- Delete `apps/shell/src/main/analytics.ts` and all `analytics.track(...)` call sites
  in `index.ts`; delete the analytics settings switch and onboarding text.
- Delete auto-update: `updater.ts`, `update-window.ts`, `update-resume.ts`, the update
  window HTML, update IPC/menu entries and `autoUpdateCheck` / `updateChannel`
  settings. Do not bake `GENOFFICE_UPDATE_URL`.
- Remove GA4 key injection from `electron-builder.cjs`.
- Block Chromium spellcheck dictionary downloads by setting
  `session.setSpellCheckerDictionaryDownloadURL` to a loopback URL that fails fast;
  installed dictionaries keep working.

### 6.7 Root, tests, docs, packaging

- Root `package.json`: remove deleted workspaces from `test`, `typecheck`, `dev`,
  `build:all`; remove `check:skill-version`; keep the rest.
- Delete AI/HTML e2e specs; update `e2e/tab-context-actions.spec.ts` (imports
  `HtmlApi`). Keep non-AI Office specs.
- Delete AI tests inside surviving workspaces; keep engine round-trip tests.
- Packaging: remove `cli/`, `gsk/`, `skills/`, HTML modules and associations; keep
  xlsx sidecar and vision-ocr. Set `mac.notarize: false` and `mac.identity: null`;
  build arm64 only (`dmg` + `zip`). **Ad-hoc sign** the app and its nested binaries
  (`codesign --force --deep --sign -`) — Apple Silicon requires at least an ad-hoc
  signature; no Developer ID and no notarization.
- English README/CONTRIBUTING: remove AI/CLI/MCP sections and the HTML app from
  layout lists. Translated README copies are left untouched (not shipped).

## 7. Network policy: none

There is no allowlist. Every networking feature and call site is removed, and a hard
guard blocks anything that would remain.

Remove (code deleted, not just disabled):

| Egress                                                                                       | Where                                                 |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Genspark auth, LLM proxy, search/image/media, cloud projects, WAF                            | `ai-search`, `ai-provider`, shell login/cloud modules |
| Search backends (Serper, Serply, SearchApi, Tavily, Parallel, Exa, Firecrawl, Keenable, DDG) | `ai-search`                                           |
| Model/media vendors and custom endpoints                                                     | `ai-provider`                                         |
| GA4 telemetry                                                                                | `analytics.ts`                                        |
| Update feed, GitHub release fallback, `api.github.com` star count                            | updater, About                                        |
| File-search rerank providers                                                                 | `file-index/rerank.ts`, `decider.ts`                  |
| Remote images referenced by documents                                                        | docs/sheets main-process fetch handlers               |
| Sheets external-data web query                                                               | `sheets-main.ts`, `remote-table.ts`                   |
| Markdown image upload (S3, SM.MS, GitHub)                                                    | `markdown/src/main/image-host.ts`                     |
| "Save image as" from a URL                                                                   | `electron-utils/src/save-image.ts`                    |
| Font CDN                                                                                     | no `GENOFFICE_FONT_CDN_URL`; download UI removed      |
| Chromium spellcheck dictionary CDN                                                           | `setSpellCheckerDictionaryDownloadURL` loopback       |

Enforcement (defense in depth):

1. `apps/shell/src/main/offline.ts` installs a request filter on every session and
   cancels `http:`, `https:`, `ws:`, `wss:` in packaged builds. Only app-local schemes
   pass. Development allows Vite loopback only.
2. `tools/check-no-network.mjs` fails the build when shipped code contains `fetch(`,
   `net.fetch`, `http.request` or `https.request` (tests may be allowlisted).
3. The app opens no listening sockets: MCP server, CLI control socket and the HTTP MCP
   server are deleted. Dev-only Vite/CDP servers remain dev-only.

Document data versus networking:

- Hyperlinks and external image references stay in the file as content. The app never
  fetches them; a hyperlink click is handed to the OS browser, outside the app.
- No proxy configuration is exposed; corporate proxies are irrelevant in an intranet
  deployment and the app never dials out.

## 8. After removal: home and settings

Home becomes a local launcher: recent files, folder tree, local search over the file
index (name + extracted text), and New Document actions. No tabs or nav items that
open an AI surface. Settings keeps General, Appearance and About; About shows version
and licenses only. No account/login, AI, skills, integrations, image-host or web-query
settings, and no switch that changes the feature set: every local feature is always
on for every run.

## 9. Verification

Baseline before any change (must be green):

1. `npm install` (Rust and Xcode CLT already present; Node 26 satisfies `>=22.12`).
2. `npm run fixtures`.
3. `npm run typecheck`.
4. `npm test` (all workspaces).
5. `npm run build:all`.

During work, after each phase: typecheck the touched workspaces, then root typecheck.
Phases are ordered consumers-first so the tree stays green at every phase boundary;
packages are deleted only after the last importer is gone.

Final gate:

1. Root `npm run typecheck` and `npm test` clean.
2. `npm run build:all` clean; `npm run dev` launches the shell and each kept editor.
3. Functional smoke on fixtures: create/open/edit/save docx, xlsx, pptx, pdf, md;
   verify untouched content survives (engine round-trip tests plus manual fixture
   checks); legacy imports `.doc/.xls/.ppt/.odt/.ods/.hwp`; PDF → DOCX; DOCX → PDF
   export; scanned PDF OCR.
4. No-AI audit: `rg` finds no AI entry points, `ai:*` IPC channels, provider hosts or
   skill loaders; Settings/Home/menus show no AI items.
5. Egress audit: launch the packaged app, exercise open/save/export including a
   document with a remote image reference and a hyperlink, and confirm with
   `lsof -p <pid> -i` that there are **zero** external connections. Remote images
   render as missing/placeholder; hyperlink clicks go to the OS browser only.
6. Static guard: `node tools/check-no-network.mjs` passes.
7. Package: `npm run dist:mac`; install the dmg on a clean user account; launch,
   open/save fixtures, export PDF. Document the right-click/Open Gatekeeper step for
   the ad-hoc-signed app.

## 10. Risks and mitigations

| Risk                                                                                    | Mitigation                                                                                                |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Large deletions leave broken imports across ~60k LOC                                    | Phase by layer (HTML → packages → shell main → shell renderer → each editor), typecheck after every phase |
| Huge mixed files (`Home.tsx`, `SettingsModal.tsx`, `App.tsx`, ribbons) hide non-AI code | Edit surgically; rely on typecheck and targeted tests; never rewrite whole files                          |
| i18n keys in 23 locales                                                                 | Delete key groups; the `satisfies Record<keyof typeof zh, string>` type errors catch drift                |
| Removing `agent-core` breaks engine redaction round-trip                                | Extract the three constants into `packages/redact`; keep engine tests                                     |
| Removing `@genoffice/cli` breaks headless export                                        | Verified headless export lives in `electron-utils` + editor modules, not the CLI; keep that path          |
| Removing MCP/control server affects app startup                                         | Remove registration blocks together; verify dev and packaged launch                                       |
| Ad-hoc-signed app still trips Gatekeeper                                                | Internal install instructions (right-click → Open); the requirement is documented, not worked around      |
| A forgotten code path dials out after deletions                                         | Session filter cancels http(s)/ws(s), static check fails the build, and the egress audit uses `lsof`      |
| Split from upstream makes future merges costly                                          | Accepted by user; keep a short `FORK.md` note listing removed areas                                       |

## 11. Execution phases

1. Baseline: install, fixtures, typecheck, tests, build.
2. Remove HTML app and its shell/packaging/e2e/root-script integration.
3. Shell main consumers: AI IPC/services, MCP, CLI/control socket, cloud/auth, KB,
   rerank, analytics, updater. Green: AI packages still exist but nothing in the shell
   imports them.
4. Networking removal and hard guard: remote-image handlers, Sheets web query,
   Markdown image host, URL-based image saving, spellcheck downloads,
   `offline.ts` session filter and `tools/check-no-network.mjs`.
5. Shell renderer: Home, Settings, onboarding, menus, help, star prompt.
6. Editors one by one: Docs → Sheets → Slides → PDF → Markdown (AI UI, IPC, preload,
   commands, i18n, project-chat IPC). Green after each app.
7. Redaction refactor: add `packages/redact`, switch `docx-engine`/`pptx-engine`,
   delete `ui` AI widgets. Green.
8. Delete the now-unimported packages: `ai-provider`, `ai-search`, `agent-core`,
   `cli`, `project-store`, `pipelines`; remove `skills/`; update root scripts.
   `html2docx` stays. Green.
9. Packaging and docs: electron-builder, resources, file associations, ad-hoc signing,
   README/CONTRIBUTING cleanup.
10. Verification gate and dmg.

## 12. Calls made by the designer

- Keep Markdown, delete HTML (user chose Markdown).
- Keep `html2docx` for Docs' `w:altChunk` HTML rendering; only the HTML app and CLI
  are removed.
- Keep local OCR only. No networking features at all: Sheets web query, Markdown
  image host, remote document images and URL-based image saving are removed, and a
  session guard blocks anything that would dial out. Document URLs stay as data;
  hyperlink clicks hand off to the OS browser.
- Keep PDF permanent redaction and the manual PDF Fill Form tab; remove only their AI
  buttons. The "hide from the model" redaction UI is removed everywhere.
- Keep all 23 UI locales and strip AI keys rather than collapsing to one language.
- Keep the app name "GenOffice" for internal use; no rebrand now.
- Delete rather than feature-flag; no upstream sync.
- Flat feature set for every run: no accounts, roles, licenses, quotas or per-user
  gates. Every local feature is always available.
- Treat redaction as AI-only UI, keep its inert engine plumbing.
- Ad-hoc sign for Apple Silicon; no Developer ID and no notarization.

## 13. Open items

None blocking. Branding, bundled spellcheck dictionaries and broader localization
cleanup can be follow-ups if requested.
