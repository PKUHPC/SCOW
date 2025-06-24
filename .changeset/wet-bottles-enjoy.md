---
"@scow/grpc-api": minor
---

在 proto/server 下增加授权交互式应用的 proto 文件 app_authorization,
在 proto/portal 下对 listAvailableApps 中增加可选查询参数 user_id 获取用户可用应用列表,
在 proto/audit 中增加授权交互式应用日志的相关 message
