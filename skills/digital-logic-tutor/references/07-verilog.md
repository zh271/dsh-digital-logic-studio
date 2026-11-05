# 硬件描述语言 Verilog HDL（参考）

> 助教查阅用。教材的硬件描述语言部分原用 VHDL，本插件统一用 Verilog HDL（Verilog-2001 语法）讲解，末节给出 VHDL 与 Verilog 的对照。
> 所有代码按可综合风格书写，但本文档未经仿真器编译验证；学生使用前可在任意 Verilog 仿真器中自行检查。
> 代码中的预期行为写在代码前后的文字中，阅读代码时对照即可。
> 时序电路的状态表、状态图等分析结果，以 `dlogic_seq` 计算为准；本文的状态机示例只用于讲解写法。

## 1. 模块结构

Verilog 的基本单元是 `module`，相当于 VHDL 中的实体（entity）加结构体（architecture）。

```verilog
module module_name (
    input  wire in_port,        // 输入端口，默认为 wire 类型
    output wire out_port        // 输出端口，类型按赋值方式选 wire 或 reg
);
    // 内部信号声明
    wire  mid_wire;             // 由 assign 或门实例驱动
    reg   reg_q;                // 由 always 块赋值

    // 功能描述（三种建模方式之一或混合使用）
endmodule
```

- **端口**：`input` 只能读，`output` 向外驱动，`inout` 为双向（多用于总线，本章不展开）。
- **wire**：表示连线，不保存数值。只能被 `assign`、门原语或模块的输出端口驱动。
- **reg**：表示变量，只能在 `always` 块或 `initial` 块中赋值。注意：`reg` 不一定对应寄存器。在组合 `always` 块中赋值的 `reg` 综合出来是组合电路，只有在时序 `always` 块中才对应触发器。
- 位宽：`[n-1:0]` 表示 n 位向量，最高位写在左边。例如 `wire [3:0] d;` 对应 4 位总线，`d[3]` 为最高位。VHDL 中的 `std_logic_vector(n-1 downto 0)` 与之对应（见第 9 节）。
- 信号的数值表示：`1'b0`、`4'b1010`、`4'd9`、`8'hA5`。位宽与进制写清楚，避免综合时位宽不一致。

## 2. 三种建模方式

### 2.1 结构描述（门级原语）

使用内置门原语 `and`、`or`、`not`、`nand`、`nor`、`xor`、`xnor`、`buf`，按电路图连接。第一个端口为输出，其余为输入。

全加器（门级）：

```verilog
// 门级结构描述全加器
module full_adder_gate (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire s,        // 和
    output wire cout      // 进位输出
);
    wire t1, t2, t3;      // 内部连线

    xor u1 (t1, a, b);    // t1 = a ^ b
    xor u2 (s, t1, cin);  // s = a ^ b ^ cin
    and u3 (t2, a, b);    // t2 = a · b
    and u4 (t3, t1, cin); // t3 = (a ^ b) · cin
    or  u5 (cout, t2, t3);// cout = a·b + (a ^ b)·cin
endmodule
```

预期行为：输入 a、b、cin 的和为 `s`，进位为 `cout`。例如 a=1、b=1、cin=0 时 s=0、cout=1。

### 2.2 数据流描述（assign）

用 `assign` 直接写布尔表达式或选择表达式，连续赋值，任何右边信号变化时左边立即更新。

2 选 1 数据选择器（MUX）：

```verilog
// 数据流描述 2 选 1 MUX
module mux2_df (
    input  wire a,
    input  wire b,
    input  wire sel,
    output wire y
);
    // sel = 0 时 y = a，sel = 1 时 y = b
    assign y = sel ? b : a;   // 条件运算符 ?: 相当于 VHDL 的 when-else
endmodule
```

预期行为：sel=0 时 y 跟随 a，sel=1 时 y 跟随 b。这是纯组合电路，没有存储。

### 2.3 行为描述（always）

