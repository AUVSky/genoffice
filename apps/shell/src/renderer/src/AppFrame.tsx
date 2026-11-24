import { useEffect, useState } from 'react'
import { Home } from './Home'
import { SettingsModal } from './SettingsModal'
import { TabBar } from './TabBar'

export function AppFrame() {
  const [homeActive, setHomeActive] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => window.aiOffice.onOpenSettings?.(() => setSettingsOpen(true)), [])

  useEffect(() => {
    const applyTabs = (tabs: Awaited<ReturnType<typeof window.aiOfficeTabs.list>>) => {
      const active = tabs.find((tab) => tab.active)
      setHomeActive(!active || active.kind === 'home')
    }
    void window.aiOfficeTabs.list().then(applyTabs)
    return window.aiOfficeTabs.onChanged(applyTabs)
  }, [])

  // The editor is a WebContentsView painted above this document, so the
  // Settings modal would be behind it. Hide the active view while Settings is
  // open and bring it back on close; Home also stays visible behind the modal
  // instead of leaving an empty content area.
  //
  // The native caption buttons sit above this document too: dim them with the
  // backdrop and take them out of service for as long as Settings is open.
  useEffect(() => {
    void window.aiOfficeTabs.setContentVisible(!settingsOpen)
    void window.aiOffice.setWindowControlsDisabled(settingsOpen).catch(() => {})
    return () => {
      if (settingsOpen) void window.aiOffice.setWindowControlsDisabled(false).catch(() => {})
    }
  }, [settingsOpen])

  return (
    <div className="app-frame">
      <TabBar onOpenSettings={() => setSettingsOpen(true)} />
      {/* docs/sheets tabs render as WebContentsView children of this window, positioned
       * by the main process to cover this area — only Home paints its own content here. */}
      <div
        className="app-frame-content"
        style={{ visibility: homeActive || settingsOpen ? 'visible' : 'hidden' }}
      >
        <Home />
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
