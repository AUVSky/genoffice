import { describe, expect, it } from 'vitest'
import { strings } from '../src/renderer/src/strings'

/**
 * First-run copy is the one place a removed product identity can survive
 * unnoticed: no type or key check reads the prose. Every language's first
 * slide must describe the local office suite, not an AI product.
 */
const REMOVED_IDENTITY = /\bAI\b|Genspark|GenTeam|MCP|\bCLI\b|\bAPI key\b/i

describe('onboarding copy', () => {
  for (const [lang, dict] of Object.entries(strings)) {
    it(`${lang} names no removed AI product`, () => {
      expect(dict.onbSubtitle1).not.toMatch(REMOVED_IDENTITY)
      expect(dict.onbBody1).not.toMatch(REMOVED_IDENTITY)
    })
  }
})