用 `always` 块描述算法行为，块内用过程语句（`if`、`case` 等）。组合逻辑的块用 `always @(*)`，时序逻辑的块用 `always @(posedge clk)`。

全加器（行为级）：

```verilog
// 行为描述全加器
module full_adder_beh (
    input  wire a,
    input  wire b,
    input  wire cin,
    output reg  s,
    output reg  cout
);
    always @(*) begin
        // 2 位结果：{cout, s} 为两位拼接，cout 为高位
        {cout, s} = a + b + cin;
    end
endmodule
```

预期行为：与 2.1 的门级全加器功能相同。`a + b + cin` 的结果截断为 2 位，高位给 `cout`，低位给 `s`。综合工具会把它映射为全加逻辑。

三种方式可以混用：一个模块中可以既有门原语，也有 `assign`，还可以例化其他模块。

## 3. 阻塞赋值 `=` 与非阻塞赋值 `<=`

### 3.1 基本规则

| 场合 | 使用的赋值 | 原因 |
|---|---|---|
| 组合逻辑 `always @(*)` | 阻塞 `=` | 块内语句按顺序执行，后面的语句能立即用到前面的结果 |
| 时序逻辑 `always @(posedge clk)` | 非阻塞 `<=` | 所有右边先采样，再同时更新，符合触发器的并行行为 |
| `assign` 连续赋值 | （无 `=`/`<=` 之分，固定为连续赋值） | 右边变化即更新 |

### 3.2 常见错误

- **不要在同一个 `always` 块中混用 `=` 与 `<=`**。
- **同一个变量只能由一个 `always` 块赋值**（多驱动），否则综合或仿真结果不确定。
- **组合块写 `<=`**：仿真时输出会晚一拍，综合结果与仿真不一致。
- **时序块写 `=`**：多个寄存器按顺序更新，`q2 = q1` 会取到 `q1` 的新值，形成移位错误。

### 3.3 对比示例

用两个寄存器的交换说明差别：

```verilog
// 正确：非阻塞，每拍交换 a 与 b
always @(posedge clk) begin
    a <= b;   // 右边都取更新前的值
    b <= a;
end

// 错误：阻塞，a 先被改成 b 的值，b 再取到了新的 a，两个值都变成原来的 b
always @(posedge clk) begin
    a = b;
    b = a;
end
```

预期行为：正确写法每个时钟沿交换一次 `a` 与 `b`；错误写法两者都变成原来的 `b`。

## 4. `always @(*)` 与敏感表

- `always @(*)`：自动包含块内所有被读取的信号（在右边、条件表达式中出现的信号）。不写敏感表时，综合工具会按信号列表推断，**推荐在组合逻辑中使用**。
- 显式敏感表：`always @(a or b or sel)`，或 Verilog-2001 写法 `always @(a, b, sel)`。遗漏信号时，仿真中输出不会随该信号变化，但综合结果仍按逻辑完整实现，两者会不一致。
- 时序逻辑的敏感表只写时钟边沿：`always @(posedge clk)`，或带异步复位的 `always @(posedge clk or negedge rst_n)`。
- 不要在组合 `always` 块中写 `@(posedge clk)`，那是时序逻辑。

## 5. 组合逻辑中的锁存器（Latch）

### 5.1 推断锁存器的原因

组合 `always` 块中，**如果某个输出在某些条件下没有被赋值**，综合工具会认为该输出需要“记住”原值，于是推断出锁存器。锁存器是电平敏感的存储单元，在组合电路中通常是设计错误。

常见原因：

- `if` 没有 `else`（或某些分支没有赋值）。
- `case` 没有覆盖所有取值，且没有 `default`。

错误示例（sel=0 时 y 没有被赋值）：

```verilog
// 错误：推断出锁存器
always @(*) begin
    if (sel)
        y = a;
    // 缺少 else，sel = 0 时 y 保持原值
end
```

### 5.2 消除方法

**方法一**：补全所有分支。

```verilog
always @(*) begin
    if (sel)
        y = a;
    else
        y = b;     // 补全 else
end
```

