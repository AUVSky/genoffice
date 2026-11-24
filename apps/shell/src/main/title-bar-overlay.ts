import type { TitleBarOverlay } from 'electron'

import { tabStripHeight } from '../shared/tab-drag-geometry'

/// Windows/Linux draw the caption buttons over the tab strip (titleBarStyle
/// 'hidden'); the overlay must match the strip's --tabstrip-bg / text tokens
/// in renderer/src/tabbar.css or the buttons sit on a visibly different band.
///
/// Its height has to follow the interface scale too (genoffice#1913): the strip is
/// `zoom`ed, so a 150% strip is 60px tall and a 40px overlay band would leave
/// the caption buttons floating over the document.

export function tabStripOverlay(dark: boolean, uiScale = 1, dimmed = false): TitleBarOverlay {
  const height = tabStripHeight(uiScale)
  if (dimmed) {
    // A full-window modal (`--color-bg-overlay`: 50% black light / 60% dark)
    // covers the renderer, but not the native caption buttons. Blend the same
    // overlay over the strip colour so the control area darkens with the page;
    // the muted symbol colour marks the buttons as unavailable.
    return dark
      ? { color: '#111111', symbolColor: '#4f4f4f', height }
      : { color: '#757575', symbolColor: '#a8a8a8', height }
  }
  return dark
    ? { color: '#2a2a2a', symbolColor: '#e4e4e4', height }
    : { color: '#ebebeb', symbolColor: '#454746', height }
}
