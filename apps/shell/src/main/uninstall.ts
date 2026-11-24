import { app, dialog, type BrowserWindow, type MessageBoxOptions } from 'electron'
import { accessSync, constants, existsSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { macAppBundlePath } from './default-app'

/**
 * In-app one-click uninstall, shared by Windows and macOS.
 *
 * Windows: the shipped NSIS uninstaller (`Uninstall Office.exe` next to the
 * app) removes the program, shortcuts and file associations. A detached batch
 * file waits for this process to exit, runs the uninstaller silently, and —
 * when the user chose it — removes the app's own data in %APPDATA% / %LOCALAPPDATA%.
 * User documents (Documents\Office) are never touched.
 *
 * macOS: there is no system uninstaller for a drag-installed .app, so a
 * detached /bin/sh script waits for this process to exit, removes Office.app,
 * and (when requested) the app's Application Support / caches / preferences.
 * Documents/Office is kept.
 *
 * The confirmation dialog warns that the app closes immediately, so the user
 * can save first; `app.exit(0)` then bypasses any further close prompts.
 */

interface UninstallCopy {
  title: string
  message: string
  detail: string
  removeData: string
  keepData: string
  cancel: string
  onlyPackaged: string
  winMissing: string
  winScript: string
  macNotInstalled: string
  macMove: string
  macPermission: string
  macScript: string
  unsupported: string
}

const ZH: UninstallCopy = {
  title: '卸载 Office？',
  message: 'Office 将从这台电脑移除。',
  detail:
    '卸载会立即关闭 Office，请先保存所有文档。你的文档文件不会被删除。是否同时删除设置、搜索索引和缓存？',
  removeData: '卸载并删除数据',
  keepData: '仅卸载程序',
  cancel: '取消',
  onlyPackaged: '只有安装版 Office 支持自动卸载。',
  winMissing: '找不到卸载程序。请通过 Windows 设置 › 应用 卸载 Office。',
  winScript: '无法准备卸载程序，请稍后重试。',
  macNotInstalled: '没有找到 Office.app，无法自动卸载。',
  macMove: '请先将 Office 拖到「应用程序」文件夹，再使用卸载功能。',
  macPermission: '没有权限删除 Office.app。请在访达中将 Office 移到废纸篓。',
  macScript: '无法启动卸载脚本，请稍后重试。',
  unsupported: '自动卸载目前只支持 Windows 和 macOS。',
}

const EN: UninstallCopy = {
  title: 'Uninstall Office?',
  message: 'Office will be removed from this computer.',
  detail:
    'Uninstalling closes Office immediately, so save your documents first. Your document files are not deleted. Also remove settings, the search index and caches?',
  removeData: 'Uninstall and Delete Data',
  keepData: 'Uninstall Only',
  cancel: 'Cancel',
  onlyPackaged: 'Automatic uninstall is available in the installed build of Office.',
  winMissing: 'The uninstaller could not be found. Uninstall Office from Windows Settings › Apps.',
  winScript: 'Could not prepare the uninstaller. Please try again.',
  macNotInstalled: 'Office.app could not be found, so it cannot be removed automatically.',
  macMove: 'Move Office to the Applications folder before using this uninstaller.',
  macPermission: 'No permission to delete Office.app. Move it to the Trash in Finder.',
  macScript: 'Could not start the uninstall script. Please try again.',
  unsupported: 'Automatic uninstall is currently supported on Windows and macOS only.',
}

function copyFor(lang: string): UninstallCopy {
  return lang === 'zh' || lang === 'zh-TW' ? ZH : EN
}

function show(parent: BrowserWindow | null, options: MessageBoxOptions) {
  return parent && !parent.isDestroyed()
    ? dialog.showMessageBox(parent, options)
    : dialog.showMessageBox(options)
}

async function showMessage(
  parent: BrowserWindow | null,
  message: string,
  title: string,
  type: 'info' | 'error' = 'info',
): Promise<void> {
  await show(parent, { type, title, message, buttons: ['OK'], noLink: true })
}

/** Shell-quote one path for /bin/sh (single-quote escape). */
function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** Ask, then quit and run the platform uninstaller. */
export async function requestUninstall(
  parent: BrowserWindow | null,
  lang: string,
): Promise<void> {
  const copy = copyFor(lang)

  if (!app.isPackaged) {
    await showMessage(parent, copy.onlyPackaged, copy.title)
    return
  }

  const { response } = await show(parent, {
    type: 'warning',
    title: copy.title,
    message: copy.message,
    detail: copy.detail,
    buttons: [copy.removeData, copy.keepData, copy.cancel],
    defaultId: 1,
    cancelId: 2,
    noLink: true,
  })
  if (response !== 0 && response !== 1) return

  let error: string | null
  try {
    error = startUninstall(response === 0, copy)
  } catch {
    error = copy.winScript
  }
  if (error) {
    await showMessage(parent, error, copy.title, 'error')
    return
  }

  // Give the detached helper a moment to start, then leave without close prompts:
  // the confirmation already warned that Office closes immediately.
  setTimeout(() => app.exit(0), 250)
}

function startUninstall(removeData: boolean, copy: UninstallCopy): string | null {
  if (process.platform === 'win32') return startWindowsUninstall(removeData, copy)
  if (process.platform === 'darwin') return startMacUninstall(removeData, copy)
  return copy.unsupported
}

// ---- Windows -------------------------------------------------------------

function startWindowsUninstall(removeData: boolean, copy: UninstallCopy): string | null {
  const dir = dirname(process.execPath)
  const uninstaller = [
    join(dir, `Uninstall ${app.getName()}.exe`),
    join(dir, 'Uninstall Office.exe'),
  ].find(existsSync)
  if (!uninstaller) return copy.winMissing

  // A detached batch file outlives this process: wait for it to exit, run the
  // silent NSIS uninstaller, then remove the app profile if requested.
  const lines = [
    '@echo off',
    'timeout /t 2 /nobreak >nul',
    `start "" /wait "${uninstaller}" /S`,
    // A cancelled UAC prompt (or a failed uninstaller) must not take the
    // profile with it.
    'if errorlevel 1 goto office_uninstall_done',
  ]
  if (removeData) {
    lines.push('rmdir /s /q "%APPDATA%\\Office" >nul 2>nul')
    lines.push('rmdir /s /q "%LOCALAPPDATA%\\Office" >nul 2>nul')
  }
  lines.push(':office_uninstall_done')
  lines.push('del "%~f0" >nul 2>nul')

  const script = join(app.getPath('temp'), `office-uninstall-${process.pid}.cmd`)
  try {
    writeFileSync(script, lines.join('\r\n'), 'utf8')
    const child = spawn('cmd.exe', ['/d', '/s', '/c', script], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.unref()
  } catch {
    return copy.winScript
  }
  return null
}

// ---- macOS ---------------------------------------------------------------

function startMacUninstall(removeData: boolean, copy: UninstallCopy): string | null {
  const appPath = macAppBundlePath(process.execPath)
  if (!appPath || !appPath.endsWith('.app')) return copy.macNotInstalled
  if (appPath.startsWith('/Volumes/') || appPath.includes('/AppTranslocation/')) {
    return copy.macMove
  }
  try {
    accessSync(dirname(appPath), constants.W_OK)
  } catch {
    return copy.macPermission
  }

  const dataPaths = new Set<string>()
  const add = (path: string) => {
    if (path) dataPaths.add(path)
  }
  add(app.getPath('userData'))
  add(app.getPath('sessionData'))
  try {
    add(app.getPath('logs'))
  } catch {
    // logs path unavailable: userData covers the rest
  }
  const home = homedir()
  add(join(home, 'Library', 'Caches', 'Office'))
  add(join(home, 'Library', 'Caches', 'com.genoffice.app'))
  add(join(home, 'Library', 'Preferences', 'com.genoffice.app.plist'))
  add(join(home, 'Library', 'Saved Application State', 'com.genoffice.app.savedState'))
  add(join(home, 'Library', 'HTTPStorages', 'com.genoffice.app'))
  add(join(home, 'Library', 'WebKit', 'com.genoffice.app'))
  add(join(home, 'Library', 'Application Support', 'com.genoffice.app'))

  const script = [
    '#!/bin/sh',
    'i=0',
    `while kill -0 ${process.pid} 2>/dev/null && [ "$i" -lt 50 ]; do sleep 0.2; i=$((i+1)); done`,
    'sleep 1',
    // Never delete the profile if the app bundle itself could not be removed.
    `if ! rm -rf ${shQuote(appPath)}; then exit 0; fi`,
    ...(removeData ? [...dataPaths].map((path) => `rm -rf ${shQuote(path)}`) : []),
  ].join('\n')

  try {
    const child = spawn('/bin/sh', ['-c', script], { detached: true, stdio: 'ignore' })
    child.unref()
  } catch {
    return copy.macScript
  }
  return null
}