**方法二**：在块开头给默认值，之后再按条件覆盖。

```verilog
always @(*) begin
    y = 1'b0;      // 默认值，保证所有路径都有赋值
    if (sel)
        y = a;
end
```

**case 语句**：一定写 `default` 分支。

```verilog
always @(*) begin
    case (code)
        2'b00: y = 1'b1;
        2'b01: y = 1'b0;
        default: y = 1'b0;   // 补全其余取值
    endcase
end
```

预期行为：三种写法的 y 在任何输入下都有确定值，不会推断出锁存器。综合报告中如出现 “latch inferred” 类警告，应先检查这一节的情况。

## 6. 同步复位与异步复位

复位用于把寄存器置为确定的初始状态，常用低电平有效的 `rst_n`。

### 6.1 同步复位

复位信号只在时钟的有效边沿生效。

```verilog
// 同步复位：复位在时钟上升沿才生效
always @(posedge clk) begin
    if (!rst_n)
        q <= 4'd0;       // 复位：在时钟沿置 0
    else
        q <= q + 4'd1;   // 正常工作
end
```

### 6.2 异步复位

复位信号一有效就立即清零，与时钟无关。敏感表中要包含复位的下降沿。

```verilog
// 异步复位：rst_n 下降沿立即清零
always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
        q <= 4'd0;
    else
        q <= q + 4'd1;
end
```

预期行为：同步复位时，`rst_n` 变低后要等到下一个上升沿，`q` 才变为 0；异步复位时，`rst_n` 变低的瞬间 `q` 即为 0，与时钟无关。与第 5 章的异步/同步清零对应关系相同：161 为异步清零，163 为同步清零。

## 7. 计数器（模 10）

用 4 位寄存器做十进制计数器，计数值 0～9 循环，使能 `en` 为 1 时计数。

```verilog
// 模 10 加法计数器（8421 码），异步复位，使能控制
module cnt10 (
    input  wire       clk,
    input  wire       rst_n,   // 异步复位，低有效
    input  wire       en,      // 计数使能
    output reg  [3:0] q,       // 计数输出，8421 码
    output wire       co       // 进位输出：计到 9 且使能时为 1
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            q <= 4'd0;
        else if (en) begin
            if (q == 4'd9)
                q <= 4'd0;        // 计到 9 后回到 0，实现模 10
            else
                q <= q + 4'd1;
        end
    end

    assign co = en & (q == 4'd9); // 组合输出，用于级联
endmodule
```

预期行为：复位后 q=0。en=1 时，每个上升沿 q 加 1，计到 9 的下一拍变为 0，状态序列为 0→1→…→9→0。en=0 时保持。co 只在 q=9 且 en=1 时为 1，可用作高位片的使能。

## 8. 三段式状态机：110 序列检测器

### 8.1 设计选择

本例选用**摩尔型**（Moore）：输出只取决于现态。检测串行输入 `x` 中出现的 `110` 序列，允许重叠（例如 `11011` 中的 `110` 被检出）。

状态定义（用 2 位编码）：

| 状态 | 编码 | 含义 |
|---|---|---|
| S0 | 00 | 尚未收到有效前缀 |
| S1 | 01 | 最近一位为 1（前缀 “1”） |
| S2 | 10 | 最近两位为 11（前缀 “11”） |
| S3 | 11 | 最近三位为 110，检测到序列 |

状态转移（x 为输入，括号内为次态）：

- S0：x=0 → S0；x=1 → S1。
- S1：x=0 → S0；x=1 → S2。
- S2：x=0 → S3；x=1 → S2。
- S3：x=0 → S0；x=1 → S1。

输出：z = 1 当且仅当现态为 S3。

预期行为：z 在 `110` 的最后一位（即进入 S3 的那个时钟沿）之后变为 1，并维持一个时钟周期（下一个时钟沿按 x 转移）。

