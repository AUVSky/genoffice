# Internal offline fork

This checkout is a one-way fork of GenOffice for internal, air-gapped macOS use.
It is not synchronized with upstream.

## What was removed

- Every AI surface: chat panels, agent loop, model/media/search providers,
  skills, AI file naming, knowledge base, MCP server, `genoffice` CLI, project
  (chat) store, and the Genspark account/cloud-project integration.
- The HTML editor app (`apps/html`) and its packaging, associations and help.
- All networking features and background egress: analytics, auto-update,
  cloud projects, file-search reranking, remote document images, Sheets web
  queries, the Markdown remote image host, font downloads and spellcheck
  dictionary downloads.
- The cloud redaction UI ("hide from the LLM") in Docs/Sheets/Slides/Markdown.
  The engines keep round-tripping existing redaction markers through the tiny
  `@genoffice/redact` constants package.

Spelling correction is not included: no dictionary ships, Chromium's checker
is disabled and the editors paint no red underline. The in-app manual ships in
English and Simplified Chinese; other UI languages show the English body under
their own localized titles.

Kept: Docs, Sheets, Slides, PDF and Markdown editing; legacy/ODF/HWP import;
PDF conversion and local OCR; PDF permanent redaction and form filling;
exports; all local document features.

## Offline guarantee

- `apps/shell/src/main/offline.ts` installs a session request filter that
  cancels `http:`, `https:`, `ws:` and `wss:` in packaged builds (Vite loopback
  stays available in development).
- `tools/check-no-network.mjs` fails when shipped code names an external
  service host.
- The app opens no listening sockets.

Document URLs remain as data: hyperlinks are handed to the OS browser, and
remote images are not fetched.

## Build

```bash
# Node 22 and a Rust toolchain (for the xlsx sidecar) are required.
npm install
npm run fixtures
npm run fixtures -w @genoffice/sheets
npm run typecheck
npm test
npm run check:no-network
npm run dist:mac
```

`npm run dist:mac` builds every kept app, compiles the sidecar and the macOS
OCR helper, ad-hoc signs the bundle (`apps/shell/build/adhoc-sign.cjs`) and
writes `apps/shell/release/GenOffice-<version>-arm64.dmg`.

The dmg is unsigned by a Developer ID and not notarized. On first launch,
right-click the app and choose **Open**.
