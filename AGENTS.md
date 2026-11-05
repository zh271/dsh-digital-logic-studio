# AGENTS.md

Instructions for AI agents installing or working on this DeepSeek Harness (DSH) plugin.

## Install (most common task)

This repo is a DSH bundle: the root `package.json` declares `dsh.bundle`, and the built `lib/` is committed, so **no build is needed**.

1. Requirements: DSH `>=0.2.1-rc.5 <0.3.0`, and `git` on PATH.
2. Pick the target profile. Ask the user which one; do not guess, and do not run `--from-default-profile` on an existing profile (it rebuilds the profile and wipes its config).
3. Install a tagged release:

   ```bash
   dsh plugin --profile <profile> add git+https://github.com/zh271/dsh-digital-logic-studio.git#v0.1.0
   ```

   Or, in the DSH desktop app: **Plugins** → install → paste `git+https://github.com/zh271/dsh-digital-logic-studio.git`.
   On Windows, if `dsh` is not on PATH, it is at `%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd`.
4. Restart DSH. The plugin page should list **数字逻辑助教 / Digital Logic Studio**, enabled.
5. Verify: ask a digital-logic question (e.g. "用卡诺图化简 F=Σm(0,2,5,7,8,10,13,15)"). The model loads the `digital-logic-tutor` skill, calls `dlogic_*` tools, and a "学习树" tab appears in the right sidebar.

A pnpm warning about peer dependencies is expected: `@deepseek-ai/*` packages are provided by DSH at runtime.

### Optional: Icarus Verilog

Only needed for `dlogic_hdl` compile/simulate; without it the tool falls back to rule-based checks.

- Windows: `winget install --id MSYS2.MSYS2`, then `C:\msys64\usr\bin\bash.exe -lc "pacman -Sy --noconfirm mingw-w64-ucrt-x86_64-iverilog"`.
- macOS: `brew install icarus-verilog`. Linux: `apt install iverilog`.
- Lookup order: `DLOGIC_IVERILOG_DIR`, `C:\msys64\ucrt64\bin`, then PATH.

### Uninstall

```bash
dsh plugin --profile <profile> remove dsh-digital-logic-studio
```

## Develop

- Node.js 24+, pnpm. `pnpm install`, `pnpm run build`, `pnpm run typecheck`, `pnpm test` (633 tests, Node runs the TypeScript directly).
- Never install `@deepseek-ai/*` into this folder's `node_modules`; `pnpm-workspace.yaml` sets `autoInstallPeers: false`.
- Link for local testing: `dsh plugin --profile <test-profile> add link:/absolute/path/to/this/repo`.
- Host code changes need a rebuild **and a DSH restart**; client changes need a rebuild and page refresh; `skills/` is re-read on every load.
- Changing tree folding in `src/shared/tree.ts` requires bumping `stateVersion` in `src/host/projection.ts`.
- Commit the rebuilt `lib/` with any source change: Git installs do not run a build.

Layout: `src/solvers/` pure algorithms, `src/host/` tools/skill/projection, `src/client/` browser UI, `skills/` skill text and references, `tests/` unit tests. See README.md for details.
