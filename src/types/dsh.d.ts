// DSH 运行时模块的最小环境声明（精确类型不可用，故保持宽松）。

declare module '@deepseek-ai/dsh-tools' {
  export function defineTool(def: any): any
}

declare module '@deepseek-ai/dsh-skill' {
  export const BUNDLED_SKILL_RANK: number
}

declare module '@deepseek-ai/cordis' {
  export interface Context {
    [key: string]: any
  }
}
