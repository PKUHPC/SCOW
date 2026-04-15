---
"@scow/gateway": patch
"@scow/cli": patch
"@scow/ai": patch
"@scow/docs": patch
---

CLI 支持按模块启用/禁用 portal,ai,mis,quantum 模块。

install.yaml 的`portal/mis/ai/quantum`新增`enabled`配置（默认为 true）