若改用米利型（Mealy），输出为 `z = (state == S2) & ~x`，即在 S2 状态下收到 0 时立即输出 1，不必等一拍。两种写法检测到的序列相同，只是输出时刻不同。本例不展开米利型的代码。

### 8.2 完整代码

```verilog
// 110 序列检测器（摩尔型，可重叠）
// 三段式：状态寄存器（时序） + 次态逻辑（组合） + 输出逻辑（组合）
module det110_moore (
    input  wire clk,
    input  wire rst_n,   // 异步复位，低有效
    input  wire x,       // 串行输入
    output reg  z        // 检测输出：检测到 110 时为 1
);
    // 状态编码
    localparam S0 = 2'b00,
               S1 = 2'b01,
               S2 = 2'b10,
               S3 = 2'b11;

    reg [1:0] state;       // 现态
    reg [1:0] next_state;  // 次态

    // 第一段：状态寄存器（时序逻辑，异步复位，非阻塞赋值）
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            state <= S0;
        else
            state <= next_state;
    end

    // 第二段：次态逻辑（组合逻辑，阻塞赋值）
    always @(*) begin
        case (state)
            S0: next_state = x ? S1 : S0;
            S1: next_state = x ? S2 : S0;
            S2: next_state = x ? S2 : S3;
            S3: next_state = x ? S1 : S0;
            default: next_state = S0;   // 不可达状态，回到初始状态
        endcase
    end

    // 第三段：输出逻辑（组合逻辑，摩尔型，只取决于现态）
    always @(*) begin
        case (state)
            S3: z = 1'b1;
            default: z = 1'b0;
        endcase
    end
endmodule
```

预期行为：复位后处于 S0。若输入依次为 1、1、0，则状态依次为 S1、S2、S3，z 在第三个时钟沿之后变为 1。输入 1、1、0、1、1、1、0 时，每个时钟沿之后 z 依次为 0、0、1、0、0、0、1。

### 8.3 测试平台

```verilog
`timescale 1ns/1ps
// 测试平台：输入序列 1101110，检查每拍的 z
module tb_det110_moore;
    reg  clk = 1'b0;
    reg  rst_n = 1'b0;
    reg  x = 1'b0;
    wire z;

    integer i;
    integer errors = 0;

    // 输入序列（最高位先送入）与期望输出（与 8.2 的预期行为一致）
    reg [6:0] in_seq  = 7'b1101110;
    reg [6:0] exp_seq = 7'b0010001;

    // 被测模块例化（命名端口连接）
    det110_moore dut (
        .clk   (clk),
        .rst_n (rst_n),
        .x     (x),
        .z     (z)
    );

    // 时钟：周期 10 ns
    always #5 clk = ~clk;

    initial begin
        #12 rst_n = 1'b1;              // 12 ns 时释放复位

        for (i = 6; i >= 0; i = i - 1) begin
            @(negedge clk);            // 在下降沿改变输入，避免与上升沿竞争
            x = in_seq[i];
            @(posedge clk);            // 上升沿：状态更新
            #1;                        // 等待组合输出稳定后再检查
            if (z !== exp_seq[i]) begin
                errors = errors + 1;
                $display("第 %0d 拍: x=%b, 期望 z=%b, 实际 z=%b  [错误]",
                         7 - i, x, exp_seq[i], z);
            end
            else begin
                $display("第 %0d 拍: x=%b, z=%b  [正确]", 7 - i, x, z);
            end
        end

        if (errors == 0)
            $display("全部通过");
        else
            $display("共 %0d 处错误", errors);

        $finish;                       // 结束仿真
    end
endmodule
```

说明：

- `always #5 clk = ~clk;` 产生周期 10 ns 的时钟，第一个上升沿在 5 ns。
- 输入在下降沿改变，上升沿采样，保证输入与时钟不竞争。
- `!==` 与 `===` 会把 x、z 状态也当作不匹配，比 `!=` 更严格，适合自检。
- `$display` 输出文字结果；`$monitor(...)` 会在参数变化时自动打印，可用于观察波形，但输出较多，检查通过后可注释掉。
- `$finish` 结束仿真。

