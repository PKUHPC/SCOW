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
  common:{
    changeSuccess:"修改成功",
    changeFail:"修改失败",
    email:"邮箱",
    platform:"平台",
    userCount:"用户数量",
    balance:"余额",
    createTime:"创建时间",
    search:"搜索",
    operation:"操作",
    tenant:"租户",
    tenantName:"租户名",
    tenantFullName:"租户名称",
    tenantRole: "租户角色",
    user:"用户",
    userId:"用户ID",
    userName:"用户名",
    ownerIdOrName:"用户ID或姓名",
    userFullName:"用户姓名",
    import:"导入",
    fresh:"刷新",
    account:"账户",
    accountInfo: "账户信息",
    accountName:"账户名",
    owner:"拥有者",
    selectTenant:"请选择租户",
    selectAccount:"请选择账户",
    amount:"金额",
    unit:"元",
    comment:"备注",
    expirationTime:"有效期",
    submit:"提交",
    time:"时间",
    type:"类型",
    selectType: "请选择类型",
    total:"总数",
    sum:"合计",
    ok:"确认",
    prompt:"提示",
    role:"角色",
    add:"添加",
    modify:"修改",
    cancel:"取消",
    cluster:"集群",
    clusterName:"集群名",
    workId:"作业ID",
    minute:"分钟",
    name:"姓名",
    set:"设置",
    clusterWorkId:"集群作业ID",
    partition:"分区",
    workName:"作业名",
    timeSubmit:"提交时间",
    timeEnd:"结束时间",
    more:"更多",
    detail:"详情",
    price:"价格",
    status:"状态",
    changePassword: "修改密码",
    changeEmail: "修改邮箱",
    platformRole: "平台角色",
    illustrate: "说明",
    userInfo: "用户信息",
    loginPassword: "登录密码",
    historyJob: "历史作业",
    tenantInfo: "租户信息",
    admin: "管理员",
    accountCount: "账户数量",
    tenantBalance: "租户余额",
    defaultAccountBlockThreshold: "默认账户封锁阈值",
    jobBillingTable: "作业价格表",
    operationLog: "操作日志",
    unfinishedJob: "未结束的作业",
    finishedJobs: "已结束的作业",
    userList: "用户列表",
    platformInfo: "平台信息",
    platformAdmin: "平台管理员",
    platformFinancialStaff: "平台财务人员",
    tenantCount: "租户数量",
    accountList: "账户列表",
    tenantList: "租户列表",
    addFail: "添加失败",
    addSuccess: "添加成功",
    jobBilling: "作业计费",
    accountOwner: "账户拥有者",
    accountStatus: "账户状态",
    block: "封锁",
    accountBalance: "账户余额",
    normal: "正常",
    view: "查看",
    waitingMessage: "操作所需时间较长，请耐心等待",
    timeUnits: {
      minute: "分钟",
      hour: "小时",
      day: "天",
    },
    export: "导出",
    exportMaxDataErrorMsg: "导出明细过多，最多导出{}条，请重新选择!",
    exportNoDataErrorMsg: "导出为空，请重新选择",
    blockThresholdAmount: "封锁阈值",
    other: "其他",
    noAvailableClusters: "当前没有可用集群。"
    + "请稍后再试或联系管理员。",
  },
  dashboard: {
    title: "仪表盘",
    account: {
      title: "账户信息",
      state: "状态",
      balance: "可用额度",
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
  },
  layouts: {
    route: {
      common:{
        operationLog:"操作日志",
        statistic: "平台数据统计",
      },
      navLinkTextPortal: "超算平台",
      navLinkTextAI: "SCOW AI",
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
        accountChargeRecords: "账户消费记录",
        systemDebug: "平台调试",
        statusSynchronization: "封锁状态同步",
        jobSynchronization: "作业信息同步",
        resourceManagement: "资源管理",
        clusterManagement: "集群管理",
        accountList: "账户列表",
        clusterMonitor: "集群监控",
        resourceStatus: "资源状态",
        alarmLog: "告警日志",
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
        financePayments: "租户充值记录",
        accountPayments: "账户充值记录",
        accountChargeRecords: "账户消费记录",
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
    accounts:{
      accountTable:{
        allAccount:"所有账户",
        debtAccount:"欠费账户",
        blockedAccount: "封锁账户",
        frozenAccount: "冻结账户",
        normalAccount: "正常账户",
        account:"账户",
        accountName:"账户名",
        owner:"拥有者",
        ownerIdOrName: "拥有者ID或姓名",
        tenant:"租户",
        blockThresholdAmount: "封锁阈值",
        blockThresholdAmountTooltip: "当账户余额低于此值时，账户将被封锁",

        comment:"备注",
        expirationTime:"有效期",
        status:"状态",
        statusTooltip: "账户状态说明",
        statusFrozenTooltip: "冻结：账户已被账户管理员冻结，无法通过此账户提交作业",

        statusBlockedTooltip: "封锁：账户已被租户管理员或平台管理员封锁，无法通过此账户提交作业",

        statusDebtTooltip: "欠费：账户余额<=封锁阈值，无法通过此账户提交作业",

        statusNormalTooltip: "正常：账户没有被管理员封锁冻结且账户余额>封锁阈值；或者账户已存在于白名单中",

        mangerMember:"管理成员",
        blocked:"封锁",
        frozen:"冻结",
        debt: "欠费",
        normal:"正常",
        unit:" 元",
        unblockConfirmTitle: "确认解除用户封锁？",
        unblockConfirmContent: "确认要在租户{}中解除账户{}的封锁？",
        unblockSuccess: "解封账户成功！",
        unblockFail: "解封账户失败！",
        unblockError: "账户{}余额不足，您可以将其加入白名单或充值解封",

        block: "封锁",
        unblock: "解除封锁",
        blockConfirmTitle: "确认封锁账户？",
        blockConfirmContent: "确认要在租户{}中封锁账户{}",
        blockSuccess: "封锁帐户成功！",
        blockFail: "封锁帐户失败！",
      },
      setBlockThresholdAmountModal: {
        setSuccess:"设置成功",
        setFail: "设置失败",
        setAmount:"设置封锁阈值",
        blockThresholdAmount: "封锁阈值",
        curBlockThresholdAmount: "当前封锁阈值",
        curDefaultBlockThresholdAmount: "当前租户默认封锁阈值: ",
        useDefaultBlockThresholdAmount: "使用租户默认封锁阈值",
        confirmUseDefaultBlockThresholdAmount: "确认使用租户默认封锁阈值？",

      },
    },
    admin:{
      allAlarmLogsTable: {
        firing: "触发中",
        resolved: "已解决",
        serialNumber: "序号",
        fingerPrint: "指纹",
        status: "状态",
        alarmLevel: "告警级别",
        description: "描述",
        firingTime: "触发时间",
        resolvedTime: "处理时间",
      },
      allTenantsTable:{
        tenantName:"租户名称",
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
        success:"修改成功",
        fail:"修改失败",
        changePassword:"修改密码",
        changeTenant: "修改租户",
      },
      createTenantForm:{
        prompt:"请输入租户名并为其创建一个新用户作为该租户的管理员",
        adminInfo:"管理员信息",
        userEmail:"用户邮箱",
        userPassword:"用户密码",
        confirmPassword:"确认密码",
        userType: "用户类型",
        newUser: "新用户",
        existingUser: "已有用户",
        createTenantWarningInfo: "请确保该用户已经没有任何关联账户",
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
      statisticCard: {
        total: "总",
      },
      tenantChargeForm:{
        loadType:"正在加载使用过的类型……",
        charging:"充值中……",
        accountNotFound:"账户未找到",
        chargeFinish:"充值完成！",
      },
      changeTenantModal: {
        modifyTenant: "修改租户",
        newTenant: "新租户",
        originalTenant: "原租户",
        userName: "用户姓名",
        userId: "用户 ID",
        newTenantNameRequired: "请输入新租户",
        userNotFound: "用户不存在",
        tenantNotFound: "租户不存在",
        userStillMaintainsAccountRelationship: "该用户仍然含有账户关系",
        userAlreadyExistInThisTenant: "用户已经存在于该租户中",
        createTenantWarningInfo: "请确保该用户已经没有任何关联账户",
      },
    },
    commonComponent:{
      exportFileModal: {
        title: "导出数据",
        subTitle: "请选择需要导出的字段",
        errorMsg: "请至少选择一项进行导出",
      },
      paymentTable:{
        total:"总数",
        sum:"合计",
        paymentDate:"交费日期",
        paymentAmount:"交费金额",
        ipAddress:"IP地址",
        operatorId:"操作者ID",
        searchTypePlaceholder:"多个请用逗号隔开",
      },
    },
    dashboard:{
      storageCard:{
        storage:"存储",
        alreadyUsed:"已使用",
        totalLimited:"总限额",
        nowUsed:"获取当前使用量",
      },
      storageSection:{
        storageStatus:"存储状态",
      },
    },
    finance:{
      AccountSelector:{
        freshList:"刷新账户列表",
      },
      chargeForm:{
        loadType:"正在加载使用过的类型……",
        charging:"充值中……",
        notFound:"账户未找到",
        chargeFinished:"充值完成！",
      },
      chargeTable:{
        time:"扣费日期",
        amount:"扣费金额",
        ownerIdOrName:"用户ID或姓名",
      },
    },
    init:{
      initAdminForm:{
        alreadyExist:"用户已存在",
        cannotAdd:"用户已存在于SCOW数据库，无法再添加此用户",
        notExist:"用户不存在于认证系统",
        confirm:"用户不存在，请确认用户ID是否正确",
        existText:"用户已经在认证系统中存在，您此处输入的密码将会不起作用，新用户的密码将是认证系统中的已有用户的当前密码。确认添加为初始管理员？",


        notExistText:"用户不存在于认证系统，是否确认创建此用户并添加为初始管理员？",

        cannotConfirmText1:"无法确认用户是否在认证系统中存在， 将会尝试在认证系统中创建。如果用户已经在认证系统中存在，您此处输入的密码将会不起作用，新用户的密码将是认证系统中的已有用户的当前密码",



        cannotConfirmText2:`无法确认用户是否在认证系统中存在，并且当前认证系统不支持创建用户，请您确认此用户已经在认证系统中存在，
                            确认将会直接加入到数据库中, 并且您此处输入的密码将不会起作用，新用户的密码将是认证系统中的已有用户的当前密码。`,



        addFail:"添加失败",
        userExist:"此用户存在于scow数据库",
        addSuccess:"添加成功",
        addDb:"此用户存在于认证系统中，已成功添加到SCOW数据库",
        addFinish:"添加完成！",
        createFail:"创建用户失败",
        initAdmin:"您可以在此创建初始管理员用户。",
        addAdmin:"这里添加的用户为初始管理员，位于默认租户中，将会自动拥有",

        platFormAdmin:"平台管理员",
        and:"和",
        defaultTenant:"默认租户的租户管理员",
        createText1:"当前认证系统支持创建用户，您可以选择加入一个已存在于认证系统的用户，或者创建一个全新的用户。系统将会在认证系统中创建此用户",


        createText2:"当前认证系统不支持创建用户，请确认要添加的用户必须已经存在于认证系统，且用户的ID必须和认证系统中的用户ID保持一致",


      },
      initImportUsersTable:{
        importUser:"您可以在此导入已有用户。 查看",
        document:"此文档",
        learn:"了解系统用户模型以及如何导入用户信息。",
        useMore:"如果您使用SCOW管理多个集群，SCOW系统要求多个集群具有完全相同的用户账户信息，您只需要从一个集群中导入已有用户信息即可。",


      },
      initJobBillingTable:{
        set:"您可以在这里设置默认作业价格表。您必须全部设置完全部价格才能完成初始化。",

      },
      initLayout:{
        importUser:"导入用户",
        userManager:"用户账户管理",
        create:"创建初始管理员用户",
        edit:"编辑作业价格表",
        Incomplete:"价格表不完整",
        set:"请对每个作业计费项确定价格后再完成初始化。",
        confirm:"确认完成初始化",
        confirmText:"一旦完成初始化，您将无法进入此页面重新初始化。",
        finish:"初始化完成！",
        goLogin:"点击确认前往登录",
        init:"系统初始化",
        complete:"完成初始化",
      },
      initUsersAndAccountsTable:{
        platformRole:"平台角色",
        tenantRole:"租户角色",
        accountAffiliation:"所属账户",
        defaultTenant:"您可以在这里管理当前系统中默认租户下的用户和账户，以及设置某个用户为",

        initAdmin:"初始管理员",
        set:"指同时为租户管理员和平台管理员的用户。",
        idOrName: "用户ID或姓名",
      },
    },
    job:{
      ChangeJobTimeLimitModal:{
        currentTimeLimit: "当前作业时限",
        modifyLimit:"修改作业时限",
        success:"修改时限全部成功完成。",
        fail:"部分作业修改时限失败。",
        setLimit:"设置作业时限",
        modifyWork:"修改失败的作业",
        timeLimeError: "设置作业时限需要大于该作业的运行时长。",
        timeExplanation: "此处设置的时间为作业执行的总时间",
      },
      editableJobBillingTable:{
        alreadyUsed:"此ID已经被使用",
        addSuccess:"添加成功！",
        edit:"编辑作业价格项",
        defaultPrice:"默认价格项",
        path:"计费路径",
        id:"计费项ID",
        strategy:"计费策略",
        price:"价格（元）",
        name:"分区全名",
        nodes:"分区节点数",
        cores:"单节点核心数",
        gpus:"单节点GPU数",
        memory:"单节点内存（MB）",
        now:"当前计费项",
        unset:"未设置",
      },
      historyJobDrawer:{
        list:"使用节点列表",
        timeSubmit:"提交时间",
        timeStart:"开始时间",
        timeEnd:"结束时间",
        gpus:"使用GPU数（个）",
        cpusReq:"申请CPU数（个）",
        cpusAlloc:"分配CPU数（个）",
        memReq:"申请的内存（MB）",
        memAlloc:"分配的内存（MB）",
        nodesReq:"申请节点数（个）",
        nodesAlloc:"分配节点数（个）",
        timeLimit:"作业时间限制（分钟）",
        timeUsed:"作业执行时间（秒）",
        timeWait:"作业等待时间（秒）",
        recordTime:"记录时间",
        workFee:"作业计费（元）",
        tenantFee:"租户计费（元）",
        platformFee:"平台计费",
        detail:"作业详细信息",
      },
      historyJobTable:{
        noAuth:"您没有权限查看此信息。",
        batchSearch:"批量搜索",
        jobEndTime:"作业结束时间",
        precision:"精确搜索",
        platformPrice:"平台计费",
        tenantPrice:"租户计费",
        jobNumber:"作业数量",
      },
      jobBillingManagementTable:{
        priceId:"计费项ID",
        path:"计费路径",
        tenant:"所属租户",
      },
      manageJobBillingTable:{
        itemId:"计费价格编号",
        price:"单价（元）",
        abandon:"已作废",
        notExpanded:"收起历史计费项",
        expanded:"展开历史计费项",
        priceItem:"计费项",
        text:"集群, 分区, QOS共同组成一个计费项。对计费项可以设定计费方式和单价",

        executing:"执行中",
        unset:"未设置",
        alreadyUsed:"此ID已经被使用！",
        addSuccess:"添加成功！",
        setPrice:"设置计费价格",
        object:"对象",
        newItemId:"新计费价格编号",
      },
      runningJobDrawer:{
        nodes:"节点数（个）",
        cores:"核心数（个）",
        gpus:"GPU卡数（个）",
        nodesOrReason:"说明",
        runningOrQueueTime:"运行/排队时间",
        timeLimit:"作业时限（分钟）",
        detail:"未结束的作业详细信息",
      },
      runningJobTable:{
        extendLimit: "延长所选作业时间限制",
        batch: "批量搜索",
        precision: "精确搜索",
        nodes: "节点数",
        cores: "核心数",
        time: "运行/排队时间",
        reason: "说明",
        limit: "作业时间限制",
        changeLimit: "修改作业时限",
        gpus: "GPU卡数",
        finishJobButton: "结束",
        finishJobConfirm: "确定结束这个任务吗?",
        finishJobSuccess: "任务结束请求已经提交!",
      },
    },
    profile:{
      changeEmailFail:"修改邮箱失败",
      changeEmailSuccess:"邮箱更改成功！",
      changeEmail:"修改邮箱",
      oldEmail:"原邮箱",
      newEmail:"新邮箱",
      inputEmail:"请输入新邮箱",
      changePasswordSuccess:"密码更改成功！",
      oldPasswordWrong:"原密码错误！",
      changePassword:"修改密码",
      oldPassword:"原密码",
      newPassword:"新密码",
      confirmPassword:"确认密码",
      userNotExist:"用户不存在",
      unavailable:"本功能在当前配置下不可用",
    },
    tenant:{
      accountWhitelistTable:{
        whiteList:"白名单数量",
        debtSum:"白名单欠费合计",
        joinTime:"加入时间",
        ownerIdOrName:"用户ID或姓名",
        operatorId:"操作人",
        confirmRemoveWhite:"确认将账户移除白名单？",
        confirmRemoveWhiteText1:"确认要将账户",
        confirmRemoveWhiteText2:"从白名单移除？",
        removeWhiteSuccess:"移出白名单成功！",
        removeWhite:"从白名单中去除",
        expirationTime:"有效期",
      },
      addWhitelistedAccountButton:{
        notExist:"账户不存在！",
        addSuccess:"添加成功！",
        addWhiteList:"添加白名单账户",
        expirationTime:"有效期",
        custom:"自定义",
        oneWeek:"一周",
        oneMonth:"一个月",
        oneYear:"一年",
        permanent:"永久有效",
      },
      adminJobTable:{
        batch:"批量搜索",
        precise:"精确搜索",
        jobEndTime: "作业结束时间",
        adjust:"调整搜索结果所有作业",
        tenantPrice:"租户计费",
        platformPrice:"平台计费",
        jobNumber:"作业数量：",
        tenantPriceSum:"租户计费合计：",
        platformPriceSum:"平台计费合计：",
      },
      adminUserTable:{
        allUsers:"所有用户",
        tenantAdmin:"租户管理员",
        tenantFinance:"财务人员",
        idOrName:"用户ID或者姓名",
        name:"姓名",
        tenantRole:"租户角色",
        affiliatedAccountName:"关联账户",
        notExist:"用户不存在",
        notAvailable:"本功能在当前配置下不可用",
        changeSuccess:"修改成功",
        changeFail:"修改失败",
        changePassword:"修改密码",
      },
      jobPriceChangeModal:{
        tenantPrice:"租户计费",
        platformPrice:"平台计费",
        changeJob:"修改作业",
        jobNumber:"作业数量",
        newJob:"新作业",
        reason:"修改原因",
        modifyButton: "修改",
      },
      tenantSelector:{
        fresh:"刷新租户列表",
      },
      changeDefaultAccountBlockThresholdModal: {
        defaultAccountBlockThresholdAmount: "默认账户封锁阈值",
        setAmount: "设置默认账户封锁阈值",
      },
    },
    user:{
      addUserButton:{
        addUser:"添加用户",
        notMatch:"您输入的用户ID和姓名不匹配。",
        alreadyBelonged:"已属于其他租户",
        notExist:"租户或账户不存在",
        will:"将在",
        createModal:"秒后打开创建用户界面",
        createFirst:"用户不存在。请先创建用户",
        addSuccess:"添加成功！",
      },
      createUserForm:{
        email:"用户邮箱",
        password:"用户密码",
        confirm:"确认密码",
      },
      createUserModal:{
        alreadyExist:"此用户ID已经存在！",
        createUser:"创建用户",
        notExist:"用户不存在，请输入新用户信息以创建用户并添加进账户",

        email:"用户邮箱",
        password:"用户密码",
        confirm:"确认密码",
      },
      jobChargeLimitModal:{
        setSuccess:"设置成功",
        priceLimited:"用户作业费用限额",
        alreadyUsed:"当前已使用/总限额",
        cancelPriceLimited:"取消作业费用限额",
        confirmCancelLimited:"确认要取消此用户在此账户中的限额吗？",
        cancelAndNotBlock:"取消限额的同时解除封锁",
        cancelSuccess:"取消成功！",
        cancelLimited:"取消限额",
        unset:"未设置",
        changeLimited:"修改限额至",
        setLimited:"设置限额",
      },
      userTable:{
        block:"封锁",
        blocked: "封锁",
        normal:"正常",
        quotaExceeded: "限额",
        statusExplanation: "用户状态说明",
        blockedExplanation: "封锁：用户已被账户管理员或账户拥有者封锁，无法选择该账户提交作业",

        quotaExceededExplanation: "限额：用户未被封锁，但用户已用额度>=用户限额，无法选择该账户提交作业",

        normalExplanation: "正常：用户未被封锁，且用户已用额度<用户限额，可以选择该账户继续提交作业",

        admin:"管理员",
        user:"普通用户",
        role:"角色",
        alreadyUsed:"已用额度/用户限额",
        none:"无",
        limitManage:"限额管理",
        confirmNotBlock:"确认解除用户封锁？",
        confirmUnsealText1:"确认要从账户",
        confirmUnsealText2:"解除用户",
        confirmUnsealText3:"）的封锁？",
        unsealSuccess:"解封用户成功！",
        unseal:"解除封锁",
        confirmBlock:"确认封锁用户？",
        confirmBlockText1:"确认要从账户",
        confirmBlockText2:"封锁用户",
        blockSuccess:"封锁用户成功！",
        confirmCancelAdmin:"确认取消管理员权限",
        confirmCancelAdminText1:"确认取消用户",
        confirmCancelAdminText2:"在账户",
        confirmCancelAdminText3:"的管理员权限吗？",
        operateSuccess:"操作成功！",
        cancelAdmin:"取消管理员权限",
        confirmGrantAdmin:"给予管理员权限",
        confirmGrantAdminText1:"确认给予用户",
        confirmGrantAdminText2:"在账户",
        grantAdmin:"设为管理员",
        cannotRemove:"不能移出账户拥有者",
        confirmRemove:"确认移出用户",
        confirmRemoveText:"确认要从账户",
        removeSuccess:"移出用户成功！",
        removerUser:"移出用户",
        cannotRemoverUserWhoHaveRunningJobFromAccount:"用户还有作业在运行，已封锁该用户，请等待作业结束或手动结束作业后再移出",

      },
    },
  },
  component:{
    errorPages:{
      notAllowedPage:"不允许访问此页面",
      systemNotAllowed:"系统不允许您访问此页面。",
      notAllowed:"不允许访问",
      needLogin:"需要登录",
      notLogin:"您未登录或者登录状态已经过期。您需要登录才能访问此页面。",
      login:"登录",
      notExist:"不存在",
      pageNotExist:"您所请求的页面不存在。",
      serverWrong:"服务器出错",
      sorry:"对不起，服务器出错。请刷新重试。",
      clusterNotAvailable: "当前正在访问的集群不可用或没有可用集群。"
      + "请稍后再试或联系管理员。",
    },
    others:{
      seeDetails:"细节请查阅文档",
      modifyUser:"修改用户",
      password:"的密码",
      inputNewPassword:"请输入新密码",
      newPassword:"新密码",
      confirmPassword:"确认密码",
      selectCluster:"请选择集群",
      partitionFullName:"分区全名",
      nodes:"分区节点数",
      cores:"单节点核心数",
      gpus:"单节点GPU数",
      mem:"单节点内存（MB）",
      price:"单价（元）",
      notDefined:"未定义",
      description:"说明",
      operationType:"操作行为",
      operationResult:"操作结果",
      operatorUserId:"操作员",
      operationTime:"操作时间",
      operationCode:"操作码",
      operationDetail:"操作内容",
      operatorIp:"操作IP",
      alreadyIs:"用户已经是该角色",
      notExist:"用户不存在",
      notAuth:"用户没有权限",
      setSuccess:"设置成功",
      cannotCancel:"不能取消自己的平台管理员角色",
      alreadyNot:"用户已经不是该角色",
      selectRole:"选择角色",
      customEventType:"自定义操作类型",
    },
  },
  page: {
    noAccount: {
      resultTitle: "没有可以管理的账户",
      extraMessage: "请访问 http://hpc.pku.edu.cn/guide.html 查看如何开户。",
    },
    _app: {
      multiClusterOpErrorTitle: "操作失败",
      multiClusterOpErrorContent: "多集群操作出现错误，部分集群未同步修改",

      adapterConnErrorContent: "{} 集群无法连接，请稍后重试 ",
      effectErrorMessage: "服务器出错啦！",
      noActivatedClusters: "现在没有可用的集群，请在页面刷新后重试。",
      notExistInActivatedClusters: "正在查询的集群可能已被停用，请在页面刷新后重试。",

      noClusters: "无法找到集群的配置文件，请联系管理员。",
    },
    profile: {
      index: {
        accountInfo: "账号信息",
      },
    },
    user: {
      partitions: {
        getBillingTableErrorMessage: "集群和分区信息获取失败，请联系管理员。",

        partitionInfo: "分区信息",
        loading: "数据加载中...",
      },
      operationLogs: {
        userOperationLog: "本用户操作日志",
      },
      historyJobs: {
        userCompletedJob: "本用户已结束的作业",
      },
    },
    tenant: {
      info: {
        tenantFinanceOfficer: "租户财务人员",
      },
      jobBillingTable: {
        manageTenantJobPriceTable: "管理本租户作业价格表",
      },
      storage: {
        increase: "增加",
        decrease: "减少",
        set: "设置为",
        userNotFound: "用户未找到",
        balanceChangeIllegal: "余额变化不合法",
        editSuccess: "修改成功！",
        inputUserIdAndCluster: "请输入用户ID和集群",
        currentSpace: "当前空间",
        searching: "查询中...",
        clickSearch: "请点击查询",
        storageChange: "存储变化",
        selectSetTo: "选择设置为",
        adjustUserStorageSpace: "调整用户存储空间",
      },
      users: {
        list: {
          title: "用户列表",
        },
        create: {
          userExist: "用户已存在",
          userExistMessage: "用户已存在于SCOW数据库，无法再添加此用户",
          userExistAuth: "用户已存在于认证系统",
          userNotExistAuth: "用户未存在于认证系统",
          unableDetermineUserExistAuth: "无法确定用户是否存在于认证系统",
          userExistAuthMessage: "用户已经在认证系统中存在，您此处输入的密码将会不起作用，新用户的密码将是认证系统中的已有用户的当前密码。点击“确认”将会将此用户直接添加到SCOW数据库。",



          userNotExistAuthMessage: "点击“确认”将会同时在SCOW数据库和认证系统创建此用户",

          userExistInSCOWDatabaseMessage: "此用户存在于scow数据库",
          userExistAndAddToSCOWDatabaseMessage: "此用户存在于认证系统中，已成功添加到SCOW数据库",

          createUserFail: "创建用户失败",
          addCompleted: "添加完成！",
          crateUser: "创建用户",
        },
      },
      finance: {
        payments: {
          title: "租户充值记录",
        },
        payAccount: {
          title: "账户充值",
        },
        accountPayments: {
          title: "账户充值记录",
        },
        accountChargeRecords: {
          title: "账户消费记录",
        },
      },
      accounts: {
        whitelist: {
          title: "白名单账户",
          whitelistAccountList: "白名单账户列表",
        },
        list: {
          title: "账户列表",
        },
        create: {
          tenantNotExistUser: "租户 {} 下不存在用户 {}。",
          accountNameOccupied: "账户名已经被占用",
          userIdAndNameNotMatch: "用户ID和名字不匹配。",
          createSuccess: "创建成功！",
          ownerUserId: "拥有者用户ID",
          ownerName: "拥有者姓名",
          remark: "备注",
          createAccount: "创建账户",
        },
        accountName: {
          users: {
            userId: {
              jobs: {
                userExecJobList: "{}在{}中执行过的作业列表",
              },
            },
            index: {
              cannotManageUser: "您不能管理账户{}的用户。",
              userInAccount: "账户{}的用户",
            },
          },
        },
      },
    },
    init: {
      systemInitialized: "系统已初始化",
      unableReinitialize: "系统已经初始化完成，无法重新初始化！",
    },
    admin: {
      monitor: {
        alarmLog: {
          alarmLog: "告警日志",
          firingTime: "触发时间",
          firingTimePrompt: "告警的触发时间",
          status: "状态",
          selectAll: "全选",
          firing: "触发中",
          resolved: "已解决",
          search: "搜索",
          refresh: "刷新",
        },
        resourceStatus: {
          resourceStatus: "资源状态",
        },
      },
      operationLogs: {
        platformOperationLog: "平台操作日志",
      },
      jobBilling: {
        jobBillingPriceTable: "作业计费价格表",
        managementObject: "管理对象",
      },
      importUsers: {
        importUserInfo: "导入用户信息",
      },
      tenants: {
        create: {
          adminExist: "管理员用户已存在",
          adminExistMessage: "管理员用户已存在于SCOW数据库，无法再添加此用户",
          adminNotExistAuth: "管理员用户不存在于认证系统",
          adminNotExistAuthMessage: "管理员用户不存在，请确认管理员用户ID是否正确",
          adminExistAuthMessage: "管理员用户已经在认证系统中存在，您此处输入的密码将会不起作用，新用户的密码将是认证系统中的已有用户的当前密码。确认添加为新建租户管理员？",


          adminNotExistAuthAndConfirmCreateMessage: "管理员用户不存在于认证系统，是否确认创建此用户并添加为新建租户管理员？",

          unableConfirmAdminExistInAuthMessage: "无法确认管理员用户是否在认证系统中存在，将会尝试在认证系统中创建。"
          + "如果用户已经在认证系统中存在，您此处输入的密码将会不起作用，新用户的密码将是认证系统中的已有用户的当前密码",



          unableConfirmAdminExistInAuthAndUnableCreateMessage: "无法确认管理员用户是否在认证系统中存在，并且当前认证系统不支持创建用户，"
          + "请您确认此用户已经在认证系统中存在，确认将会直接加入到数据库中, 并且您此处输入的密码将不会起作用，新用户的密码将是认证系统中的已有用户的当前密码。",



          existInSCOWDatabase: "此{}已存在于scow数据库",
          createTenantSuccessMessage: "租户创建成功，且管理员用户存在于认证系统中，已成功添加到SCOW数据库",

          addCompleted: "添加完成！",
          createTenantFailMessage: "创建租户失败",
          createTenant: "创建租户",
          unavailable:"本功能在当前配置下不可用",
          userNotFound: "此用户不存在",
          tenantExist: "租户已存在",
          userStillMaintainsAccountRelationship: "该用户仍然含有账户关系",
        },
      },
      systemDebug: {
        slurmBlockStatus: {
          syncUserAccountBlockingStatus: "用户账户封锁状态同步",
          alertInfo: "SCOW会定期向调度器同步SCOW数据库中账户和用户的封锁状态，您可以点击立刻同步执行一次手动同步",

          periodicSyncUserAccountBlockStatusInfo:"周期性同步调度器账户和用户的封锁状态",
          turnedOn: "已开启",
          paused: "已暂停",
          stopSync: "停止同步",
          startSync: "开始同步",
          jobSyncCycle: "同步周期",
          lastSyncTime: "上次同步时间",
          notSynced: "未同步过",
          syncSuccess: "同步成功",
          partialSyncSuccess: "部分用户/账户同步失败：",
          syncBlockedFailedAccount: "同步封锁失败的账户：",
          syncUnblockedFailedAccount: "同步解封失败的账户：",
          syncBlockedFailedUserAccount: "在账户中同步封锁用户失败的数据：",
          syncSchedulerBlockingStatusNow: "立刻同步调度器账户和用户封锁状态",
        },
        fetchJobs: {
          jobInfoSync: "作业信息同步",
          alertMessage: "SCOW会定时从集群同步作业信息，您可以点击立刻同步执行一次手动同步。",

          periodicSyncJobInfo: "周期性同步作业信息",
          turnedOn: "已开启",
          paused: "已暂停",
          stopSync: "停止同步",
          startSync: "开始同步",
          jobSyncCycle: "作业同步周期",
          lastSyncTime: "上次同步时间",
          notSynced: "未同步过",
          jobSyncSuccessMessage: "作业同步完成，同步到{}条新纪录。",
          syncJobNow: "立刻同步作业",
        },
      },
      resourceManagement: {
        clusterManagement: {
          title: "集群管理",
          clusterFilter: "集群",
          table: {
            clusterName: "集群名称",
            nodesCount: "节点总数",
            cpusCount: "CPU总核数",
            gpusCount: "GPU总卡数",
            totalMemMb: "内存总容量",
            clusterState: "集群状态",
            errorState: "异常",
            deactivatedState: "停用",
            normalState: "正常",
            operator: "操作员",
            lastOperatedTime: "上次启用/停用时间",
            comment: "备注",
            operation: "操作",
            activate: "启用",
            deactivate: "停用",
          },
          activateModal: {
            title: "启用集群",
            content: "请确认是否启用集群ID是 {}，集群名称是 {} 的集群？",
            contentAttention: "注意：启用后请手动同步平台数据！",
            successMessage: "集群已启用",
            failureMessage: "集群启用失败，集群可能已被启用",
          },
          deactivateModal: {
            title: "停用集群",
            content: "请确认是否停用集群ID是 {}，集群名称是 {} 的集群？",
            contentInputNotice: "如果确认停用集群，请在下面重复输入上述集群ID和集群名称",

            contentAttention: "注意：停用后集群将不可用，集群所有数据不再更新！",

            clusterNameForm: "集群名称",
            clusterIdForm: "集群ID",
            comment: "停用备注",
            successMessage: "集群已停用",
            failureMessage: "集群停用失败，集群可能已被停用",
          },
        },
      },
      finance: {
        pay: {
          tenantCharge: "租户充值",
        },
        payments: {
          chargeRecord: "充值记录",
        },
        accountChargeRecords: {
          title: "账户消费记录",
        },
      },
      statistic: {
        dataOverview: "数据总览",
        dateRange: "日期筛选",
        user: "用户",
        account: "账户",
        tenant: "租户",
        job: "作业",
        charge: "消费",
        userCount: "用户数量",
        newUserCount: "新增用户数",
        activeUserCount: "活跃用户数",
        chargeOrPayAmount: "消费/充值金额",
        topTenChargedAccount: "消费账户Top10",
        chargeAmount: "消费金额",
        topTenPayAccount: "充值账户Top10",
        payAmount: "充值金额",
        topTenSubmitJobUser: "作业提交用户Top10",
        newJobCount: "新增作业数",
        systemFeatureUsageCount: "系统使用量",
        portalFeatureUsageCount: "门户系统使用功能次数",
        misFeatureUsageCount: "管理系统使用功能次数",
        jobCount: "作业数",
        usageCount:"次数",
        userName: "用户名",
        accountName: "账户名",
        amount: "金额",
        yuan: "元",
      },
    },
    accounts: {
      accountName: {
        users: {
          title: "账户{}用户管理",
        },
        userJob: {
          title: "用户{}在账户{}下运行的作业",
        },
        runningJobs: {
          title: "账户{}未结束的作业",
        },
        payments: {
          title: "账户{}充值记录",
        },
        operationLog: {
          title: "账户{}操作日志",
        },
        historyJobs: {
          title: "账户{}已结束的作业",
        },
        charges: {
          title: "账户{}扣费记录",
        },
      },
    },
  },
  operationLog: {
    resultTexts: {
      unknown: "未知",
      success: "成功",
      fail: "失败",
    },
    operationTypeTexts: {
      login: "用户登录",
      logout: "用户登出",
      submitJob: "提交作业",
      endJob: "结束作业",
      addJobTemplate: "保存作业模板",
      deleteJobTemplate: "删除作业模板",
      updateJobTemplate: "更新作业模板",
      shellLogin: "SHELL登录",
      createDesktop: "新建桌面",
      deleteDesktop: "删除桌面",
      createApp: "创建应用",
      createFile: "新建文件",
      deleteFile: "删除文件",
      uploadFile: "上传文件",
      createDirectory: "新建文件夹",
      deleteDirectory: "删除文件夹",
      moveFileItem: "移动或重命名文件/文件夹",
      copyFileItem: "复制文件/文件夹",
      setJobTimeLimit: "设置作业时限",
      createUser: "创建用户",
      addUserToAccount: "添加用户至账户",
      removeUserFromAccount: "从账户移出用户",
      setAccountAdmin: "设置账户管理员",
      unsetAccountAdmin: "取消账户管理员",
      blockUser: "封锁用户",
      unblockUser: "解封用户",
      accountSetChargeLimit: "账户设置限额",
      accountUnsetChargeLimit: "账户取消设置限额",
      setTenantBilling: "设置作业租户计费",
      setTenantAdmin: "设置租户管理员",
      unsetTenantAdmin: "取消租户管理员",
      setTenantFinance: "设置租户财务人员",
      unsetTenantFinance: "取消租户财务人员",
      tenantChangePassword: "租户重置用户密码",
      createAccount: "创建账户",
      addAccountToWhitelist: "添加白名单账户",
      removeAccountFromWhitelist: "移出白名单",
      accountPay: "账户充值",
      blockAccount: "封锁帐户",
      unblockAccount: "解封帐户",
      importUsers: "导入用户",
      setPlatformAdmin: "设置平台管理员",
      unsetPlatformAdmin: "取消平台管理员",
      setPlatformFinance: "设置平台财务人员",
      unsetPlatformFinance: "取消平台财务人员",
      platformChangePassword: "平台重置用户密码",
      setPlatformBilling: "设置平台作业计费",
      createTenant: "创建租户",
      tenantPay: "租户充值",
      submitFileItemAsJob: "提交脚本",
      exportUser: "导出用户列表",
      exportAccount: "导出账户列表",
      exportChargeRecord: "导出消费记录",
      exportPayRecord: "导出充值记录",
      exportOperationLog: "导出操作日志",
      setAccountBlockThreshold: "设置账户封锁阈值",
      setAccountDefaultBlockThreshold: "设置账户默认封锁阈值",
      userChangeTenant: "用户切换租户",
      customEvent: "自定义操作行为",
      activateCluster: "启用集群",
      deactivateCluster: "停用集群",
    },
    operationDetails: {
      login: "用户登录",
      logout: "用户退出登录",
      submitJob: "提交作业(集群：{}, ID: {})",
      endJob: "结束作业(集群：{}, ID: {})",
      addJobTemplate: "保存作业模板(集群：{}, 模板名: {})",
      deleteJobTemplate: "删除作业模板(集群：{}, 模板名：{})",
      updateJobTemplate: "更新作业模板(集群：{}, 旧模板名：{}，新模板名：{})",
      shellLogin: "登录{}集群的{}节点",
      createDesktop: "新建桌面(集群：{}, 登陆节点: {}, 桌面名：{}, 桌面类型: {})",
      deleteDesktop: "删除桌面(集群：{}, 登陆节点: {}, 桌面ID: {})",
      createApp: "创建应用(集群：{}, ID: {})",
      createFile: "新建文件：{}",
      deleteFile: "删除文件：{}",
      uploadFile: "上传文件：{}",
      createDirectory: "新建文件夹：{}",
      deleteDirectory: "删除文件夹：{}",
      moveFileItem: "移动或重命名文件/文件夹：{}至{}",
      copyFileItem: "复制文件/文件夹：{}至{}",
      setJobTimeLimit: "设置作业(集群：{}, ID: {})时限 {} 分钟",
      createUser: "创建用户{}",
      addUserToAccount: "将用户{}添加到账户{}中",
      removeUserFromAccount: "将用户{}从账户{}中移除",
      setAccountAdmin: "设置用户{}为账户{}的管理员",
      unsetAccountAdmin: "取消用户{}为账户{}的管理员",
      blockUser: "在账户{}中封锁用户{}",
      unblockUser: "在账户{}中解封用户{}",
      accountSetChargeLimit: "在账户{}中设置用户{}限额为{}元",
      accountUnsetChargeLimit: "在账户{}中取消用户{}限额",
      setTenantBilling: "设置租户{}的计费项{}价格为{}元",
      setTenantAdmin: "设置用户{}为租户{}的管理员",
      unsetTenantAdmin: "取消用户{}为租户{}的管理员",
      setTenantFinance: "设置用户{}为租户{}的财务人员",
      unsetTenantFinance: "取消用户{}为租户{}的财务人员",
      tenantChangePassword: "重置用户{}的登录密码",
      createAccount: "创建账户{}, 拥有者为{}",
      addAccountToWhitelist: "将账户{}添加到租户{}的白名单中",
      removeAccountFromWhitelist: "将账户{}从租户{}的白名单中移出",
      accountPay: "为账户{}充值{}元",
      blockAccount: "在租户{}中封锁账户{}",
      unblockAccount: "在租户{}中解封帐户{}",
      importUsers1: "给租户{}导入用户，",
      importUsers2: "在账户{}下导入用户{}",
      setPlatformAdmin: "设置用户{}为平台管理员",
      unsetPlatformAdmin: "取消用户{}为平台管理员",
      setPlatformFinance: "设置用户{}为平台财务人员",
      unsetPlatformFinance: "取消用户{}为平台财务人员",
      platformChangePassword: "重置用户{}的登录密码",
      createTenant: "创建租户{}, 租户管理员为: {}",
      tenantPay: "为租户{}充值{}元",
      setPlatformBilling: "设置平台的计费项{}价格为{}元",
      submitFileItemAsJob: "集群：{}，提交脚本：{}",
      tenantExportUser: "导出租户{}内的用户列表",
      adminExportUser: "导出平台的用户列表",
      tenantExportAccount: "导出租户{}内的账户列表",
      adminExportAccount: "导出平台的账户列表",
      exportAccountChargeRecordOfTenant: "导出租户{}内账户{}的消费记录",
      exportAccountsChargeRecordOfTenant: "导出租户{}内账户{}的消费记录",
      exportAllAccountsChargeRecordOfTenant: "导出租户{}内所有账户的消费记录",
      exportAllAccountsChargeRecordOfAdmin: "导出平台所有账户的消费记录",
      exportAccountsChargeRecordOfAdmin:"导出平台中账户{}的消费记录",
      exportAccountChargeRecordOfAdmin:"导出平台中账户{}的消费记录",
      exportTenantChargeRecord: "导出租户{}的消费记录",
      exportTenantsChargeRecordOfAdmin: "导出平台所有租户的消费记录",
      exportAccountPayRecordOfTenant: "导出租户{}内账户{}的充值记录",
      exportAccountsPayRecordOfTenant:"导出租户{}内账户{}的充值记录",
      exportAllAccountsPayRecordOfTenant: "导出租户{}内所有账户的充值记录",
      exportTenantPayRecord: "导出租户{}的充值记录",
      exportTenantsPayRecordOfAdmin: "导出平台所有租户的充值记录",
      exportOperationLogFromUser: "导出用户{}的操作日志",
      exportOperationLogFromAccount: "导出账户{}的操作日志",
      exportOperationLogFromTenant: "导出租户{}的操作日志",
      exportOperationLogFromAdmin: "导出平台的操作日志",
      setAccountBlockThreshold: "设置账户{}的封锁阈值为{}",
      setAccountDefaultBlockThreshold: "设置租户{}的默认账户封锁阈值为{}",
      unsetAccountBlockThreshold: "账户{}恢复使用默认封锁阈值",
      userChangeTenant: "用户{}切换租户，从租户{}切换到租户{}",
      activateCluster: "用户{}启用集群：{}",
      deactivateCluster: "用户{}停用集群：{}",
    },
  },
  userRoles: {
    platformAdmin: "平台管理员",
    platformFinance: "平台财务人员",
    tenantAdmin: "租户管理员",
    tenantFinance: "财务人员",
    user: "用户",
    owner: "拥有者",
    admin: "管理员",
  },
  AmountStrategy: {
    text: "计量方式",
    description: "确定作业的用量的方式",
    descriptionMaxCpusMem: "CPU和内存分配量",
    descriptionMaxGpuCpus: "GPU和CPU分配量",
    descriptionGpu: "GPU分配量",
    descriptionCpus: "CPU分配量",
    algorithmMaxCpusMem: "max(cpusAlloc, 向上取整(memReq / (分区内存量/分区核心数)))",
    algorithmMaxGpuCpus: "max(gpu, 向上取整(cpusAlloc / (分区核心数/分区gpu数)))",
    algorithmGpu: "gpu",
    algorithmCpus: "cpusAlloc",
  },
};
