---
name: pr-desc
description: 根据当前分支与指定基准分支的变更生成 PR 描述（markdown 格式）
---

请根据以下变更信息，生成一份 PR 描述，**只输出 markdown 内容，不要任何解释**。

## 分支信息

当前分支：`!`git rev-parse --abbrev-ref HEAD``

对比基准：`!`bash .claude/skills/pr-desc/run.sh base $ARGUMENTS``

## 提交记录

```
!`bash .claude/skills/pr-desc/run.sh log $ARGUMENTS`
```

## 变更文件

```
!`bash .claude/skills/pr-desc/run.sh stat $ARGUMENTS`
```

## Diff

```diff
!`bash .claude/skills/pr-desc/run.sh diff $ARGUMENTS`
```

---

请按以下格式输出 PR 描述。将完整内容包裹在一个 markdown 代码块中输出（即用 ```markdown 开头、``` 结尾包裹），方便用户复制粘贴到 GitHub。

格式规则：
- 标题使用 `type(scope): 描述` 格式，type 为 feat/fix/refactor/chore/docs，scope 为主要影响的 app 或 lib（如 notification、mis-server、config）
- Breaking Changes 区块：**仅当存在以下情况时才输出**：proto 字段变更、配置结构变更、接口签名变更、需要其他服务同步升级。否则省略该区块。
- Related Issues 区块：**仅当能从提交信息中识别到 issue 编号时才输出**，否则省略。
- Changes 区块按 `app/` 或 `libs/` 分组，每组用加粗标题标注。

## type(scope): 简洁描述

## Summary

- <核心变更要点，每条一行>

## Changes

**`apps/<name>`**
- <具体变更>

**`libs/<name>`**
- <具体变更>

## Breaking Changes

> 仅在有破坏性变更时输出此区块

- <需要其他服务/配置同步升级的内容>

## Related Issues

> 仅在能识别到 issue 编号时输出此区块

- #<issue-number>

## Test plan

- [ ] <测试项>
- [ ] <测试项>
