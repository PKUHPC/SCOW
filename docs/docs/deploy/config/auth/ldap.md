---
sidebar_position: 3
title: LDAP 
---

# LDAP认证系统

本节介绍使用内置认证系统并使用LDAP进行用户认证。

LDAP认证系统支持的功能如下表：

| 功能             | 是否支持                 |
| ---------------- | ------------------------ |
| 用户登录         | 是                       |
| 获取用户信息     | 是                       |
| 用户创建         | 如果配置了相关配置即支持 |
| 用户名和姓名验证 | 是                       |
| 修改密码         | 是                       |
| 管理用户账户关系 | 否                       |
| 用户删除         | 如果配置了相关配置即支持 |

## LDAP认证要求和流程

为了更好的理解并配置LDAP认证系统，本节将介绍各个操作时，LDAP认证系统所进行的操作。请确认您的LDAP配置兼容这里所称的流程

下文中，代码块（如`ldap.bindDn`）为配置文件`config/auth.yml`中的对应值。

### 使用LDAP登录集群

要使用LDAP进行SCOW系统的用户认证，您必须配置LDAP服务器和集群中的每个节点，使得集群中的任何节点都可以使用LDAP用户节点的`ldap.attrs.uid`对应的属性的值和密码作为用户名和密码登录。请参考[client.sh](%REPO_FILE_URL%/dev/ldap/client.sh)配置使用LDAP服务器登录Linux节点。

### 登录

当用户登录时，认证系统获得用户输入的用户名和密码，进行以下操作：

1. 使用`ldap.bindDn`和`ldap.bindPassword`作为用户名和密码，向LDAP服务器所在的`ldap.url`发起bind请求
2. bind成功后，以`ldap.searchBase`为搜索根，以sub模式，以`ldap.filter` && (`ldap.attrs.uid`等于输入的用户名) 为筛选条件搜索节点
   1. 如果搜索结果为空，则登录失败
   2. 如果搜索节点有多个，取第一个结果
3. 以**上一个结果的DN**以及**输入的密码**作为用户名和密码，与LDAP服务器发起bind请求
   1. 如果bind失败，则登录失败
4. 登录成功。生成一个UUID作为token，将token与**输入的用户名**存入redis
5. 重定向到用户在登录时，通过querystring指定的callback URL，并传入`token={token}`作为querystring参数

### 创建用户

系统会对每个新用户创建一个新的LDAP节点表示用户，并支持同时创建一个LDAP节点表示用户的组。

当用户在管理系统中创建后，认证系统获得新用户的用户名、用户姓名、密码和邮箱，进行以下操作

1. 使用`ldap.bindDn`和`ldap.bindPassword`作为用户名和密码与向LDAP服务器所在的`ldap.url`发起bind请求
2. 创建一个新的entry作为用户，其DN以及属性值如下表所示

表中`??`表示如果前面的配置值设置了，就采用前面的值，如果没有设置，则采用后面的值。

| 属性名                               | 值                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| DN                                   | `{ldap.addUser.userIdDnKey ?? ldap.attrs.uid}=用户名,{ldap.addUser.userBase}`                                                               |
| `ldap.attrs.uid`                     | 用户名                                                                                                                                      |
| sn                                   | 用户名                                                                                                                                      |
| loginShell                           | /bin/bash                                                                                                                                   |
| objectClass                          | ["inetOrgPerson", "posixAccount", "shadowAccount"]                                                                                          |
| homeDirectory                        | `ldap.addUser.homeDir`，其中的`{{ username }}`替换为用户名                                                                                  |
| uidNumber                            | 数据库中的用户项的id + `ldap.addUser.uidStart`                                                                                              |
| gidNumber                            | 取决于`ldap.groupStrategy`，见下文                                                                                                          |
| `ldap.attrs.name`（如果设置了）      | 用户姓名                                                                                                                                    |
| `ldap.attrs.mail`（如果设置了）      | 用户的邮箱                                                                                                                                  |
| `ldap.addUser.extraProps`中的每个key | key对应的值，对应的值可以为字符串、字符串列表或者`null`。字符串或者字符串列表中的每一项其中的`{{ key }}`替换为`key`本节点的对应的属性的值。 |

