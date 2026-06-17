# 在开发环境下连接SDP集群

在SDP上启动集群，并将SDP集群的配置同步到本地`config.local`目录。这个目录被ignored掉了，不会被提交到仓库中。

```
rsync -avz --delete root@${scowIP}:/root/scow/config/ dev/vagrant/config.local/
```

访问以下URL以访问各个组件

| URL                   | 组件                             | 类型 |
| --------------------- | -------------------------------- | ---- |
| http://localhost:5000 | 认证系统                         | HTTP |
| http://localhost:5001 | 门户前端                         | HTTP |
| http://localhost:5002 | 门户后端                         | gRPC |
| http://localhost:5003 | 管理前端（无/mis前缀）           | HTTP |
| http://localhost:5004 | 管理后端                         | gRPC |
| http://localhost:5005 | 审计系统                         | gRPC |
| http://localhost:5080 | 本地 gateway，用于 scowctl       | HTTP |
| http://localhost:3890 | 一个phpLDAPadmin，可用于管理LDAP | HTTP |

使用[pm2](https://pm2.keymetrics.io/)在本地启动多个开发用进程。

自动更新行为：

- 修改libs下的项目，项目会自动重新重新编译
- 对于Next.js项目，修改项目本身或者它依赖的项目，都会更新next.js项目，无需手动重启
- 对于纯node.js项目，修改项目本身会自动更新，但是修改它依赖的其他项目不会自动更新，需手动重启服务

本地 gateway 只用于把 scowctl 请求转发到 pm2 启动的本地服务，不改变各组件原来的直连入口。可使用静态 API token 登录：

```bash
go run apps/scowctl/main.go login http://localhost:5080 --auth-secret secretapiauthtoken --auth-user <本地用户ID>
```

常用命令（和docker compose差不多）

```bash
# 重启某个服务，服务名查看dev/vagrant/pm2.config.js，和compose中的服务名保持一致
npx pm2 restart portal-web

# 查看某个服务的log，加-f为一直查看最新的log
npx pm2 logs portal-web

# 停止所有服务
npx pm2 stop dev/vagrant/pm2.config.js
```
