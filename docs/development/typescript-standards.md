# TypeScript 编码规范

## 类型设计

- 保持 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitReturns` 等仓库编译选项开启；禁止用局部配置规避错误；
- 禁止显式 `any`、`@ts-ignore` 和无说明的 non-null assertion；不可信数据使用 `unknown`，经 Schema 或类型守卫收窄；
- 类型表达业务不变量：状态使用判别联合，ID/时间/金额等不可互换值使用品牌类型或值对象；
- `optional?: T` 表示字段可以缺席，`T | undefined` 表示字段存在但值可空；开启 exact optional 后不得混用两种语义；
- 优先字面量联合、`as const` 和 `satisfies`，不使用 TypeScript `enum`；避免宽泛的 `string` 代替有限状态；
- 公共输入使用 `Readonly`/`readonly`；函数不得悄悄修改调用方传入的对象或数组；
- 从 Zod Schema 推导跨边界类型；不要手写一份容易漂移的平行 DTO。

## 函数与控制流

- 公共函数、端口方法和导出回调显式声明参数及返回类型；局部简单函数允许推断；
- 函数保持单一职责；参数超过 3 个或多个参数语义相近时使用具名参数对象；
- 用 guard clause 处理失败和边界，减少深层嵌套；复杂分支提取为有业务含义的函数；
- `switch` 对判别联合必须穷尽，遗漏分支交给 `assertNever`；禁止依赖隐式 fallthrough；
- 不用布尔参数切换截然不同的行为，改用具名选项或不同函数；
- 默认参数只用于真正稳定且无副作用的默认值，不隐藏权限、超时或持久化策略。

## null、错误与断言

- 领域中区分“未找到”“未设置”“加载失败”；不要把它们都压成 `null` 或空字符串；
- 边界层解析后再断言，类型断言只能用于编译器无法表达但已由运行时保证的窄范围位置，并附原因；
- 只抛 `Error` 子类，不抛字符串或普通对象；catch 变量按 `unknown` 处理；
- `Result` 与 exception 不混用表达同一层失败：预期业务失败使用稳定错误/Result，程序错误抛出；
- 禁止空 catch；捕获后必须恢复、映射、记录允许字段或重新抛出。

## 异步代码

- Promise 必须 `await`、`return` 或显式 `void`；`void` 仅用于有内部错误处理的事件入口；
- 独立任务可 `Promise.all`，有顺序、资源竞争或事务关系的任务必须显式串行；
- 外部 IO 和长任务接受 `AbortSignal` 并设置超时；使用 `try/finally` 释放资源；
- 不用 `new Promise` 包装已有 Promise API，不以 `setTimeout` 规避竞态；
- 回调和订阅要定义唯一终态，防止完成、取消和失败重复结算。

## 导入、导出与命名

- 纯类型使用 `import type`；使用 ESM 和 `node:` 前缀导入 Node 内置模块；
- 按包公共入口导入，不跨 workspace 深层引用；避免循环依赖和仅为缩短路径建立 barrel；
- 默认使用具名导出，便于重构与搜索；默认导出仅用于工具链明确要求的入口；
- 变量/函数 camelCase，类型/类/组件 PascalCase，常量 UPPER_SNAKE_CASE；boolean 使用 `is/has/can/should/did` 前缀；
- 集合使用复数名，单位进入名称，如 `timeoutMs`、`sizeBytes`；事件用过去式，如 `message.completed`。

## 对象与集合

- 优先不可变更新和 `map`/`filter` 等清晰操作；性能热点允许局部可变，但不得跨边界暴露；
- 使用 `Map`/`Set` 表达键值和唯一性，不用普通对象模拟所有集合；来自外部的 key 不直接写入普通对象；
- 排序函数返回稳定数值并处理相等；不要依赖数据库或对象键的隐式顺序；
- 日期在领域内使用 `Date` 或明确值对象，跨 IPC/DB 使用 UTC ISO-8601；禁止无时区日期字符串。

## 禁止模式

- 以 `as unknown as T`、大范围类型断言或关闭 lint 代替建模；
- 用魔法字符串、魔法数字和复制的联合类型表达公共协议；
- 导出可变单例作为业务状态；
- 在 Domain/Application 读取环境变量、系统时间或随机数；这些能力通过端口注入；
- 为复用几行代码创建无语义的 `utils.ts` 或过度泛型抽象。
