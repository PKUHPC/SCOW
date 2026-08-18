---
"@scow/config": major
"@scow/grpc-api": major
"@scow/protos": major
"@scow/lib-server": major
"@scow/lib-web": major
"@scow/lib-scowd": major
"@scow/cli": patch
"@scow/portal-server": patch
"@scow/portal-web": patch
"@scow/mis-server": patch
"@scow/mis-web": patch
"@scow/ai": patch
---

将 scowd 调整为所有集群必需的基础服务，移除集群级启停状态，要求每个集群至少配置一个登录节点，并要求为每个登录节点配置有效的 scowd 端口。
