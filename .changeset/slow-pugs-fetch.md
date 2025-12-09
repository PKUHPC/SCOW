---
"@scow/mis-server": patch
"@scow/mis-web": patch
---

发现没有拥有者的账户时在页面不抛出错误，需要显示拥有者时兼容显示为 -  
修改 AccountBill 实体，让拥有者ID及姓名可以为空
