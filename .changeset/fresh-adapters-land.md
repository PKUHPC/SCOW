---
"@scow/scheduler-adapter-protos": minor
---

新增 scheduler adapter 的本地 proto 定义，覆盖 account、app、config、job、node、user、version 等服务接口。

同时将 generate 脚本改为直接基于仓库内 `./protos` 生成代码，便于与仓库内适配器实现保持同步迭代。