如果`ldap.addUser.extraProps`中包括已经存在的属性名，则会替换对应的属性。如果这里面某个值为`null`，则会删除对应的属性。

3. 配置新用户所属的组。

如果`ldap.addUser.groupStrategy`设置为`oneGroupForAllUsers`，则新用户的`gidNumber`为`ldap.addUser.oneGroupForAllUsers.gidNumber`的值，且不会新建新的表示组的LDAP节点。

如果`ldap.addUser.groupStrategy`设置为`newGroupPerUser`，则新用户的`gidNumber`的值等于用户的uidNumber，并且会创建一个新的LDAP节点作为新用户的group，其DN以及属性值如下表所示。

| 属性名                                               | 值                                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| DN                                                   | `{ldap.newGroupPerUser.groupIdDnKey ?? ldap.attrs.userId}=用户名,{ldap.addUser.newGroupPerUser.groupBase}`                                  |
| objectClass                                          | ["posixGroup"]                                                                                                                              |
| memberUid                                            | 用户名                                                                                                                                      |
| gidNumber                                            | 同用户的uidNumber                                                                                                                           |
| `ldap.addUser.newGroupPerUser.extraProps`中的每个key | key对应的值，对应的值可以为字符串、字符串列表或者`null`。字符串或者字符串列表中的每一项其中的`{{ key }}`替换为`key`本节点的对应的属性的值。 |

如果`ldap.addUser.newGroupPerUser.extraProps`中包括已经存在的属性名，则会替换对应的属性。如果这里面某个值为`null`，则会删除对应的属性。

4. 设置新用户的密码为用户输入的密码

### 删除用户

本系统仅支持ldap删除用户，实现方法为禁止shell登录，即修改用户的loginShell属性为/sbin/nologin。

## 配置LDAP认证服务

在`config/auth.yml`中输入以下内容，并根据情况配置。

