---
"@scow/config": major
"@scow/cli": patch
"@scow/portal-server": patch
"@scow/mis-server": patch
"@scow/portal-web": patch
"@scow/mis-web": patch
"@scow/ai": patch
"@scow/quantum": patch
"@scow/meta-server": patch
"@scow/notification": patch
"@scow/resource": patch
"@scow/lib-notification": major
"@scow/lib-scow-resource": major
"@scow/lib-server": major
"@scow/lib-web": major
---

将管理、审计、资源管理和消息系统调整为始终启用的基础系统，系统级启停字段不再生效，删除相关运行时开关；移除 `allowAppAuthorization` 配置项，应用授权功能调整为始终启用；并要求配置至少 32 个字符的 SCOW API token。`scow-cli init` 现在会自动生成安全随机的 API token，并在覆盖初始化时安全保留符合长度要求的已有 token。
