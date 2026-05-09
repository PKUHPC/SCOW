---
"@scow/gateway": patch
"@scow/cli": patch
"@scow/docs": patch
"@scow/auth": patch
"@scow/ai": patch
"@scow/quantum": patch
"@scow/mis-web": patch
---

install.yaml 新增`novnc`配置，在顶层指定 novncClientImage, 优先级高于 portal 中所指定的 novncClientImage
详细内容参考文档 /docs/deploy/config/novnc/config

重构 novnc 服务启动逻辑，在 AI 或者 PORTAL 任一服务已配置时启动

完善关于根路径访问的文档说明 /docs/deploy/config/customization/basepath
