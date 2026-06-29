---
"@scow/portal-server": patch
"@scow/portal-web": patch
"@scow/config": patch
"@scow/grpc-api": patch
---

交互式应用配置添加`ignoreGpu`配置，默认为 false。当添加了这个配置后，提交这个作业的时候所有分区都被认为为非 GPU 分区
