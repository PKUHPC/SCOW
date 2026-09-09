---
"@scow/scow-adapters": patch
---

修复 AI 和 crane-ai 开发机脚本在镜像缺少 pip 命令时的依赖安装问题：统一使用当前 Python 解释器执行 pip，并增加 ensurepip 和系统包管理器回退。
