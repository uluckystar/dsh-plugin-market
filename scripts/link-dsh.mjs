#!/usr/bin/env node
/**
 * 开发期类型链接：@deepseek-ai/* 包不在公共 npm registry 发布（pre-release），
 * 构建期把 DSH checkout 的包符号链接进本项目的 node_modules/@deepseek-ai。
 * 运行时这些包由 profile 的 node_modules 解析，与链接无关。
 *
 * 用法：pnpm prepare:links   （或 node scripts/link-dsh.mjs）
 * 环境变量 DSH_CHECKOUT 覆盖默认 checkout 路径。
 */

import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const checkout = resolve(process.env.DSH_CHECKOUT ?? '/Volumes/aigo/work/deepseek-harness')

/** 需要链接的 DSH 包：checkout 相对路径 -> node_modules 下的包名。 */
const LINKS = {
  'vendor/cordis': '@deepseek-ai/cordis',
  'vendor/schemastery': '@deepseek-ai/schemastery',
  'packages/client/locale': '@deepseek-ai/dsh-client-locale',
  'packages/client/runtime': '@deepseek-ai/dsh-client-runtime',
  'packages/client/ui-settings': '@deepseek-ai/dsh-client-ui-settings',
  'packages/client/ui-slots': '@deepseek-ai/dsh-client-ui-slots',
  'packages/host/webserver': '@deepseek-ai/dsh-host-webserver',
}

const scopeDir = join(projectRoot, 'node_modules', '@deepseek-ai')
mkdirSync(scopeDir, { recursive: true })

for (const [relative, name] of Object.entries(LINKS)) {
  const target = join(checkout, relative)
  const linkPath = join(scopeDir, name.slice('@deepseek-ai/'.length))
  if (!existsSync(target)) {
    console.error(`[link-dsh] MISSING checkout path: ${target}`)
    process.exitCode = 1
    continue
  }
  rmSync(linkPath, { recursive: true, force: true })
  symlinkSync(target, linkPath, 'dir')
  console.log(`[link-dsh] ${name} -> ${relative}`)
}
