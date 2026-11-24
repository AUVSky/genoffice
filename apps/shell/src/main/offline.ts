import { app, session, type Session } from 'electron'

/**
 * Air-gapped build guard: no renderer, preload or webview in this app may open
 * an external connection. Only document-local schemes pass; in development the
 * Vite dev servers on loopback stay reachable so the normal `npm run dev` flow
 * still works.
 *
 * Main-process code is expected to contain no fetches at all (the AI, update,
 * analytics and remote-image paths were removed), so this is defense in depth
 * for anything the renderer might still try.
 */
const NETWORK_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:', 'ftp:'])

function isLoopback(url: URL): boolean {
  return (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]' ||
    url.hostname === '::1'
  )
}

export function isAllowedRequest(rawUrl: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    // malformed or non-URL requests (data:, blob:, custom protocols) pass
    return true
  }
  if (!NETWORK_SCHEMES.has(url.protocol)) return true
  return !app.isPackaged && isLoopback(url)
}

export function installOfflineGuard(target: Session): void {
  target.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedRequest(details.url) })
  })
  // Chromium downloads Hunspell dictionaries from Google's CDN on its own;
  // that request is issued by the browser, not by a renderer, so the session
  // filter above never sees it (observed on a packaged Windows build as
  // https://redirector.gvt1.com/edgedl/chrome/dict/en-us-10-1.bdic). The
  // offline build ships no spelling correction, so turn the checker off at
  // the session level as well.
  try {
    target.setSpellCheckerEnabled(false)
    target.setSpellCheckerLanguages([])
  } catch {
    // older Electron: the request filter still covers renderer traffic
  }
}

/**
 * Chromium-level switches for the air-gapped build. Call before `app.ready`:
 * component updates, domain reliability, pings and background networking are
 * browser-initiated and bypass the per-session request filter.
 *
 * The DNS blackhole is packaged-only so the Vite dev servers on localhost
 * still resolve during `npm run dev`.
 */
export function installOfflineCommandLineSwitches(): void {
  app.commandLine.appendSwitch('disable-background-networking')
  app.commandLine.appendSwitch('disable-component-update')
  app.commandLine.appendSwitch('disable-domain-reliability')
  app.commandLine.appendSwitch('no-pings')
  if (app.isPackaged) {
    app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND')
  }
}

/** install on the default session and every session created later */
export function installOfflineGuards(): void {
  installOfflineGuard(session.defaultSession)
  app.on('session-created', (created) => installOfflineGuard(created))
}
