# @scow/lib-auth

## 1.0.1

### Patch Changes

- 7c96613: 修改更名后的链接地址和文档描述

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
