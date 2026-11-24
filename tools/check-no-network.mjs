#!/usr/bin/env node
/**
 * Offline-build guard: shipped main/preload/renderer code must not name any
 * external service. The runtime session filter in apps/shell/src/main/offline.ts
 * blocks requests; this check catches a re-introduced endpoint before it ships.
 *
 * OOXML namespace strings are data, not endpoints, and are allowlisted by
 * substring. Test files are out of scope.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath, not URL.pathname: on Windows the pathname is "/D:/…" and
// path.join would turn it into "D:\\D:\\…".
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ROOTS = ['apps', 'packages']

const BANNED = [
  'genspark.ai',
  'google-analytics.com',
  'api.github.com',
  'serper.dev',
  'serply.io',
  'searchapi.io',
  'tavily.com',
  'parallel.ai',
  'exa.ai',
  'firecrawl.dev',
  'keenable.ai',
  'duckduckgo.com',
  'openai.com',
  'anthropic.com',
  'generativelanguage.googleapis.com',
  'openrouter.ai',
  'api.deepseek.com',
  'moonshot.ai',
  'dashscope.aliyuncs.com',
  'api.minimax.chat',
  'api.x.ai',
  'api.mistral.ai',
  'api.stability.ai',
  'fal.run',
  'ark.cn-beijing.volces.com',
  'api-inference.huggingface.co',
]

/** namespace identifiers that look like URLs but are document data */
const ALLOW = ['redaction/2026', 'schemas.genspark.ai/genoffice/2026/relationships/redactions']

const offenders = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'out' || name === 'release') continue
    const path = join(dir, name)
    const entry = statSync(path)
    if (entry.isDirectory()) {
      walk(path)
      continue
    }
    if (!/\.(ts|tsx|mts|cts)$/.test(name)) continue
    // normalize separators so the test-folder rule also applies on Windows
    const relPath = relative(ROOT, path).replaceAll('\\', '/')
    if (/(^|\/)(tests?|__tests__)\//.test(relPath)) continue
    const text = readFileSync(path, 'utf8')
    const lines = text.split('\n')
    lines.forEach((line, index) => {
      if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return
      for (const host of BANNED) {
        if (!line.includes(host)) continue
        if (ALLOW.some((allowed) => line.includes(allowed))) continue
        offenders.push(`${relative(ROOT, path)}:${index + 1}  ${host}`)
      }
    })
  }
}

for (const root of ROOTS) walk(join(ROOT, root))

if (offenders.length > 0) {
  console.error('External service references found in shipped code:')
  for (const line of offenders) console.error(`  ${line}`)
  process.exit(1)
}
console.log('check-no-network: no external service hosts in shipped code')
