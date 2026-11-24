import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Dropdown } from '@genoffice/ui'
import type { DefaultAppStatus, PdfDefaultZoom } from '../../shared/home-api'
import {
  AUTHOR_NAME_MAX,
  CSV_IMPORT_DEFAULT_LIMIT_MB,
  CSV_IMPORT_LIMIT_CHOICES_MB,
} from '../../shared/home-api'
import { useI18n } from './locale'
import type { StringKey } from './locale'
import type { AuthorNameSetting, DocTheme, UiTheme } from '../../shared/home-api'
import { useSlidingIndicator } from './settings-fx'
import './settings.css'
import './settings-skin.css'
import './settings-fx.css'

// ── Settings modal (opened from the account menu) ─────────
// Genspark-style two-pane dialog: section nav on the left, fields on the right.
// All values go through the existing home IPC; nothing is stored locally.

// sorted by ISO 639 language code — native-script labels have no natural
// shared alphabet, so the code is the ordering key
const LANG_OPTIONS = [
  { value: 'ar', label: 'العربية' },
  { value: 'cs', label: 'Čeština' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'he', label: 'עברית' },
  { value: 'hu', label: 'Magyar' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'ms', label: 'Bahasa Melayu' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pl', label: 'Polski' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'th', label: 'ไทย' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'zh', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
] as const

// GenMail's option order: follow-system first, then the manual picks
const THEME_OPTIONS = [
  { value: 'system', labelKey: 'themeSystem' },
  { value: 'light', labelKey: 'themeLight' },
  { value: 'dark', labelKey: 'themeDark' },
] as const satisfies readonly { value: UiTheme; labelKey: StringKey }[]

// Document page theme (genoffice#1811): the canvas/paper preference the editors follow;
// 'follow' keeps the pre-existing behavior of riding the UI theme
const DOC_THEME_OPTIONS = [
  { value: 'follow', labelKey: 'docThemeFollowApp' },
  { value: 'light', labelKey: 'themeLight' },
  { value: 'dark', labelKey: 'themeDark' },
] as const satisfies readonly { value: DocTheme; labelKey: StringKey }[]

export type SectionId = 'general' | 'about'

const SECTIONS: readonly { id: SectionId; labelKey: StringKey }[] = [
  { id: 'general', labelKey: 'setSecGeneral' },
  { id: 'about', labelKey: 'setSecAbout' },
]

function SectionIcon({ id }: { id: SectionId }) {
  if (id === 'general') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2 5h8M13 5h1M2 11h1M6 11h8"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="11.5" cy="5" r="1.7" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="4.5" cy="11" r="1.7" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7.4v3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="5.1" r="0.8" fill="currentColor" />
    </svg>
  )
}

/** label-over-value field row with an optional right-aligned action */
function Field({
  label,
  value,
  valueTitle,
  action,
}: {
  label: string
  value: ReactNode
  valueTitle?: string
  action?: ReactNode
}) {
  return (
    <div className="set-field">
      <div className="set-field-text">
        <div className="set-field-label">{label}</div>
        <div className="set-field-value" data-tip={valueTitle}>
          {value}
        </div>
      </div>
      {action}
    </div>
  )
}

export interface SettingsTarget {
  section: SectionId
}

export interface SettingsModalProps {
  onClose: () => void
  target?: SettingsTarget | null
}