```yaml title="config/auth.yml"
# 指定使用认证类型为LDAP
authType: ldap

# 在此部分输入LDAP的配置
ldap:
  # LDAP服务器地址。必填
  url: ldap://LDAP服务器地址

  # 进行LDAP操作的用户DN。默认为空
  # bindDN: ""
  # 进行LDAP操作的用户密码。默认为空
  # bindPassword: ""

  # 在哪个节点下搜索要登录的用户。必填。
  searchBase: ""
  # 搜索登录用户时的筛选器。必填
  userFilter: "(uid=*)"

  # 属性映射
  attrs:
    # LDAP中对应用户ID的属性名
    uid: uid

    # LDAP对应用户姓名的属性名
    # 此字段用于
    # 1. 登录时显示为用户的姓名
    # 2. 创建用户的时候把姓名信息填入LDAP
    # 3. 管理系统添加用户时，验证ID和姓名是否匹配
    #
    # 如果不设置此字段，那么
    # 1. 用户显示的姓名为用户的ID
    # 2. 创建用户时姓名信息填入LDAP
    # 3. 管理系统添加用户时，不验证ID与姓名是否匹配
    # name: cn

    # LDAP中对应用户的邮箱的属性名。可不填。此字段只用于在创建用户的时候把邮件信息填入LDAP。
    # mail: mail

    # LDAP中指定用户在Unix/Linux系统上的shell的属性名。可不填。用于判断用户是否被禁止登录。
    # loginShell: loginShell

  # 添加用户的相关配置。可不填，不填的话SCOW不支持创建用户。
  addUser:
    # 增加用户节点时，把用户增加到哪个节点下
    userBase: "ou=People,ou={ou},o={dn}"

    # 用户的homeDirectory值。使用{{ userId }}代替新用户的用户名。默认如下
    homeDir: /nfs/{{ userId }}

    # LDAP增加用户时，新用户节点的DN中，第一个路径的属性的key。
    # 新用户节点的DN为{userIdDnKey}={用户ID},{userBase}
    # 如果不填写，则使用ldap.attrs.uid的值
    # userIdDnKey: uid

    # 如何确定新用户的组。可取的值包括：
    # newGroupPerUser: 给每个用户创建新的组
    # oneGroupForAllUsers: 不创建新的组，给所有用户设定一个固定的组
    groupStrategy: newGroupPerUser

    newGroupPerUser:
      # 用户对应的新组应该加在哪个节点下
      groupBase: "ou=Group,ou={ou},o={dn}"

      # 新的组节点的DN中，第一个路径的属性的key。
      # 新的组节点的DN为{groupIdDnKey}={用户ID},{groupBase}
      # 如果不填写，则使用ldap.attrs.uid的值
      # groupIdDnKey: uid

      # 组的节点应该额外拥有的属性值。可以使用 {{ 用户节点的属性key }}来使用用户节点的属性值
      # extraProps:
      #   greetings: hello this is group {{ userId }}

    # 如果groupStrategy设置为oneGroupForAllUsers，那么必须设置此属性
    oneGroupForAllUsers:
      # 用户的gidNumber属性的值
      gidNumber: 5000

    # 是否应该把新用户加到哪个LDAP组下。如果不填，则不加
    # addUserToLdapGroup: group

    # uid从多少开始。生成的用户的uid等于此值加上用户账户中创建的用户ID
    # 默认如下
    # uidStart: 66000

    # 用户项除了id、name和mail，还应该添加哪些属性。类型是个dict
    # 如果这里出现了名为uid, name或email的属性，这里的值将替代用户输入的值。
    # 属性值支持使用 {{ LDAP属性值key }} 格式来使用用户填入的值。
    # 例如：sn: "{{ cn }}"，那么添加时将会增加一个sn属性，其值为cn的属性，即为用户输入的姓名
    # extraProps: 
    #   key: value
  # 删除用户的相关配置，选填，默认不开启。
  deleteUser:
    enabled: false
  #密码策略ppolicy模块配置
  ppolicy:
      #密码策略条目DN，默认所有用户或组使用此策略。配置后将改变所配置密码策略条目下的策略。
      defaultOlcPPolicyDn: "cn=default,ou=pwpolicies,o=pku"
      #账户被锁定后的持续时间（分钟），若设为 0 表示必须由管理员手动解锁‌。
      pwdLockoutDurationMinutes: 5000
      #允许用户连续输入错误密码的最大次数。
      pwdMaxFailures: 5
      #是否强制用户在首次登录或重置密码后修改密码。单独配置此项可以直接配置，无需加载ppolicy模块
      pwdMustChangeAtFirstLoginOrResetByAdmin: true
```

增加好配置后，运行`./cli compose restart`重启系统即可。

## LDAP快速配置脚本

我们提供以下两个脚本可以用来在**CentOS 7**环境快速安装和配置LDAP服务器

- [provider.sh](%REPO_FILE_URL%/dev/ldap/provider.sh): 用于配置LDAP服务器
- [client.sh](%REPO_FILE_URL%/dev/ldap/client.sh): 用于配置LDAP客户端

请下载这两个文件，修改两个文件开头部分的相关配置（`Start Configuratin Part`和`End Configuration Part`之间的变量），运行即可。

如果您使用provider.sh脚本配置您的服务器，您的LDAP相关配置为如下。其中`{变量}`替换为provider.sh中的对应变量值。

```yaml title="config/auth.yml"

# ...其他配置

authType: ldap
ldap:
  url: ldap://LDAP服务器地址
  bindDN: cn=Manager,ou={ou},o={dn}
  bindPassword: {adminPasswd}
  searchBase: "ou={ou},o={dn}"
  userFilter: "(uid=*)"
  addUser:
    userBase: "ou=People,ou={ou},o={dn}"
    userIdDnKey: uid
    # 把homeDir设置为共享存储上的用户的家路径
    homeDir: /nfs/{{ userId }} 

    groupStrategy: newGroupPerUser
    newGroupPerUser:
      groupBase: "ou=Group,ou={ou},o={dn}"
      groupIdDnKey: cn
  attrs:
    uid: uid
    name: cn
    mail: mail
    loginShell: loginShell
```