## 9. 移位寄存器

4 位右移寄存器（串行输入从最高位进入），与第 3 章 194 的右移约定一致（右移时串行输入进入 $Q_3$，$Q_i \leftarrow Q_{i+1}$）。

```verilog
// 4 位右移寄存器，异步复位
module shift4_right (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       din,    // 串行输入
    output reg  [3:0] q       // q[3] 为最高位
);
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            q <= 4'b0000;
        else
            q <= {din, q[3:1]};  // 拼接：新数据进入 q[3]，原来的 q[3:1] 右移到 q[2:0]
    end
endmodule
```

预期行为：复位后 q=0000。若 din 依次为 1、0、1、1，每个时钟沿之后 q 依次为 1000、0100、1010、1101。

左移只需把拼接写为 `{q[2:0], din}`，新数据进入 q[0]。

## 10. 测试平台写法小结

测试平台（testbench）是没有端口的顶层模块，用于例化被测模块、产生激励并检查输出。写法要点：

- `reg` 驱动输入，`wire` 接收输出。
- `initial` 块用于一次性的激励过程（复位、输入序列、结束仿真）；`always #延时` 用于周期性时钟。
- 用 `@(negedge clk)`、`@(posedge clk)` 等事件控制时序，并在输出稳定后再检查。
- 自检比较：用期望值与实际值比较，统计错误数，最后用 `$display` 报告结果。
- 测试平台只用于仿真，`initial`、`#延时`、`$display` 不可综合，不要写进被综合的模块。

## 11. 常见易错点

1. **reg 与 wire 混淆**：`assign` 的左边必须是 `wire`，`always` 块中赋值的左边必须是 `reg`。输出端口若在 `always` 中赋值，声明为 `output reg`。
2. **阻塞与非阻塞混用**：组合块用 `=`，时序块用 `<=`，同一块内不混用。
3. **锁存器被无意推断**：组合块中 `if` 缺 `else`、`case` 缺 `default`，或某个输出在部分路径未赋值。
4. **敏感表不完整**：组合逻辑优先用 `always @(*)`。
5. **多驱动**：同一个变量不能被两个 `always` 块或 `assign` 同时驱动。
6. **位宽不一致**：加法结果需要的位数大于被赋值的位数时，高位被截断。例如 `q + 1` 赋给 `4'd` 位宽的 `q` 时，最高位进位丢失，计数器恰好模 16。计数器需要进位时，把结果扩展一位再取位。
7. **相等比较与赋值混淆**：`==` 是比较，`=` 是赋值，条件判断中不要写成 `=`。
8. **多条语句缺 begin/end**：`if` 或 `case` 分支中有多条语句时，必须用 `begin ... end` 包围。
9. **在被综合代码中使用 `initial` 或 `#延时`**：这些属于仿真语句，不可综合。
10. **测试平台在时钟沿附近改变输入**：输入应在下降沿或与时钟错开的时间改变。
11. **异步复位释放时机**：复位信号的释放应与时钟同步，否则可能出现亚稳态。本章的例子仅用于讲解写法。
12. **有符号与无符号混用**：默认按无符号处理，需要有符号运算时用 `signed` 声明，本章不展开。

## 12. VHDL 与 Verilog 对照表

