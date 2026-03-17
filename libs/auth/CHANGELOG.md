# @scow/lib-auth

## 1.0.4

### Patch Changes

- e76e039: 账户管理-用户管理、平台与租户的用户列表、平台-用户登录解封增加用户 ID 和姓名筛选。修改了 getLockedUsers 接口，文档位于 docs/integration/auth/impl#get-lockusergetlockedusers。

## 1.0.3

### Patch Changes

- 7482019: 登录功能增强：一、支持在用户初次登录、密码重置后登录系统时的强制变更密码功能。二、当用户身份鉴别尝试失败次数达到设定的次数后（可自定义），对该用户进行锁定，并且只能由管理员恢复。

## 1.0.2

### Patch Changes

- 1730b01: 修复部分 HttpError 的状态码判断为字符串导致前端无法正常展示错误的问题

## 1.0.1

### Patch Changes

- 6c6f8c6: 新增删除用户账户功能以及用户账户的删除状态带来的其他相关接口与测试文件完善

## 1.0.0

### Major Changes

- 11f94f716: 发布 1.0

## 0.3.0

### Minor Changes

- 113e1e4ea: 在 auth 中添加了一个新的 capability 叫 checkPassword，用于检验密码。原先的修改密码 changePassword 不再需要旧密码

### Patch Changes

- 572530a01: mis-web 用户修改邮箱,用户原邮箱直接展示且不可修改，用户填写符合规则的新邮箱后即可直接修改邮箱。

## 0.2.1

### Patch Changes

- 4bfd80986: 认证系统增加管理用户账户关系相关 API

## 0.2.0

### Minor Changes

- c2a8ab7a5: 删除认证系统验证用户姓名的 API，通过认证系统获取用户姓名和管理系统数据库实现
- bb9d9bb8b: 认证系统 GET /user API 增加返回用户姓名和邮箱
- 215ac2fc7: 认证系统 GET /validateToken 改为 GET /public/validateToken