## LDAP镜像

您还可以使用我们提供的已经配置好的LDAP docker镜像进行体验。注意，此镜像仅用于测试和功能体验，请勿用于生产环境！

```bash
# 在整个项目的根目录构建镜像 
docker build -f dev/ldap/Dockerfile -t ldap .

# 启动镜像。服务在389端口监听。
# 管理员用户为cn=Manager,ou=hpc,o=pku，密码为admin
docker run -p 389:389 ldap
```

## LDAP密码策略模块ppolicy
PPolicy 是 OpenLDAP 内置的密码策略模块，用于实现细粒度的账户密码管理。如果您想要启用用户身份鉴别失败锁定用户等相关密码策略功能，则需要先加载ppolicy模块并配置相关参数:
1. 加载ppolicy模块并配置密码策略

```bash
# 首先进入LDAP服务内
# 加载ppolicy模块
cat << EOF | ldapadd -Y EXTERNAL -H ldapi:///
dn: cn=module{0},cn=config
changetype: modify
add: olcModuleLoad  // 添加模块加载属性
olcModuleLoad: ppolicy.la  // 指定加载密码策略模块，生效后需重启服务或重载配置‌
EOF

#查看模块相关信息
cat /etc/openldap/slapd.d/cn\=config/cn\=module\{0\}.ldif|grep ^olcModule

# 添加 objectClass 对象，增加额外属性和值
cat << EOF | ldapadd -Y EXTERNAL -H ldapi:///
dn: olcOverlay=ppolicy,olcDatabase={2}hdb,cn=config
changetype: add
objectClass: olcOverlayConfig  // 覆盖层配置的基类
objectClass: olcPPolicyConfig  // 密码策略（Password Policy）覆盖层的扩展类‌
olcOverlay: ppolicy // 启用 ppolicy 覆盖层模块，用于实现 LDAP 密码策略
olcPPolicyDefault: cn=default,ou=pwpolicies,o={dn}  // 指定默认密码策略条目的 DN（Distinguished Name），所有未明确关联策略的用户将应用此策略‌
EOF

# 在 pwpolicies 条目下创建密码策略组。
# cn=Manager,ou={ou},o={dn}为管理员dn，根据实际情况更改，如cn=Manager,ou=hpc,o=pku
cat << EOF | ldapadd -x -D "cn=Manager,ou={ou},o={dn}" -w admin -H ldap://localhost
dn: ou=pwpolicies,o={dn}
ou: pwpolicies
objectClass: organizationalUnit  // 定义条目的对象类
EOF

# 定义密码策略组默认密码规则，可以定义多个，例如一个默认，一个安全人员的密码策略
# 默认密码策略将对所有未分配策略的用户或组使用此策略
cat << EOF | ldapadd -x -D "cn=Manager,ou={ou},o={dn}" -w admin -H ldap://localhost
dn: cn=default,ou=pwpolicies,o={dn}
cn: default
objectClass: pwdPolicy
objectClass: person
pwdAttribute: userPassword
pwdLockout: TRUE
pwdMaxFailure: 3
pwdLockoutDuration: 0
sn: dummy value
EOF
```

2. 在ppolicy模块加载完成和初始化配置后，后续即可以在config/auth.yml配置文件中按需更改密码策略配置。

```yaml title="config/auth.yml"
ldap: 
  ppolicy:
      #密码策略条目DN，默认所有用户或组使用此策略。配置后将改变所配置密码策略条目下的策略。
      defaultOlcPPolicyDn: "cn=default,ou=pwpolicies,o={dn}"
      #账户被锁定后的持续时间（分钟），若设为 0 表示必须由管理员手动解锁‌。
      pwdLockoutDurationMinutes: 5000
      #允许用户连续输入错误密码的最大次数。
      pwdMaxFailures: 5
      #是否强制用户在首次登录或重置密码后修改密码。单独配置此项可以直接配置，无需加载ppolicy模块。
      pwdMustChangeAtFirstLoginOrResetByAdmin: true
```