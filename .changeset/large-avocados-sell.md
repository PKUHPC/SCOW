---
"@scow/scowd-protos": minor
---

在 scowd proto 中增加 shareFileOrDir 接口，copy 接口中增加 mode 及 chmod_recursive 的可选参数
以保证数据资产的分享及复制的相关操作在scow与scowd之间维持原子性
