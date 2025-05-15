---
"@scow/auth": patch
"@scow/mis-web": patch
"@scow/lib-auth": patch
"@scow/lib-operation-log": patch
"@scow/protos": patch
---

登录功能增强：一、支持在用户初次登录、密码重置后登录系统时的强制变更密码功能。二、当用户身份鉴别尝试失败次数达到设定的次数后（可自定义），对该用户进行锁定，并且只能由管理员恢复。
