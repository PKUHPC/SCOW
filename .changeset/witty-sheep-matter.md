---
"@scow/cli": patch
---

cli 如果配置了 fluentd，添加 fluentd 的健康检查，且所有容器等待 fluentd 启动后再启动。修复在高版本docker使用cli启动系统时，如果配置了fluentd，其他容器无法正常启动的问题
