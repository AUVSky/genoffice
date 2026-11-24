# Internal offline fork

This checkout is a one-way fork of GenOffice for internal, air-gapped macOS
and Windows use. It is not synchronized with upstream.

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

## Uninstall

Settings → General → Uninstall removes the app on both platforms. The
confirmation offers keeping or deleting settings, the search index and caches;
documents under `Documents/Office` are never touched.

- Windows: runs the NSIS uninstaller (`Uninstall Office.exe`) silently, which
  removes the program, shortcuts and file associations.
- macOS: a detached script removes `Office.app` and the app's Library data
  (Application Support, caches, preferences and saved state) after the app
  exits.

## Offline guarantee

- `apps/shell/src/main/offline.ts` installs a session request filter that
  cancels `http:`, `https:`, `ws:` and `wss:` in packaged builds (Vite loopback
  stays available in development).
- The same module disables the session spellchecker (Chromium otherwise
  downloads `en-us-10-1.bdic` from Google's CDN without passing through the
  request filter) and sets Chromium switches that turn off background
  networking, component updates, domain reliability and pings. In packaged
  builds the DNS resolver maps every hostname to `NOTFOUND`, so a request that
  escaped both guards still cannot reach a network.
- `tools/check-no-network.mjs` fails when shipped code names an external
  service host.
- The app opens no listening sockets. Verified on Windows with Chromium's
  netlog: a packaged launch produces no HTTP request and no TCP/UDP
  connection.

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
writes `apps/shell/release/Office-<version>-arm64.dmg`.

The dmg is unsigned by a Developer ID and not notarized. On first launch,
right-click the app and choose **Open**.

### Windows

Windows 10+ x64 uses the same source and the NSIS installer target:

```powershell
npm install
npm run fixtures
npm run fixtures -w @genoffice/sheets
npm run typecheck
npm test
npm run check:no-network
npm run dist:win
```

`npm run dist:win` builds every kept app, compiles the Rust xlsx sidecar and
the Windows clipboard helper with the MSVC toolchain, compiles the in-box
system-OCR helper (`win-ocr.exe`) with the .NET Framework compiler and the
Windows SDK, and writes
`apps/shell/release/Office-<version>-x64.exe`.

The installer and its helpers are unsigned. SmartScreen may warn on first
launch; choose **More info → Run anyway**, or sign the exe and the three
extraResources helpers (`xlsx-sidecar.exe`, `win-clipboard-helper.exe`,
`win-ocr.exe`) with your own certificate before packaging.

The lockfile is generated on macOS, and npm's optional-dependency bug leaves
`@rollup/rollup-win32-x64-msvc` and `@esbuild/win32-x64` out of a Windows
install. If the build stops with `Cannot find module
@rollup/rollup-win32-x64-msvc`, install them at the versions already in the
tree:

```powershell
npm install --no-save "@rollup/rollup-win32-x64-msvc@$(node -p "require('rollup/package.json').version")" "@esbuild/win32-x64@$(node -p "require('esbuild/package.json').version")"
```

Both platforms have a manual GitHub Actions workflow:
`.github/workflows/fork-dmg.yml` writes the arm64 dmg and
`.github/workflows/fork-win.yml` writes the x64 NSIS installer.