export function SettingsModal({ onClose, target }: SettingsModalProps) {
  const { lang, setLang, t } = useI18n()
  const [section, setSection] = useState<SectionId>(target?.section ?? 'general')
  const navRef = useRef<HTMLElement | null>(null)
  const navPill = useSlidingIndicator(navRef, '.set-nav-item.active', section)
  useEffect(() => {
    if (target) setSection(target.section)
  }, [target])
  const [theme, setTheme] = useState<UiTheme>('system')
  const [docTheme, setDocTheme] = useState<DocTheme>('follow')
  const [csvLimitMb, setCsvLimitMb] = useState(CSV_IMPORT_DEFAULT_LIMIT_MB)
  const [saveDir, setSaveDir] = useState('')
  const [autoSaveOn, setAutoSaveOn] = useState(false)
  const [tabSleepOn, setTabSleepOn] = useState(true)
  const [restoreSessionOn, setRestoreSessionOn] = useState(true)
  const [excludedFolders, setExcludedFoldersList] = useState<string[]>([])
  const [defaultApp, setDefaultApp] = useState<DefaultAppStatus | null>(null)
  const [defaultAppBusy, setDefaultAppBusy] = useState(false)
  const [defaultAppFailed, setDefaultAppFailed] = useState(false)
  const [authorName, setAuthorName] = useState<AuthorNameSetting>({ value: '', fallback: '' })
  const [legacyImportPrompt, setLegacyImportPrompt] = useState(true)
  const [pdfDefaultZoom, setPdfDefaultZoom] = useState<PdfDefaultZoom>('width')
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    let alive = true
    void window.aiOffice.getTheme?.().then((th) => {
      if (alive) setTheme(th)
    })
    void window.aiOffice.getDocumentTheme?.().then((th) => {
      if (alive) setDocTheme(th)
    })
    void window.aiOffice.getDefaultSaveDir?.().then((dir) => {
      if (alive && dir) setSaveDir(dir)
    })
    void window.aiOffice.getAutoSaveDefault?.().then((v) => {
      if (alive) setAutoSaveOn(v.on)
    })
    void window.aiOffice.getTabSleepEnabled?.().then((on) => {
      if (alive) setTabSleepOn(on)
    })
    void window.aiOffice.getCsvImportLimit?.().then((mb) => {
      if (alive && mb > 0) setCsvLimitMb(mb)
    })
    void window.aiOffice.getRestoreLastSession?.().then((on) => {
      if (alive) setRestoreSessionOn(on)
    })
    void window.aiOffice.getExcludedFolders?.().then((list) => {
      if (alive) setExcludedFoldersList(list ?? [])
    })
    void window.aiOffice.getDefaultAppStatus?.().then((st) => {
      if (alive) setDefaultApp(st)
    })
    void window.aiOffice.getLegacyImportPrompt?.().then((v) => {
      if (alive) setLegacyImportPrompt(v)
    })
    void window.aiOffice.getPdfDefaultZoom?.().then((v) => {
      if (alive) setPdfDefaultZoom(v)
    })
    void window.aiOffice.getAuthorName?.().then((v) => {
      if (alive) setAuthorName(v)
    })
    void window.aiOffice.getAppVersion?.().then((v) => {
      if (alive && v) setAppVersion(v)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const applyTheme = (next: UiTheme) => {
    setTheme(next)
    void window.aiOffice.setTheme(next)
    if (next === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', next)
  }

  const applyDocumentTheme = (next: DocTheme) => {
    setDocTheme(next)
    void window.aiOffice.setDocumentTheme(next)
  }

  const addExcludedFolder = async (): Promise<void> => {
    const picked = await window.aiOffice.pickExcludedFolder?.()
    if (!picked) return
    const next = await window.aiOffice.setExcludedFolders?.([...excludedFolders, picked])
    setExcludedFoldersList(next ?? [])
  }
  const removeExcludedFolder = async (folder: string): Promise<void> => {
    const next = await window.aiOffice.setExcludedFolders?.(
      excludedFolders.filter((p) => p !== folder),
    )
    setExcludedFoldersList(next ?? [])
  }
  const commitAuthorName = () => {
    void window.aiOffice.setAuthorName?.(authorName.value).then(setAuthorName)
  }

  const changeSaveDir = () => {
    void window.aiOffice.pickDefaultSaveDir?.().then((dir) => {
      if (dir) setSaveDir(dir)
    })
  }

  // Windows only opens the system page; re-read ownership when the user comes back
  useEffect(() => {
    if (!defaultApp?.manualOnly) return
    const refresh = () => {
      void window.aiOffice.getDefaultAppStatus?.().then(setDefaultApp)
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [defaultApp?.manualOnly])

  const claimDefaultApp = () => {
    setDefaultAppBusy(true)
    setDefaultAppFailed(false)
    void window.aiOffice
      .setDefaultApp()
      .then((st) => {
        setDefaultApp(st)
        if (!st.manualOnly && st.state !== 'default') setDefaultAppFailed(true)
      })
      .catch(() => setDefaultAppFailed(true))
      .finally(() => setDefaultAppBusy(false))
  }

  const defaultAppDesc = (() => {
    if (!defaultApp) return ''
    if (defaultAppFailed) return t('setDefaultAppFailed')
    if (defaultApp.state === 'default') return t('setDefaultAppIs')
    if (defaultApp.state === 'other' && defaultApp.others.length > 0)
      return t('setDefaultAppOther', { app: defaultApp.others.join(', ') })
    return t('setDefaultAppDesc')
  })()

  return (
    <div
      className="set-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="set-dialog" role="dialog" aria-modal="true" aria-label={t('settings')}>
        <div className="set-header">
          <h2 className="set-title">{t('settings')}</h2>
          <button className="set-close" onClick={onClose} aria-label={t('cancel')}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="set-body">
          <nav ref={navRef} className="set-nav" aria-label={t('settings')}>
            <span ref={navPill} className="fx-indicator" aria-hidden="true" />
            <div className="set-nav-label" aria-hidden="true">
              {t('settings')}
            </div>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`set-nav-item${section === s.id ? ' active' : ''}`}
                aria-current={section === s.id}
                onClick={() => setSection(s.id)}
              >
                <SectionIcon id={s.id} />
                {t(s.labelKey)}
              </button>
            ))}
          </nav>
          <div className="set-pane" data-section={section} key={section}>
            {section === 'general' && (
              <>
                <h3 className="set-pane-title">{t('setSecGeneral')}</h3>
                <p className="set-pane-desc">{t('setGeneralSub')}</p>
                <h4 className="set-pane-subtitle">{t('setGrpInterface')}</h4>
                <div className="set-field">
                  <div className="set-field-text">
                    <label className="set-field-label">{t('language')}</label>
                  </div>
                  <Dropdown
                    className="set-dd"
                    value={lang}
                    ariaLabel={t('language')}
                    options={LANG_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                    onPick={(v) => setLang(v as typeof lang)}
                  />
                </div>
                <div className="set-field">
                  <div className="set-field-text">
                    <label className="set-field-label">{t('theme')}</label>
                  </div>
                  <Dropdown
                    className="set-dd"
                    value={theme}
                    ariaLabel={t('theme')}
                    options={THEME_OPTIONS.map((opt) => ({
                      value: opt.value,
                      label: t(opt.labelKey),
                    }))}
                    onPick={(v) => applyTheme(v as UiTheme)}
                  />
                </div>
                <div className="set-field">
                  <div className="set-field-text">
                    <label className="set-field-label">{t('documentTheme')}</label>
                  </div>
                  <Dropdown
                    className="set-dd"
                    value={docTheme}
                    ariaLabel={t('documentTheme')}
                    options={DOC_THEME_OPTIONS.map((opt) => ({
                      value: opt.value,
                      label: t(opt.labelKey),
                    }))}
                    onPick={(v) => applyDocumentTheme(v as DocTheme)}
                  />
                </div>
                <h4 className="set-pane-subtitle">{t('setGrpFiles')}</h4>
                <div className="set-field">
                  <div className="set-field-text">
                    <div className="set-field-stack">
                      <label className="set-field-label" htmlFor="set-author-name">
                        {t('setAuthorName')}
                      </label>
                      <div className="set-field-desc">{t('setAuthorNameDesc')}</div>
                    </div>
                  </div>
                  <input
                    id="set-author-name"
                    className="set-input"
                    type="text"
                    value={authorName.value}
                    placeholder={authorName.fallback}
                    maxLength={AUTHOR_NAME_MAX}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => setAuthorName((prev) => ({ ...prev, value: e.target.value }))}
                    onBlur={commitAuthorName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                  />
                </div>
                <Field
                  label={t('saveLocation')}
                  value={saveDir || '—'}
                  valueTitle={saveDir}
                  action={
                    <button className="set-btn" onClick={changeSaveDir}>
                      {t('setChange')}
                    </button>
                  }
                />
                <div className="set-field">
                  <div className="set-field-text">
                    <div className="set-field-stack">
                      <div className="set-field-label">{t('setExcludedFolders')}</div>
                      <div className="set-field-desc">{t('setExcludedFoldersDesc')}</div>
                    </div>
                  </div>
                  <button className="set-btn" onClick={() => void addExcludedFolder()}>
                    {t('setExcludedFoldersAdd')}
                  </button>
                </div>
                {excludedFolders.length === 0 ? (
                  <div className="set-field-desc">{t('setExcludedFoldersEmpty')}</div>
                ) : (
                  excludedFolders.map((folder) => (
                    <div key={folder} className="set-field">
                      <div className="set-field-text">
                        <div className="set-field-stack">
                          <div className="set-field-label" title={folder}>
                            {folder}
                          </div>
                        </div>
                      </div>
                      <button
                        className="set-btn"
                        aria-label={t('setExcludedFoldersAdd')}
                        onClick={() => void removeExcludedFolder(folder)}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
                <div className="set-field">
                  <div className="set-field-text">
                    <div className="set-field-stack">
                      <div className="set-field-label">{t('setAutoSave')}</div>
                      <div className="set-field-desc">{t('setAutoSaveDesc')}</div>
                    </div>
                  </div>
                  <button
                    className="set-switch"
                    role="switch"
                    aria-checked={autoSaveOn}
                    aria-label={t('setAutoSave')}
                    onClick={() => {
                      const next = !autoSaveOn
                      setAutoSaveOn(next)
                      void window.aiOffice.setAutoSaveDefault?.(next).catch(() => {})
                    }}
                  />
                </div>
                <div className="set-field">
                  <div className="set-field-text">
                    <div className="set-field-stack">
                      <label className="set-field-label" htmlFor="set-pdf-default-zoom">
                        {t('setPdfDefaultZoom')}
                      </label>
                      <div className="set-field-desc">{t('setPdfDefaultZoomDesc')}</div>
                    </div>
                  </div>
                  <select
                    id="set-pdf-default-zoom"
                    className="set-input"
                    value={pdfDefaultZoom}
                    onChange={(e) => {
                      const next = e.target.value as PdfDefaultZoom
                      setPdfDefaultZoom(next)
                      void window.aiOffice.setPdfDefaultZoom?.(next).then(setPdfDefaultZoom)
                    }}
                  >
                    <option value="width">{t('setPdfDefaultZoomWidth')}</option>
                    <option value="page">{t('setPdfDefaultZoomPage')}</option>
                    <option value="last">{t('setPdfDefaultZoomLast')}</option>
                  </select>
                </div>
                <div className="set-field">
                  <div className="set-field-text">
                    <div className="set-field-stack">
                      <div className="set-field-label">{t('setLegacyImportPrompt')}</div>
                      <div className="set-field-desc">{t('setLegacyImportPromptDesc')}</div>
                    </div>
                  </div>
                  <button
                    className="set-switch"
                    role="switch"
                    aria-checked={legacyImportPrompt}
                    aria-label={t('setLegacyImportPrompt')}
                    onClick={() => {
                      const next = !legacyImportPrompt
                      setLegacyImportPrompt(next)
                      void window.aiOffice.setLegacyImportPrompt?.(next).then(setLegacyImportPrompt)
                    }}
                  />
                </div>
                <div className="set-field">
                  <div className="set-field-text">
                    <label className="set-field-label">{t('csvImportLimit')}</label>
                  </div>
                  <Dropdown
                    className="set-dd"
                    value={String(csvLimitMb)}
                    ariaLabel={t('csvImportLimit')}
                    options={CSV_IMPORT_LIMIT_CHOICES_MB.map((mb) => ({
                      value: String(mb),
                      label: `${mb} MB`,
                    }))}
                    onPick={(v) => {
                      const mb = Number(v)
                      if (!Number.isInteger(mb)) return
                      setCsvLimitMb(mb)
                      void window.aiOffice.setCsvImportLimit?.(mb)
                    }}
                  />
                </div>
                {defaultApp && defaultApp.state !== 'unsupported' && (
                  <div className="set-field">
                    <div className="set-field-text">
                      <div className="set-field-stack">
                        <div className="set-field-label">{t('setDefaultApp')}</div>
                        <div className="set-field-desc">{defaultAppDesc}</div>
                      </div>
                    </div>
                    <button
                      className="set-btn"
                      disabled={defaultAppBusy || defaultApp.state === 'default'}
                      onClick={claimDefaultApp}
                    >
                      {defaultApp.manualOnly
                        ? t('setDefaultAppOpenSettings')
                        : t('setDefaultAppSet')}
                    </button>
                  </div>
                )}
                <h4 className="set-pane-subtitle">{t('setGrpStartup')}</h4>
                <div className="set-field">
                  <div className="set-field-text">
                    <div className="set-field-stack">
                      <div className="set-field-label">{t('setRestoreSession')}</div>
                      <div className="set-field-desc">{t('setRestoreSessionDesc')}</div>
                    </div>
                  </div>
                  <button
                    className="set-switch"
                    role="switch"
                    aria-checked={restoreSessionOn}
                    aria-label={t('setRestoreSession')}
                    onClick={() => {
                      const next = !restoreSessionOn
                      setRestoreSessionOn(next)
                      void window.aiOffice.setRestoreLastSession?.(next).catch(() => {})
                    }}
                  />
                </div>
                <div className="set-field">
                  <div className="set-field-text">
                    <div className="set-field-stack">
                      <div className="set-field-label">{t('setTabSleep')}</div>
                      <div className="set-field-desc">{t('setTabSleepDesc')}</div>
                    </div>
                  </div>
                  <button
                    className="set-switch"
                    role="switch"
                    aria-checked={tabSleepOn}
                    aria-label={t('setTabSleep')}
                    onClick={() => {
                      const next = !tabSleepOn
                      setTabSleepOn(next)
                      void window.aiOffice.setTabSleepEnabled?.(next).catch(() => {})
                    }}
                  />
                </div>
              </>
            )}
            {section === 'about' && (
              <>
                <h3 className="set-pane-title">{t('setSecAbout')}</h3>
                <p className="set-pane-desc">{t('setAboutSub')}</p>
                <Field label={t('versionLabel')} value={appVersion || '—'} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
