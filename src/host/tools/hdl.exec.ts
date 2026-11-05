// dlogic_hdl 的进程层：查找 iverilog、构造子进程环境、限时限量运行外部程序、临时目录。
// 只在 Host（Node）中使用；纯逻辑见 src/solvers/hdl.ts。
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { SimEnd } from '../../shared/hdl.ts'

/** 默认安装位置（MSYS2 UCRT64）。 */
export const IVERILOG_DEFAULT_DIR = 'C:\\msys64\\ucrt64\\bin'

const EXE = process.platform === 'win32' ? '.exe' : ''

export function toolFile(dir: string, name: string): string {
  return path.join(dir, name + EXE)
}

/**
 * 依次查找 iverilog 所在目录：环境变量 DLOGIC_IVERILOG_DIR、C:\msys64\ucrt64\bin、系统 PATH。
 * 找不到时返回 null（调用方降级）。exists 可注入，便于测试。
 */
export function findIverilogDir(
  env: Record<string, string | undefined> = process.env,
  exists: (p: string) => boolean = fs.existsSync,
): string | null {
  const candidates: string[] = []
  if (env.DLOGIC_IVERILOG_DIR) candidates.push(env.DLOGIC_IVERILOG_DIR)
  candidates.push(IVERILOG_DEFAULT_DIR)
  const pathVar = pathValue(env)
  for (const d of pathVar.split(path.delimiter)) if (d) candidates.push(d)
  for (const dir of candidates) {
    if (exists(toolFile(dir, 'iverilog'))) return dir
  }
  return null
}

function pathValue(env: Record<string, string | undefined>): string {
  for (const k of Object.keys(env)) if (k.toUpperCase() === 'PATH') return env[k] ?? ''
  return ''
}

/** 子进程环境：把 dir 放到 PATH 最前（iverilog 依赖同目录的 vvp）。 */
export function childEnv(dir: string, base: Record<string, string | undefined> = process.env): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(base)) if (v !== undefined && k.toUpperCase() !== 'PATH') env[k] = v
  env.PATH = [dir, pathValue(base)].filter(Boolean).join(path.delimiter)
  return env
}

const versionCache = new Map<string, string | null>()

/** iverilog 版本号（如 "13.0"），失败时为 null；结果按目录缓存。 */
export function iverilogVersion(dir: string): string | null {
  if (versionCache.has(dir)) return versionCache.get(dir) ?? null
  let version: string | null = null
  try {
    const r = spawnSync(toolFile(dir, 'iverilog'), ['-V'], { encoding: 'utf8', timeout: 5000, windowsHide: true, env: childEnv(dir) })
    const m = /Icarus Verilog version (\S+)/.exec(r.stdout ?? '')
    version = m ? m[1] : null
  } catch {
    version = null
  }
  versionCache.set(dir, version)
  return version
}

export interface RunOptions {
  cwd: string
  env: Record<string, string>
  timeoutMs: number
  /** stdout 上限（字节）；超过即强制结束。 */
  maxStdoutBytes?: number
  /** 周期性检查：返回结束原因则强制结束。 */
  watch?: () => SimEnd | null
}

export interface RunResult {
  code: number | null
  stdout: string
  stderr: string
  /** 被工具强制结束时的原因。 */
  killed: SimEnd | null
  spawnError: string | null
}

/** 运行外部程序，受墙钟、输出大小与自定义检查约束。 */
export function runProcess(file: string, args: string[], opts: RunOptions): Promise<RunResult> {
  return new Promise(resolve => {
    let child
    try {
      child = spawn(file, args, { cwd: opts.cwd, env: opts.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      resolve({ code: null, stdout: '', stderr: '', killed: null, spawnError: String(e) })
      return
    }
    let stdout = ''
    let stderr = ''
    let killed: SimEnd | null = null
    let done = false
    const maxBytes = opts.maxStdoutBytes ?? Number.POSITIVE_INFINITY
    let bytes = 0

    const kill = (reason: SimEnd) => {
      if (killed === null) {
        killed = reason
        child.kill()
      }
    }
    const timer = setTimeout(() => kill('wall_clock'), opts.timeoutMs)
    const poll = opts.watch ? setInterval(() => {
      const r = opts.watch?.()
      if (r) kill(r)
    }, 100) : null

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      if (bytes >= maxBytes) return
      bytes += Buffer.byteLength(chunk, 'utf8')
      stdout += chunk
      if (bytes > maxBytes) {
        stdout = Buffer.from(stdout, 'utf8').subarray(0, maxBytes).toString('utf8')
        kill('output_limit')
      }
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < 64 * 1024) stderr += chunk
    })

    const finish = (result: RunResult) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (poll) clearInterval(poll)
      resolve(result)
    }
    child.on('error', err => finish({ code: null, stdout, stderr, killed, spawnError: err.message }))
    child.on('close', code => finish({ code, stdout, stderr, killed, spawnError: null }))
  })
}

/** 在新建的临时目录中执行 fn，结束后删除该目录。 */
export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlogic-hdl-'))
  try {
    return await fn(dir)
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // 删除失败不影响结果
    }
  }
}

/** 目录中所有 .vcd 文件的总字节数。 */
export function vcdBytesIn(dir: string): number {
  let total = 0
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.vcd')) continue
      try {
        total += fs.statSync(path.join(dir, f)).size
      } catch {
        // 文件可能正在写入或已消失
      }
    }
  } catch {
    // 目录不可读时视为 0
  }
  return total
}

/** 目录中第一个 .vcd 文件的路径与大小；没有时为 null。 */
export function firstVcd(dir: string): { file: string; size: number } | null {
  try {
    const f = fs.readdirSync(dir).find(x => x.endsWith('.vcd'))
    if (!f) return null
    const file = path.join(dir, f)
    return { file, size: fs.statSync(file).size }
  } catch {
    return null
  }
}
