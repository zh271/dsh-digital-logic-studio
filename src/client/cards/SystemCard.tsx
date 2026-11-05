// dlogic_system 工具卡片：ASM 图（SVG 纵向排布）、状态转移表、控制信号真值表与三种控制器的设计表。
import { useId, type ReactNode } from 'react'
import type { AsmResult, AsmSpec, ControllerResult, CtrlFunction, SchemeDesign, SystemOp, SystemResultMap } from '../../shared/system.ts'
import { argsRawOf, firstArgText, isSettled, parseArgs, readMeta, resultText, type ToolViewProps } from '../meta.ts'
import { Expr } from '../logic.tsx'
import { fmt, type TFn } from '../locale.ts'
import { c as cls } from '../styles.ts'
import { Boundary, Card, MutedRow, TextBody } from './Frame.tsx'

const TOOL = 'dlogic_system'
const KNOWN_OPS: string[] = ['asm', 'controller']
type SystemResult = SystemResultMap[SystemOp]

// ASM 图的几何参数（SVG 用户单位）。
const CX = 170
const BOX_W = 160
const ELL_RX = 62
const ELL_RY = 14
const DIA_W = 170
const DIA_H = 40
const DIAG_WIDTH = 440

function opTitle(op: string, t: TFn): string {
  return KNOWN_OPS.includes(op) ? t(`system.op.${op}`) : t('system.title')
}

export function SystemCard({ t, phase, block }: ToolViewProps) {
  if (phase === 'preparing') return <MutedRow tool={TOOL} title={t('system.title')} text={t('system.preparing')} />
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ['op'])
    return <MutedRow tool={TOOL} title={t('system.title')} text={`${t('system.running')} ${hint}`.trim()} />
  }
  const isError = block.isError === true
  const value = readMeta<SystemResult>(block, TOOL)
  if (isError || value === null) {
    return (
      <Card tool={TOOL} title={t('system.title')} summary="" isError={isError}>
        <TextBody text={resultText(block)} />
      </Card>
    )
  }
  if (!value.ok) {
    return <MutedRow tool={TOOL} title={t('system.title')} text={`${t('system.failed')}：${value.error ?? ''}`} isError />
  }
  const op = value.op
  const r = value.result as SystemResult
  const fallback = <TextBody text={resultText(block)} />
  return (
    <Card tool={TOOL} title={opTitle(op, t)} summary={<Boundary fallback={null}>{summaryOf(op, r, t)}</Boundary>}>
      <Boundary fallback={fallback}>
        <SystemBody op={op} r={r} t={t} />
      </Boundary>
    </Card>
  )
}

/** 卡片标题行的摘要。 */
function summaryOf(op: string, r: SystemResult, t: TFn): ReactNode {
  if (op === 'asm') {
    const a = (r as SystemResultMap['asm']).asm
    const errors = a.issues.filter(i => i.level === 'error').length
    return a.valid ? t('system.asm.valid') : fmt(t, 'system.asm.invalid', { n: errors })
  }
  if (op === 'controller') {
    const x = (r as SystemResultMap['controller']).controller
    return fmt(t, 'system.controller.summary', { n: x.states.length })
  }
  return ''
}

/** 无外框的主体：按 op 分派到 ASM 视图或控制器视图。 */
export function SystemBody({ op, r, t }: { op: string; r: SystemResult; t: TFn }) {
  if (op === 'asm') {
    const x = r as SystemResultMap['asm']
    return <AsmBody spec={x.spec} asm={x.asm} t={t} />
  }
  if (op === 'controller') {
    const x = r as SystemResultMap['controller']
    return <ControllerBody ctl={x.controller} t={t} />
  }
  return <TextBody text="" />
}

// ───────────────────────── ASM 图与状态转移表 ─────────────────────────

function isElseCond(cond: string): boolean {
  return cond.trim().toLowerCase() === 'else'
}

function isAlwaysCond(cond: string): boolean {
  return cond.trim() === '1'
}

