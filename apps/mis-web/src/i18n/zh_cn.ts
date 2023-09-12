/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

export default {
  dashboard: {
    title: "仪表盘",
    account: {
      title: "账户信息",
      state: "状态",
      balance: "可用余额",
      status: {
        blocked: "封锁",
        normal: "正常",
      },
      alert: "您不属于任何一个账户。",
    },

    job: {
      title: "未结束作业列表",
      extra: "查看所有未结束作业",
      jobTable: {
        cluster: "集群",
        jobId: "作业ID",
        account: "账户",
        name: "作业名",
        partition: "分区",
        qos: "QOS",
        nodes: "节点数",
        cores: "核心数",
        state: "状态",
        time: "运行/排队时间",
        reason: "说明",
        limit: "作业时间限制",
        others: "更多",
      },
      none: "暂无数据",
    },
  },

  footer: "Powered by SCOW",

  runningJob: {
    title: "本用户未结束的作业",
    search: {
      batch: "批量搜索",
      precision: "精确搜索",
      cluster: "集群",
      account: "账户",
      clusterJobId: "集群作业ID",
      button: {
        search: "搜索",
        refresh: "刷新",
        changeLimit: "延长所选作业时间限制",
      },
    },
    jobTable: {
      cluster: "集群",
      jobId: "作业",
      account: "账户",
      name: "作业名",
      partition: "分区",
      qos: "QOS",
      nodes: "节点数",
      cores: "核心数",
      state: "状态",
      time: "运行/排队时间",
      reason: "说明",
      limit: "作业时间限制",
      others: "更多",
      user: "用户",
      details: "详情",
      changeLimit: "修改作业时限",
      gpus: "GPU卡数",
    },
  },
  layouts: {
    route: {
      common:{
        operationLog:"操作日志",
      },
      navLinkText: "门户",
      dashboard: "仪表盘",
      user: {
        firstNav: "用户空间",
        runningJobs: "未结束的作业",
        finishedJobs: "已结束的作业",
        clusterPartitions: "集群和分区信息",
      },
      platformManagement: {
        fistNav: "平台管理",
        info: "平台信息",
        importUsers: "导入用户",
        tenantsManagement:"租户管理",
        tenantsList: "租户列表",
        createTenant: "创建租户",
        usersList: "用户列表",
        jobBillingTable: "作业价格表",
        financeManagement: "财务管理",
        tenantPay: "租户充值",
        payments: "充值记录",
        systemDebug: "平台调试",
        statusSynchronization: "封锁状态同步",
        jobSynchronization: "作业信息同步",
        accountList: "账户列表",
      },
      tenantManagement: {
        firstNav: "租户管理",
        info: "租户信息",
        manageJobPrice: "作业价格表",
        runningJobs: "未结束的作业",
        finishedJobs: "已结束的作业",
        userManagement: "用户管理",
        userList: "用户列表",
        createUser: "创建用户",
        jobTimeLimit: "调整作业时间限制",
        storage: "调整用户存储空间",
        accountManagement: "账户管理",
        accountList: "账户列表",
        createAccount: "创建账户",
        whitelist: "账户白名单",
        financeManagement: "财务管理",
        accountPay: "账户充值",
        financePayments: "充值记录",
        accountPayments: "账户充值记录",
      },
      accountManagement: {
        firstNav:"账户管理",
        info: "账户信息",
        runningJobs: "未结束的作业",
        finishedJobs: "已结束的作业",
        userManagement: "用户管理",
        pay: "充值记录",
        cost: "消费记录",
      },
    },
  },
  pageComp:{
    common:{
      userCount:"用户数量",
      balance:"余额",
      createTime:"创建时间",
      search:"搜索",
      operation:"操作",
      tenant:"租户",
      tenantName:"租户名",
      userId:"用户Id",
      userName:"用户名",
      import:"导入",
      fresh:"刷新",
      account:"账户",
      accountName:"账户名",
      owner:"拥有者",
      selectTenant:"请选择租户",
      selectAccount:"请选择账户",
      amount:"金额",
      unit:"元",
      comment:"备注",
      submit:"提交",
      time:"时间",
      type:"类型",
    },
    accounts:{
      accountTable:{
        allAccount:"所有账户",
        debtAccount:"欠费账户",
        blockedAccount: "封锁账户",
        account:"账户",
        accountName:"账户名",
        owner:"拥有者",
        tenant:"租户",
        comment:"备注",
        status:"状态",
        mangerMember:"管理成员",
        block:"封锁",
        normal:"正常",
        unit:" 元",
      },
    },
    admin:{
      allTenantsTable:{
        tenantName:"租户名",
        accountCount:"账户数量",
      },
      allUserTable:{
        allUsers:"所有用户",
        platformAdmin:"平台管理员",
        platformFinance:"财务人员",
        idOrName:"用户ID或者姓名",
        userId:"用户ID",
        name:"姓名",
        tenant:"所属租户",
        availableAccounts:"可用账户",
        roles:"平台角色",
        notExist:"用户不存在",
        notAvailable:"本功能在当前配置下不可用",
        success:"本功能在当前配置下不可用",
        fail:"本功能在当前配置下不可用",
        changePassword:"修改密码",
      },
      createTenantForm:{
        prompt:"请输入租户名并为其创建一个新用户作为该租户的管理员",
        adminInfo:"管理员信息",
        userEmail:"用户邮箱",
        userPassword:"用户密码",
        confirmPassword:"确认密码",
      },
      ImportUsersTable:{
        selectAccount:"请选择账户！",
        specifyOwner:"请为每个账户指定拥有者",
        incorrectFormat:"数据格式不正确",
        importSuccess:"导入成功",
        selectCluster:"选择集群，以账户为单位导入到默认租户中",
        alreadyExist:"账户已经存在于SCOW中",
        notExist:"账户不存在于SCOW中，将会导入SCOW",
        partNotExist:"账户中部分用户不存在于SCOW中，将会导入新的用户",
        selectOwner:"请选择一个拥有者",
        importStatus:"导入状态",
        alreadyImport:"已导入",
        partImport:"账户已导入，部分用户未导入",
        notImport:"未导入",
        userList:"用户列表",
        addWhitelist:"将所有账户加入白名单",
      },
      tenantChargeForm:{
        loadType:"正在加载使用过的类型……",
        charging:"充值中……",
        accountNotFound:"账户未找到",
        chargeFinish:"充值完成！",
      },
      paymentTable:{
        total:"总数",
        sum:"合计",
        paymentDate:"交费日期",
        paymentAmount:"交费日期",
        ipAddress:"IP地址",
        operatorId:"操作者Id",
      },
    },
  },
};
