---
"@scow/ai": patch
---

删除写入 tensorBoard_entry.sh 的逻辑，提交训练作业时只向适配器传递 tensorBoard 运行时 URL 前缀
