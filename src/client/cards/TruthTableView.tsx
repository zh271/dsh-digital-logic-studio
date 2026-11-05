// 真值表视图：超过 16 行时折叠，提供“显示全部”切换；无关项 X 显示为 ×。
import { useState } from 'react'
import type { TruthTable } from '../../shared/contracts.ts'
import { c } from '../styles.ts'
import { fmt, type TFn } from '../locale.ts'

const COLLAPSE_AFTER = 16

export function TruthTableView({ table, t }: { table: TruthTable; t: TFn }) {
  const [all, setAll] = useState(false)
  const rows = table.rows
  const shown = all ? rows : rows.slice(0, COLLAPSE_AFTER)
  return (
    <div>
      <div className={c('tt-wrap')}>
        <table className={c('tt')}>
          <thead>
            <tr>
              <th>m</th>
              {table.variables.map((v) => (
                <th key={v}>{v}</th>
              ))}
              <th>F</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.index}>
                <td className={c('tt-m')}>{r.index}</td>
                {r.inputs.map((b, i) => (
                  <td key={i}>{b}</td>
                ))}
                <td className={r.output === 'X' ? `${c('tt-out')} ${c('muted')}` : c('tt-out')}>
                  {r.output === 'X' ? '×' : r.output}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > COLLAPSE_AFTER && (
        <div style={{ marginTop: 6 }}>
          <button type="button" className={c('btn')} onClick={() => setAll((v) => !v)}>
            {all ? t('bool.truth.collapse') : fmt(t, 'bool.truth.all', { n: rows.length })}
          </button>
        </div>
      )}
    </div>
  )
}
