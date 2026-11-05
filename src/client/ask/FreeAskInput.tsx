// 直接回答卡片底部的自由追问输入框：单行输入 + 发送按钮，Enter 发送。
// 发送中禁用输入并显示“回答中…”；失败时显示返回的中文错误，并保留输入内容以便重试。
import { useState } from 'react'
import { fmt, type TFn } from '../locale.ts'
import { c } from '../styles.ts'

/** 与 Host 端的追问长度上限一致（按字符串长度计）。 */
export const FREE_ASK_MAX = 1000

export interface FreeAskInputProps {
  t: TFn
  /** 发送追问；成功返回 null，失败返回中文错误。 */
  onSend: (text: string) => Promise<string | null>
}

export function FreeAskInput({ t, onSend }: FreeAskInputProps) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (): Promise<void> => {
    const text = value.trim()
    if (busy || text === '') return
    if (text.length > FREE_ASK_MAX) {
      setError(fmt(t, 'tree.freeAskTooLong', { n: FREE_ASK_MAX }))
      return
    }
    setBusy(true)
    setError(null)
    let err: string | null
    try {
      err = await onSend(text)
    } catch {
      err = t('tree.askFailed')
    }
    setBusy(false)
    if (err) setError(err)
    else setValue('')
  }

  return (
    // 卡片本身可点击展开/收起且响应空格、回车，这里阻止冒泡，避免输入时误触，也避免拖动卡片。
    <div
      className={c('ask-free')}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className={c('ask-free-row')}>
        <input
          className={c('ask-free-input')}
          type="text"
          value={value}
          disabled={busy}
          placeholder={t('tree.freeAskPlaceholder')}
          aria-label={t('tree.freeAskPlaceholder')}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <button type="button" className={c('btn')} disabled={busy || value.trim() === ''} onClick={() => void send()}>
          {busy ? t('tree.asking') : t('tree.freeAskSend')}
        </button>
      </div>
      {error && <div className={c('tree-err')}>{error}</div>}
    </div>
  )
}