| VHDL | Verilog | 说明 |
|---|---|---|
| `entity` + `architecture` | `module ... endmodule` | Verilog 把端口与功能描述放在同一个模块中 |
| `signal` | `wire`（连线）或 `reg`（由 always 赋值） | 按驱动方式选择，不能直接照搬 |
| `variable :=` | 块内的 `reg` 配合阻塞 `=` | 变量在过程中立即更新，与阻塞赋值相似 |
| `process (...)` | `always @(...)` | 敏感表的意义相同；组合进程对应 `always @(*)` |
| `std_logic_vector(n-1 downto 0)` | `[n-1:0]` | 位宽声明；Verilog 的最高位写在左边，与 VHDL 一致 |
| `when ... else` | `?:` 条件运算符 | 组合的二选一或多选一 |
| `with ... select` | `case` | 按选择信号的值分支，VHDL 的 `others` 对应 Verilog 的 `default` |
| `<=`（信号赋值，组合） | `assign`（连续赋值） | 右边变化即更新 |
| `<=`（信号赋值，时序进程） | 非阻塞 `<=` | 时序逻辑中的更新；VHDL 信号赋值在进程结束时生效，与非阻塞相似 |
| `:=`（变量赋值） | 阻塞 `=` | 组合逻辑中的顺序计算 |
| `component` + `port map` | 模块例化 `模块名 实例名 (.端口(信号))` | 命名端口连接对应 `port map (端口 => 信号)` |
| `generic` | `parameter` | 参数化设计 |
| `rising_edge(clk)` | `posedge clk` | 上升沿触发 |

### 12.1 对照示例一：2 选 1 MUX（when-else ↔ ?:）

VHDL：

```vhdl
-- 2 选 1 数据选择器
entity mux2 is
    port (
        a, b, sel : in  std_logic;
        y         : out std_logic
    );
end entity mux2;

architecture rtl of mux2 is
begin
    y <= b when sel = '1' else a;   -- sel 为 1 时 y 取 b，否则取 a
end architecture rtl;
```

Verilog：

```verilog
// 2 选 1 数据选择器
module mux2 (
    input  wire a,
    input  wire b,
    input  wire sel,
    output wire y
);
    assign y = sel ? b : a;   // sel 为 1 时 y 取 b，否则取 a
endmodule
```

预期行为：两者功能相同，sel=1 时 y=b，sel=0 时 y=a。

### 12.2 对照示例二：4 选 1（with-select ↔ case）

VHDL：

```vhdl
-- 4 选 1，由 sel 选择 d0～d3
with sel select
    y <= d0 when "00",
         d1 when "01",
         d2 when "10",
         d3 when others;
```

Verilog：

```verilog
// 4 选 1，由 sel 选择 d0～d3
always @(*) begin
    case (sel)
        2'b00:   y = d0;
        2'b01:   y = d1;
        2'b10:   y = d2;
        default: y = d3;   // 对应 VHDL 的 when others
    endcase
end
```

预期行为：sel 取 00、01、10 时分别输出 d0、d1、d2，其余取值（即 11）输出 d3。两者都是组合逻辑，且都覆盖了全部取值，不会推断锁存器。

### 12.3 对照示例三：异步复位计数器（process ↔ always）

VHDL：

```vhdl
-- 4 位加法计数器，异步复位
-- 需要：library ieee; use ieee.std_logic_1164.all; use ieee.numeric_std.all;
process (clk, rst_n)
begin
    if rst_n = '0' then
        q <= (others => '0');
    elsif rising_edge(clk) then
        q <= q + 1;
    end if;
end process;
```

Verilog：

```verilog
// 4 位加法计数器，异步复位
always @(posedge clk or negedge rst_n) begin
    if (!rst_n)
        q <= 4'd0;
    else
        q <= q + 4'd1;
end
```

预期行为：rst_n 为低时 q 立即清零；之后每个上升沿 q 加 1。VHDL 中 `q` 通常声明为 `unsigned`（`numeric_std`）才能直接做加法；Verilog 中 `q` 是无符号的 `reg`，直接加即可。

### 12.4 对照要点

- VHDL 的 `process` 敏感表 `(clk, rst_n)` 与 Verilog 的 `@(posedge clk or negedge rst_n)` 含义一致。
- VHDL 的 `others => '0'` 相当于 Verilog 中把所有位清零（如 `4'd0`）。
- VHDL 的 `std_logic` 有 `'U'`、`'X'`、`'Z'` 等取值，Verilog 的 `wire` 与 `reg` 只有 `0`、`1`、`x`、`z`，两者的未知值表示相近但不完全相同。
