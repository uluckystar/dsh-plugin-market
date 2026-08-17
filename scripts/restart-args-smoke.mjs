#!/usr/bin/env node
import { sanitizeDshRestartArgs } from '../lib/restart-args.js'

const cases = [
  {
    name: 'strips split unsafe host',
    input: ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', 'web', '--port', '3080', '--host', '0.0.0.0'],
    output: ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', 'web', '--port', '3080'],
    removed: true,
  },
  {
    name: 'strips equals unsafe host',
    input: ['apps/cli/src/bin.ts', 'web', '--host=0.0.0.0', '--port', '3080'],
    output: ['apps/cli/src/bin.ts', 'web', '--port', '3080'],
    removed: true,
  },
  {
    name: 'keeps local host',
    input: ['apps/cli/src/bin.ts', 'web', '--host', '127.0.0.1', '--port', '3080'],
    output: ['apps/cli/src/bin.ts', 'web', '--host', '127.0.0.1', '--port', '3080'],
    removed: false,
  },
]

let failed = 0
for (const c of cases) {
  const got = sanitizeDshRestartArgs(c.input)
  const same = JSON.stringify(got.args) === JSON.stringify(c.output) && got.removedUnsafeHost === c.removed
  console.log(`${same ? '✅' : '❌'} ${c.name}`)
  if (!same) {
    console.log('  got=', got)
    failed++
  }
}
process.exit(failed === 0 ? 0 : 1)
