// 构建 Host 与 Client 两份产物。
//   lib/index.js   Host 入口（ESM，node24，@deepseek-ai/* 外部化）
//   lib/client.js  浏览器入口（包装成 DSH client module 的 factory 格式）
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const libDir = path.join(root, 'lib')

const CLIENT_HEAD = `window.__ModuleLoader__.load({
\tid: "dsh-digital-logic-studio",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
`

const CLIENT_TAIL = `\t\treturn module.exports;
\t}
});
`

const kb = n => `${(n / 1024).toFixed(1)} KB`

async function buildHost() {
  await build({
    absWorkingDir: root,
    entryPoints: ['src/host/index.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    charset: 'utf8',
    // zod 只用于 projection 的 z.custom，打包进来约占一半体积；它是 dependencies，由宿主按依赖解析。
    external: ['@deepseek-ai/*', 'zod'],
    outfile: 'lib/index.js',
    write: true,
    logLevel: 'warning',
  })
  const outPath = path.join(libDir, 'index.js')
  const { size } = await stat(outPath)
  return { outPath, size }
}

async function buildClient() {
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['src/client/index.tsx'],
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    external: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/*'],
    write: false,
    logLevel: 'warning',
  })
  const file = result.outputFiles[0]
  const body = file.text.replace(/\n$/, '')
  const wrapped = CLIENT_HEAD + body + '\n' + CLIENT_TAIL
  const outPath = path.join(libDir, 'client.js')
  await writeFile(outPath, wrapped, 'utf8')
  return { outPath, size: Buffer.byteLength(wrapped, 'utf8') }
}

async function main() {
  await mkdir(libDir, { recursive: true })
  const host = await buildHost()
  const client = await buildClient()
  console.log(`built ${path.relative(root, host.outPath)}  ${kb(host.size)}`)
  console.log(`built ${path.relative(root, client.outPath)}  ${kb(client.size)}`)
}

main().catch(error => {
  console.error('build failed:', error?.message ?? error)
  process.exitCode = 1
})
