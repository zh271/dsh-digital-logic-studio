// 卡诺图视图：格雷码行列标签、角落变量标注、圈组以半透明填充与内描边表示，5 变量时并排两个平面。
// 化简结果有多个等价最简解（Petrick）时，每个解各画一张卡诺图（各自的圈组），依次排列并标注“解 n”。
import { Fragment } from 'react'
import type { KMapLayout, MinimizeResult } from '../../shared/contracts.ts'
import { Expr } from '../logic.tsx'
import { c } from '../styles.ts'
import { fmt, type TFn } from '../locale.ts'

/** 圈组配色（6 色循环）：在浅色与深色背景上都可辨认。 */
export const GROUP_COLORS = ['#2f80ed', '#f2994a', '#27ae60', '#eb5757', '#9b51e0', '#00a3b8']

type Cell = KMapLayout['cells'][number]

/** 一个最简解：表达式文本与其圈组（每组覆盖的最小项编号）。 */
export interface KMapSolution {
  text: string
  groups: { text: string; cells: number[] }[]
}

function colorOf(gi: number): string {
  return GROUP_COLORS[gi % GROUP_COLORS.length]
}

/** 取全部最简解；minimize 缺失时退回 layout 中的圈组（第一个解）。 */
export function solutionsOf(layout: KMapLayout, minimize?: MinimizeResult): KMapSolution[] {
  const solutions = minimize && Array.isArray(minimize.solutions) ? minimize.solutions : []
  if (solutions.length === 0) {
    return [{ text: minimize?.texts?.[0] ?? '', groups: layout.groups.map(g => ({ text: g.text, cells: g.cells })) }]
  }
  return solutions.map((imps, i) => ({
    text: minimize?.texts?.[i] ?? '',
    groups: imps.map(imp => ({ text: imp.text, cells: imp.covers })),
  }))
}

function Plane({
  layout,
  plane,
  cellAt,
  groupsOf,
  t,
}: {
  layout: KMapLayout
  plane: number
  cellAt: Map<string, Cell>
  groupsOf: Map<number, number[]>
  t: TFn
}) {
  const cols = layout.colCodes
  const label = layout.planeVar ? fmt(t, 'bool.kmap.plane', { v: layout.planeVar, p: plane }) : ''
  return (
    <div className={c('kmap-plane')}>
      {label && <div className={c('kmap-label')}>{label}</div>}
      <div className={c('kmap-grid')} style={{ gridTemplateColumns: `auto repeat(${cols.length}, 40px)` }}>
        <div className={c('kmap-corner')}>{`${layout.rowVars.join('')}\\${layout.colVars.join('')}`}</div>
        {cols.map((code, ci) => (
          <div key={`h${ci}`} className={c('kmap-hdr')}>
            {code}
          </div>
        ))}
        {layout.rowCodes.map((rc, ri) => (
          <Fragment key={`r${ri}`}>
            <div className={`${c('kmap-hdr')} ${c('kmap-hdr-row')}`}>{rc}</div>
            {cols.map((_, ci) => {
              const cell = cellAt.get(`${plane},${ri},${ci}`)
              const gids = cell ? groupsOf.get(cell.minterm) ?? [] : []
              const value = cell?.value
              const text = value === 1 ? '1' : value === 0 ? '0' : value === 'X' ? '×' : ''
              return (
                <div key={ci} className={value === 0 || value === 'X' ? `${c('kmap-cell')} ${c('muted')}` : c('kmap-cell')}>
                  {gids.map((gi, k) => (
                    <span
                      key={gi}
                      className={c('kmap-grp')}
                      style={{
                        top: k * 2,
                        left: k * 2,
                        right: k * 2,
                        bottom: k * 2,
                        borderColor: colorOf(gi),
                        background: colorOf(gi) + '26',
                      }}
                    />
                  ))}
                  {cell && <span className={c('kmap-idx')}>{cell.minterm}</span>}
                  <span className={c('kmap-val')}>{text}</span>
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/** 一个解对应的卡诺图（含圈组图例与化简结果）。 */
function SolutionMap({
  layout,
  cellAt,
  solution,
  index,
  multi,
  t,
}: {
  layout: KMapLayout
  cellAt: Map<string, Cell>
  solution: KMapSolution
  index: number
  multi: boolean
  t: TFn
}) {
  // 最小项 → 覆盖它的圈组下标（按圈组顺序）。
  const groupsOf = new Map<number, number[]>()
  solution.groups.forEach((g, gi) => {
    for (const m of g.cells) {
      const list = groupsOf.get(m)
      if (list) list.push(gi)
      else groupsOf.set(m, [gi])
    }
  })
  const planes: number[] = []
  for (let p = 0; p < layout.planes; p++) planes.push(p)

  return (
    <div style={multi ? { marginTop: index > 0 ? 14 : 0, paddingTop: index > 0 ? 10 : 0, borderTop: index > 0 ? '.5px solid var(--dsw-alias-border-l2)' : undefined } : undefined}>
      {multi && <div className={c('line-label')}>{fmt(t, 'bool.kmap.solution', { n: index + 1 })}</div>}
      <div className={c('kmap-planes')}>
        {planes.map((p) => (
          <Plane key={p} layout={layout} plane={p} cellAt={cellAt} groupsOf={groupsOf} t={t} />
        ))}
      </div>

      <div className={c('line-label')} style={{ marginTop: 10 }}>
        {t('bool.kmap.groups')}
      </div>
      {solution.groups.length === 0 ? (
        <div className={c('legend-item')}>{t('bool.kmap.noGroups')}</div>
      ) : (
        <div className={c('legend')}>
          {solution.groups.map((g, gi) => (
            <div key={gi} className={c('legend-item')}>
              <span className={c('swatch')} style={{ background: colorOf(gi) }} />
              <Expr text={g.text} variables={layout.variables} />
              <span className={c('muted')}>{fmt(t, 'bool.kmap.cells', { n: g.cells.length })}</span>
            </div>
          ))}
        </div>
      )}

      {solution.text && (
        <div style={{ marginTop: 10 }}>
          <div className={c('line-label')}>{t('bool.kmap.minimal')}</div>
          <div className={c('line')}>
            <Expr text={solution.text} variables={layout.variables} />
          </div>
        </div>
      )}
    </div>
  )
}

export function KMapView({ layout, minimize, t }: { layout: KMapLayout; minimize?: MinimizeResult; t: TFn }) {
  const cellAt = new Map<string, Cell>()
  for (const cell of layout.cells) cellAt.set(`${cell.plane},${cell.row},${cell.col}`, cell)

  const solutions = solutionsOf(layout, minimize)
  const multi = solutions.length > 1

  return (
    <div>
      {solutions.map((s, i) => (
        <SolutionMap key={i} layout={layout} cellAt={cellAt} solution={s} index={i} multi={multi} t={t} />
      ))}
    </div>
  )
}
