# 数字逻辑助教（dsh-digital-logic-studio）

面向高校《数字逻辑》课程的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）插件。所有数值计算、化简和等价判断都由确定性求解器完成，模型只负责讲解。结果以图示显示在回答下方，侧栏里的「学习树」可以对任意一张卡片继续追问。

教材按白中英《数字逻辑》（第 6 版）的 7 章组织：开关理论基础、组合逻辑、时序逻辑、存储逻辑、可编程逻辑、数字系统、A/D 与 D/A 转换。硬件描述语言使用 Verilog HDL。

## 功能

- **12 个计算工具**：模型调用工具得到结果，不心算。

  | 工具 | 作用 |
  |---|---|
  | `dlogic_num` | 进制与编码换算（按权展开、除基取余、乘基取整、分组法） |
  | `dlogic_bool` | 表达式解析、真值表、标准式、Q-M 化简（列出全部最简解）、卡诺图、险象、反演与对偶、门电路形式、等价判定 |
  | `dlogic_verify` | 答案核对与判分，导学模式下不泄露答案 |
  | `dlogic_comb` | 门级网表分析、由表达式画逻辑图，以及用 74LS138/139/148/151/153/85/283/280 实现函数 |
  | `dlogic_seq` | 触发器、同步时序电路分析、160/161/163 计数器、移位寄存器、时序波形 |
  | `dlogic_fsm` | 状态化简、状态编码、激励与输出函数、自启动检查 |
  | `dlogic_mem` | 存储器扩展与地址映射、ROM/PLA/PAL 点阵、LUT 掩码 |
  | `dlogic_adda` | D/A 输出电压、逐次逼近、并行比较、双积分、量化与采样 |
  | `dlogic_system` | ASM 图校验，计数器型、多路选择器型、定序型控制器设计 |
  | `dlogic_hdl` | Verilog 静态检查与仿真，自动记录波形（需要 Icarus Verilog，见下文） |
  | `dlogic_knowledge` | 教材知识图谱查询（157 个知识点） |
  | `dlogic_card` | 登记学习树卡片与追问 |

- **教学技能 `digital-logic-tutor`**：包含解题核验、苏格拉底式导学和数字系统设计三种模式，并附 9 份按章编写的参考资料。模型只在需要时读取参考资料，以节省 token。
- **图示**：卡诺图、真值表、门级逻辑图、波形图、状态图、接线表等显示在回答正下方。逻辑图同时写成 SVG 文件，直接嵌入回答。
- **学习树**（右侧栏标签页）：每次回答登记为一张卡片，卡片带 2～4 个追问。点击追问后，由插件直接请求模型作答，不占用主对话。卡片里的知识术语可以点击，展开成一张新的概念卡片。学习树还支持：
  - 自由输入追问；
  - 多选卡片后对比或总结；
  - 生成整棵树的复习提纲；
  - 复制一条分支的上下文，粘贴到新会话里继续；
  - 拖动卡片、平移画布，以及重置布局。

界面文字为中文。

## 环境要求

- DeepSeek Harness **0.2.1-rc.5 及以上、0.3.0 以下**（见 `package.json` 的 `engines.dsh`）。
- 可选：[Icarus Verilog](https://steveicarus.github.io/iverilog/)，供 `dlogic_hdl` 编译和仿真使用。没有安装时，`dlogic_hdl` 只做规则匹配检查，并在结果里说明检查能力已降级。

## 安装

**在 DSH 桌面版中安装**：打开**插件**页，选择安装，输入：

```text
git+https://github.com/zh271/dsh-digital-logic-studio.git
```

要安装某个发布版本，在地址后加标签，例如 `git+https://github.com/zh271/dsh-digital-logic-studio.git#v0.1.0`。

**用命令行安装**（`<profile>` 换成你的 profile 名）：

```bash
dsh plugin --profile <profile> add git+https://github.com/zh271/dsh-digital-logic-studio.git
```

仓库已带构建好的 `lib/`，安装时不需要编译。安装后重启 DSH。在对话里问一道数字逻辑题，模型就会加载技能。

### 安装 Icarus Verilog（可选）

Windows 推荐用 MSYS2：

```powershell
winget install --id MSYS2.MSYS2 --source winget
C:\msys64\usr\bin\bash.exe -lc "pacman -Sy --noconfirm mingw-w64-ucrt-x86_64-iverilog"
```

插件按以下顺序查找 `iverilog`：

1. 环境变量 `DLOGIC_IVERILOG_DIR` 指定的目录；
2. `C:\msys64\ucrt64\bin`；
3. 系统 `PATH`。

macOS 和 Linux 用系统包管理器安装（如 `brew install icarus-verilog`、`apt install iverilog`）即可。

## 使用示例

- 「用卡诺图化简 F(A,B,C,D)=Σm(0,2,5,7,8,10,13,15)」
- 「(25.625)₁₀ 转成二进制和十六进制」
- 「用 74LS151 实现 F=AB+BC+AC」
- 「用 74LS161 设计一个模 10 计数器」
- 「检查这段 Verilog 并仿真」，代码直接贴在消息里
- 「我想自己做，给我提示」，进入导学模式：先写出你的答案，插件只指出第一个出错的地方

## 目录结构

```text
package.json          组合包清单（dsh.bundle 指向 cordis.patch.yml，dsh.client 声明前端注入）
cordis.patch.yml      组合包 patch：把插件插入 profile
lib/                  构建产物：index.js（Host）与 client.js（浏览器），由 scripts/build.mjs 生成
locale/               插件页显示的标题与描述
icon.svg              插件图标
skills/               技能正文 SKILL.md、9 份参考资料和知识图谱 JSON
src/shared/           Host 与前端共用的契约、学习树折叠与布局
src/solvers/          纯算法求解器，不依赖 DSH，可直接单测
src/host/             Host 入口、工具定义、技能提供方、会话投影、追问命令
src/client/           浏览器侧：工具卡片、图示区、学习树面板
tests/                node:test 单元测试
scripts/build.mjs     esbuild 构建脚本
```

## 开发

需要 Node.js 24 及以上和 pnpm。

```bash
pnpm install
pnpm run build       # 生成 lib/index.js 与 lib/client.js
pnpm run typecheck
pnpm test            # Node 直接运行 TypeScript 测试
```

联调时，把本地目录链接进一个测试 profile。路径必须写绝对路径：

```bash
dsh plugin --profile dlogic-dev add link:/绝对路径/dsh-digital-logic-studio
dsh --profile dlogic-dev
```

注意事项：

- `@deepseek-ai/*` 包是 peer 依赖，由 DSH 运行时提供，构建时保持外部引用。它们**不能**装进本目录的 `node_modules`，否则会与 DSH 的共享实例冲突。`pnpm-workspace.yaml` 已设置 `autoInstallPeers: false`。
- 改了前端代码：重新构建后刷新页面。改了 Host 代码：重新构建后**重启 DSH**。技能正文和参考资料每次加载时都会重新读取，改完不用重启。
- 改了学习树的折叠逻辑（`src/shared/tree.ts`）：递增 `src/host/projection.ts` 里的 `stateVersion`，让旧缓存失效。
- 发布前运行 `pnpm run build`，并提交 `lib/`。通过 Git 安装时不会运行构建。

## 发布新版本

1. 修改 `package.json` 的 `version`，构建并提交 `lib/`。
2. 打标签 `vX.Y.Z`（与 `version` 一致）并推送。DSH 的插件索引生成器会把每个 `vX.Y.Z` 标签列为一个版本。

## 许可

[MIT](LICENSE)
