// 卡片公共外壳：单行摘要、可折叠主体、运行中的静默行、渲染错误回退。
import { Component, useState, type ReactNode } from 'react'
import { c } from '../styles.ts'

/** 运行中、准备中或错误时的单行（不可展开）。 */
export function MutedRow({ tool, title, text, isError }: { tool: string; title: string; text?: string; isError?: boolean }) {
  return (
    <div className={c('card')} data-tool={tool}>
      <div className={c('row')} data-static="">
        <span className={c('title')}>{title}</span>
        {text ? (
          <>
            <span className={c('dot')} />
            <span className={`${c('summary')}${isError ? ' ' + c('error') : ''}`}>{text}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

/** 带标题行的可折叠卡片；点击标题行切换主体。 */
export function Card({
  tool,
  title,
  summary,
  isError,
  defaultOpen = true,
  children,
}: {
  tool: string
  title: string
  summary: ReactNode
  isError?: boolean
  defaultOpen?: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={c('card')} data-tool={tool}>
      <div className={c('row')} role="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={c('title')}>{title}</span>
        <span className={c('dot')} />
        <span className={`${c('summary')}${isError ? ' ' + c('error') : ''}`}>{summary}</span>
      </div>
      {open && <div className={c('body')}>{children}</div>}
    </div>
  )
}

/** 纯文本主体（回退用）。 */
export function TextBody({ text }: { text: string }) {
  return (
    <div className={c('step')}>
      <div className={c('mono')}>{text}</div>
    </div>
  )
}

/** 捕获子树渲染错误，改为显示 fallback，避免整个聊天区崩溃。 */
export class Boundary extends Component<{ fallback: ReactNode; children?: ReactNode }, { failed: boolean }> {
  state: { failed: boolean } = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
