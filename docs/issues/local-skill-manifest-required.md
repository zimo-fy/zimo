# 本地 Skill 被强制要求 manifest.json

状态：已修复

日期：2026-09-09

## 现象与影响

用户在 Skill 页面选择只有 `SKILL.md` 的常见 Skill 文件夹时，安装立即返回“Skill 包缺少 manifest.json”。这使大量符合通用 Skill 目录习惯的 instruction Skill 无法导入。

## 根因

本地 `LocalInstructionSkillPackageReader` 沿用早期 ADR 0008 的 Zimo 自定义包格式，在读取指令前把根目录 `manifest.json` 作为必需普通文件，并对整个对象执行 strict Schema。远程 Skill Store 已由目录接口提供元数据，只要求 ZIP 中存在唯一 `SKILL.md`，两个入口因而不一致。

## 修复

- 本地安装现在只强制包根目录存在非空普通文件 `SKILL.md`；
- `manifest.json` 改为可选、非阻断、尽力读取的元数据来源；无效 JSON、缺失字段和未知字段均忽略；
- 元数据按 manifest → `SKILL.md` frontmatter → 一级标题/文件夹名回退；默认版本 `1.0.0`、分类“本地”、空标签和最小上下文权限；
- 无 package ID 时使用本地目录的 SHA-256 摘要生成稳定 ID，数据库和 Renderer 不保存原始路径；
- manifest 中的命令、脚本入口、依赖或 Hook 不会被解释或执行。

## 保留的安全校验

`SKILL.md` 仍限制为 256 KiB、非空、根目录普通文件且不得越界。全包仍拒绝符号链接和非普通文件，限制单文件 5 MiB、总计 20 MiB、最多 500 个文件。运行时仍只枚举 `.py/.js/.mjs/.cjs`，不执行 Shell、安装 Hook 或依赖安装。

## 回归覆盖

Adapter 测试覆盖只有带 frontmatter 的 `SKILL.md` 可安装、默认元数据生成、畸形/未知 manifest 不阻断，以及原有路径逃逸和运行脚本白名单继续生效。

## 限制

自动 package ID 与所选目录绑定；将同一 Skill 移到另一个目录再安装会被视为新的本地包。有明确跨目录升级需求时，应在 `SKILL.md` frontmatter 中提供符合规则的 `packageId`。
