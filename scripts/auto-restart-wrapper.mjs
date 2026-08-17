#!/usr/bin/env node
/**
 * dsh-plugin-market 自拉起监督进程(auto-restart wrapper)。
 *
 * 用途:DSH 不是由 PM2 托管时(手动启动 / Docker / systemd / Windows),
 * 插件市场需要「自动重启生效」。插件把本脚本以脱离(detached)方式 spawn 后
 * 退出自身进程;本脚本:
 *   1. 等待父进程(旧 DSH)退出;
 *   2. 稍候让端口/文件句柄释放;
 *   3. 用与旧进程完全相同的命令(可执行文件 + 参数 + 环境 + 工作目录)重新拉起 DSH;
 *   4. 拉起失败自动重试(最多 3 次),全程写日志到 ~/.dsh/storages/plugin_market_restart.log。
 *
 * 若外部已有监督者(如 systemd Restart=always)先拉起了新进程,本脚本通过
 * 端口探测发现端口已占用,会放弃拉起,避免双进程抢端口。
 *
 * 用法(由 gateway 内部 spawn,不面向用户):
 *   node auto-restart-wrapper.mjs <parentPid> <portOrEmpty> -- <rest-args...>
 */

import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import net from 'node:net'

const [parentPidRaw, portRaw, sep, ...restArgs] = process.argv.slice(2)
const parentPid = Number.parseInt(parentPidRaw ?? '', 10)
const probePort = Number.parseInt(portRaw ?? '', 10)
const MAX_RETRIES = 3
const WAIT_PARENT_MS = 50 // 父进程存活检查间隔
const PARENT_TIMEOUT_MS = 120_000 // 等父进程退出的总上限
const SETTLE_MS = 1500 // 父进程退出后,给端口/句柄释放的缓冲
const logDir = join(homedir(), '.dsh', 'storages')
const logFile = join(logDir, 'plugin_market_restart.log')

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try {
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
    appendFileSync(logFile, line)
  } catch { /* 日志失败不影响重启 */ }
}

/** 父进程是否还活着(跨平台:PID 0 信号探测)。 */
function parentAlive() {
  try {
    process.kill(parentPid, 0)
    return true
  } catch {
    return false
  }
}

/** 端口是否已被占用(说明外部监督者已拉起新进程)。探测失败按未占用处理。 */
function portTaken(port, timeoutMs = 1200) {
  if (!Number.isFinite(port) || port <= 0) return false
  return new Promise(resolve => {
    const sock = net.connect({ port, host: '127.0.0.1' })
    const done = (taken) => { sock.destroy(); resolve(taken) }
    sock.setTimeout(timeoutMs)
    sock.once('connect', () => done(true))
    sock.once('timeout', () => done(false))
    sock.once('error', () => done(false))
  })
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/** 等待旧进程退出(带超时)。返回 true=已退出,false=超时仍活着。 */
async function waitForParentExit() {
  const deadline = Date.now() + PARENT_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (!parentAlive()) return true
    await sleep(WAIT_PARENT_MS)
  }
  return false
}

async function main() {
  log(`wrapper 启动: parent=${parentPid}, port=${probePort || '无'}, 重启命令: ${restArgs.join(' ')}`)

  const exited = await waitForParentExit()
  if (!exited) {
    log('❌ 父进程超时未退出,放弃重启')
    process.exit(1)
  }
  log('✅ 父进程已退出,等待句柄释放…')
  await sleep(SETTLE_MS)

  // 防双拉:端口已有人监听(外部监督者先拉起)→ 退出,不重复拉起。
  if (await portTaken(probePort)) {
    log('⚠️ 端口已被占用(可能外部监督者已拉起新进程),本脚本放弃拉起')
    process.exit(0)
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    log(`🔄 第 ${attempt}/${MAX_RETRIES} 次拉起: ${process.execPath} ${restArgs.join(' ')}`)
    try {
      const child = spawn(process.execPath, restArgs, {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'ignore',
        detached: false,
      })
      child.once('error', (err) => log(`❌ 拉起失败(error 事件): ${err.message}`))
      child.once('exit', (code, signal) => {
        log(`ℹ️ 新进程已退出 code=${code} signal=${signal ?? ''}(${attempt < MAX_RETRIES ? '准备重试' : '不再重试'})`)
      })
      // 成功拉起后本脚本使命结束,但保持存活监听子进程;子进程退出时不重试已在 exit 回调处理。
      await new Promise(resolve => child.once('exit', resolve))
      if (child.exitCode === 0) {
        log('✅ 新进程正常退出,任务结束')
        process.exit(0)
      }
      // 非 0 退出:短暂等待后重试
      await sleep(2000)
    } catch (err) {
      log(`❌ 拉起异常: ${err instanceof Error ? err.message : String(err)}`)
      await sleep(2000)
    }
  }
  log('❌ 连续失败,请手动重启 DSH 并查看日志')
  process.exit(1)
}

void main()
