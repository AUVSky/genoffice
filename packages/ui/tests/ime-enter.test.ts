/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { createImeEnterGuard } from '../src/ime-enter'

describe('createImeEnterGuard', () => {
  it('lets a plain Enter through when no composition ever happened', () => {
    const guard = createImeEnterGuard(() => {})
    expect(guard.isImeConfirm({ isComposing: false, keyCode: 13 })).toBe(false)
  })

  it('blocks Enter while composing (own flag, Chromium ordering)', () => {
    const guard = createImeEnterGuard(() => {})
    guard.handleCompositionStart()
    expect(guard.isImeConfirm({ isComposing: false, keyCode: 13 })).toBe(true)
  })

  it('blocks Enter on the event signals alone (isComposing / keyCode 229)', () => {
    const guard = createImeEnterGuard(() => {})
    expect(guard.isImeConfirm({ isComposing: true, keyCode: 13 })).toBe(true)
    expect(guard.isImeConfirm({ isComposing: false, keyCode: 229 })).toBe(true)
  })

  it('blocks the WebKit-ordered confirm: compositionend first, then a normal-looking Enter', () => {
    const resets: Array<() => void> = []
    const guard = createImeEnterGuard((reset) => resets.push(reset))
    guard.handleCompositionStart()
    guard.handleCompositionEnd()
    // Safari: this keydown reports isComposing=false with an ordinary keyCode
    expect(guard.isImeConfirm({ isComposing: false, keyCode: 13 })).toBe(true)
    // the next tick's deliberate Enter submits again
    resets.forEach((reset) => reset())
    expect(guard.isImeConfirm({ isComposing: false, keyCode: 13 })).toBe(false)
  })
})
