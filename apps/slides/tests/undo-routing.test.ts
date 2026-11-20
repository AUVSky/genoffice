import { describe, expect, it } from 'vitest'
import { isTextUndoTarget } from '../src/renderer/undo-routing'

describe('Slides history shortcut routing', () => {
  it('treats inputs, textareas and editable text as native-undo targets', () => {
    expect(isTextUndoTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isTextUndoTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTextUndoTarget({ isContentEditable: true })).toBe(true)
    expect(isTextUndoTarget({ tagName: 'DIV' })).toBe(false)
    expect(isTextUndoTarget(null)).toBe(false)
  })
})