function AsmBody({ spec, asm, t }: { spec: AsmSpec; asm: AsmResult; t: TFn }) {
  const errors = asm.issues.filter(i => i.level === 'error').length
  return (
    <div>
      <div className={cls('step')}>
        <span className={asm.valid ? cls('verdict') : `${cls('verdict')} ${cls('verdict-bad')}`}>
          {asm.valid ? t('system.asm.valid') : fmt(t, 'system.asm.invalid', { n: errors })}
        </span>
      </div>
      {asm.issues.length > 0 && (
        <div className={cls('step')}>
          <div className={cls('step-text')}>{t('system.asm.issues')}</div>
          <ul className={cls('list')}>
            {asm.issues.map((issue, k) => (
              <li key={k}>
                <span className={issue.level === 'error' ? cls('bad') : cls('muted')}>
                  {`${issue.level === 'error' ? t('system.asm.error') : t('system.asm.warning')}：${issue.message}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={cls('step')}>
        <div className={cls('step-text')}>{t('system.asm.diagram')}</div>
        <AsmDiagram spec={spec} t={t} />
      </div>
      <div className={cls('step')}>
        <div className={cls('step-text')}>{t('system.asm.table')}</div>
        <TransitionTable asm={asm} t={t} />
      </div>
    </div>
  )
}

/** 状态转移表：行为状态，列为条件变量的全部取值；单元格为次态与此时有效的条件输出。 */
function TransitionTable({ asm, t }: { asm: AsmResult; t: TFn }) {
  return (
    <div className={cls('tt-wrap')}>
      <table className={cls('tt')}>
        <thead>
          <tr>
            <th>{t('system.table.state')}</th>
            <th>{t('system.asm.outputs')}</th>
            {asm.table.combos.map((label, k) => (
              <th key={k}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {asm.table.rows.map(row => (
            <tr key={row.state}>
              <td>{row.state}</td>
              <td>{row.outputs.join('、') || t('system.asm.empty')}</td>
              {row.cells.map((cell, k) => (
                <td key={k}>
                  {cell.next ?? '—'}
                  {cell.active.length > 0 && <div className={cls('muted')}>{cell.active.join('、')}</div>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * ASM 图：自上而下排布。每个状态为矩形；条件输出框为椭圆；判断框为菱形，
 * “是”分支画在右侧，“否”分支继续向下连到下一个判断框，最后是 else 分支。
 */
function AsmDiagram({ spec, t }: { spec: AsmSpec; t: TFn }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const stroke = { stroke: 'var(--dsw-alias-label-secondary)', fill: 'none', strokeWidth: 1 }
  const labelFill = { fill: 'var(--dsw-alias-label-primary)' }
  const subFill = { fill: 'var(--dsw-alias-label-secondary)' }
  const nodes: ReactNode[] = []
  const add = (el: ReactNode): void => {
    nodes.push(<g key={nodes.length}>{el}</g>)
  }
  const arrow = (x1: number, y1: number, x2: number, y2: number): ReactNode => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} style={stroke} markerEnd={`url(#${uid}-arrow)`} />
  )
  let y = 10
  for (const st of spec.states) {
    const hasOut = st.outputs.length > 0
    const h = hasOut ? 42 : 28
    add(
      <>
        <rect x={CX - BOX_W / 2} y={y} width={BOX_W} height={h} rx={3} style={stroke} />
        <text x={CX} y={hasOut ? y + 14 : y + h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} style={labelFill}>
          {st.name}
        </text>
        {hasOut && (
          <text x={CX} y={y + 31} textAnchor="middle" dominantBaseline="middle" fontSize={10} style={subFill}>
            {st.outputs.join('，')}
          </text>
        )}
      </>,
    )
    let cursor = y + h
    for (const co of st.conditionals) {
      const cy = cursor + 22
      add(
        <>
          {arrow(CX, cursor, CX, cy - ELL_RY)}
          <ellipse cx={CX} cy={cy} rx={ELL_RX} ry={ELL_RY} style={stroke} />
          <text x={CX} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={11} style={labelFill}>
            {co.name}
          </text>
          <text x={CX + ELL_RX + 8} y={cy} dominantBaseline="middle" fontSize={10} style={subFill}>
            {`${t('system.asm.when')} ${co.expr}`}
          </text>
        </>,
      )
      cursor = cy + ELL_RY
    }
    const exits = spec.transitions.filter(tr => tr.from === st.name)
    const conds = exits.filter(tr => !isElseCond(tr.cond))
    const elses = exits.filter(tr => isElseCond(tr.cond))
    conds.forEach((tr, k) => {
      if (isAlwaysCond(tr.cond)) {
        const ny = cursor + 18
        add(
          <>
            {arrow(CX, cursor, CX, ny)}
            <text x={CX + 8} y={(cursor + ny) / 2} dominantBaseline="middle" fontSize={10} style={subFill}>
              {`${t('system.asm.uncond')} → ${tr.to}`}
            </text>
          </>,
        )
        cursor = ny
        return
      }
      const cy = cursor + 12 + DIA_H / 2
      add(
        <>
          {arrow(CX, cursor, CX, cy - DIA_H / 2)}
          <polygon points={`${CX},${cy - DIA_H / 2} ${CX + DIA_W / 2},${cy} ${CX},${cy + DIA_H / 2} ${CX - DIA_W / 2},${cy}`} style={stroke} />
          <text x={CX} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={10} style={labelFill}>
            {tr.cond}
          </text>
          <line x1={CX + DIA_W / 2} y1={cy} x2={CX + DIA_W / 2 + 26} y2={cy} style={stroke} />
          <text x={CX + DIA_W / 2 + 30} y={cy} dominantBaseline="middle" fontSize={10} style={subFill}>
            {`${t('system.asm.yes')} → ${tr.to}`}
          </text>
          {k > 0 && (
            <text x={CX + 6} y={cursor + 8} dominantBaseline="middle" fontSize={10} style={subFill}>
              {t('system.asm.no')}
            </text>
          )}
        </>,
      )
      cursor = cy + DIA_H / 2
    })
    if (elses.length > 0) {
      const ny = cursor + 18
      add(
        <>
          {arrow(CX, cursor, CX, ny)}
          <text x={CX + 8} y={(cursor + ny) / 2} dominantBaseline="middle" fontSize={10} style={subFill}>
            {`${t('system.asm.elseLabel')} → ${elses[0].to}`}
          </text>
        </>,
      )
      cursor = ny
    }
    y = cursor + 20
  }
  const height = y + 4
  return (
    <svg viewBox={`0 0 ${DIAG_WIDTH} ${height}`} style={{ width: '100%', maxWidth: DIAG_WIDTH, height: 'auto', display: 'block' }} role="img">
      <defs>
        <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--dsw-alias-label-secondary)' }} />
        </marker>
      </defs>
      {nodes}
    </svg>
  )
}

// ───────────────────────── 控制器 ─────────────────────────

function ControllerBody({ ctl, t }: { ctl: ControllerResult; t: TFn }) {
  return (
    <div>
      <div className={cls('step')}>
        <div className={cls('line')}>
          <span className={cls('line-label')}>{t('system.controller.initial')}</span>
          <span>{ctl.initial}</span>
        </div>
        <div className={cls('line')}>
          <span className={cls('line-label')}>{t('system.asm.vars')}</span>
          <span>{ctl.conditionVars.join('、') || t('system.asm.empty')}</span>
        </div>
      </div>
      <div className={cls('step')}>
        <div className={cls('step-text')}>{t('system.controller.signals')}</div>
        <div className={cls('tt-wrap')}>
          <table className={cls('tt')}>
            <thead>
              <tr>
                <th>{t('system.table.state')}</th>
                {ctl.signals.map(sig => (
                  <th key={sig}>{sig}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ctl.controlTable.map(row => (
                <tr key={row.state}>
                  <td>{row.state}</td>
                  {row.values.map((v, k) => (
                    <td key={k} className={v === '0' ? cls('muted') : undefined}>
                      {v === '0' || v === '1' ? v : <Expr text={v} variables={ctl.conditionVars} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {ctl.schemes.map(s => (
        <SchemeSection key={s.scheme} s={s} condVars={ctl.conditionVars} t={t} />
      ))}
    </div>
  )
}

function SchemeSection({ s, condVars, t }: { s: SchemeDesign; condVars: string[]; t: TFn }) {
  return (
    <div className={cls('step')}>
      <div className={cls('step-text')}>{t(`system.scheme.${s.scheme}`)}</div>
      <div className={cls('line')}>
        <span className={cls('line-label')}>{t('system.scheme.bits')}</span>
        <span>{s.bits.join('、')}</span>
      </div>
      <div className={cls('tt-wrap')}>
        <table className={cls('tt')}>
          <thead>
            <tr>
              <th>{t('system.table.state')}</th>
              <th>{t('system.table.code')}</th>
              {s.decoder && <th>{t('system.table.line')}</th>}
            </tr>
          </thead>
          <tbody>
            {s.codes.map((row, k) => (
              <tr key={row.state}>
                <td>{row.state}</td>
                <td>{row.code}</td>
                {s.decoder && <td>{s.decoder[k].line}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {s.muxes &&
        s.muxes.map(mx => (
          <div key={mx.bit} className={cls('step')}>
            <div className={cls('line')}>
              <span className={cls('line-label')}>{fmt(t, 'system.mux.title', { bit: mx.bit })}</span>
              <span className={cls('muted')}>{`${t('system.mux.select')}：${mx.select.join('、')}`}</span>
            </div>
            <div className={cls('tt-wrap')}>
              <table className={cls('tt')}>
                <thead>
                  <tr>
                    <th>{t('system.table.code')}</th>
                    <th>{t('system.table.state')}</th>
                    <th>{t('system.table.data')}</th>
                  </tr>
                </thead>
                <tbody>
                  {mx.rows.map((row, k) => (
                    <tr key={k}>
                      <td>{row.code}</td>
                      <td>{row.state ?? t('system.table.unused')}</td>
                      <td>{row.state === null ? row.data : <FnText text={row.data} variables={condVars} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      <FunctionList fns={s.functions} t={t} />
      <ul className={cls('list')}>
        {s.devices.map((d, k) => (
          <li key={`d${k}`}>
            <span>{d}</span>
          </li>
        ))}
      </ul>
      <ul className={cls('list')}>
        {s.notes.map((n, k) => (
          <li key={`n${k}`}>
            <span className={cls('muted')}>{n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 表达式文本：已化简且含变量时用 Expr 排版，否则原样显示。 */
function FnText({ text, variables }: { text: string; variables: string[] }) {
  if (text === '0' || text === '1' || variables.length === 0) return <span>{text}</span>
  return <Expr text={text} variables={variables} />
}

function FunctionList({ fns, t }: { fns: CtrlFunction[]; t: TFn }) {
  return (
    <div className={cls('step')}>
      <div className={cls('step-text')}>{t('system.scheme.functions')}</div>
      <ul className={cls('list')}>
        {fns.map(f => (
          <li key={f.name} style={{ flexDirection: 'column', gap: 2 }}>
            <div>
              <span className={cls('id')}>{f.name}</span>{' '}
              <span className={cls('muted')}>{t(`system.role.${f.role}`)}</span>
              {'  '}
              {f.minimized ? <FnText text={f.texts[0]} variables={f.variables} /> : <span>{f.texts[0]}</span>}
              <span className={cls('muted')}>
                {f.minimized
                  ? `  ${fmt(t, 'system.scheme.cost', { terms: f.cost.terms, literals: f.cost.literals })}`
                  : `  ${t('system.scheme.minimized')}`}
              </span>
            </div>
            {f.minimized &&
              f.texts.length > 1 &&
              f.texts.slice(1).map((x, k) => (
                <div key={k} style={{ paddingLeft: 24 }}>
                  <span className={cls('muted')}>{fmt(t, 'system.scheme.solution', { n: k + 2 })}</span>{' '}
                  <FnText text={x} variables={f.variables} />
                </div>
              ))}
          </li>
        ))}
      </ul>
    </div>
  )
}
