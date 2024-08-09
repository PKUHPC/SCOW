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
  // baseLayout
  baseLayout: {
    linkTextMis: "管理系统",
    linkTextAI: "SCOW AI",
  },
  // routes
  routes: {
    dashboard: "仪表盘",
    job:{
      title: "作业",
      runningJobs: "未结束的作业",
      allJobs: "所有作业",
      submitJob: "提交作业",
      jobTemplates: "作业模板",
    },
    desktop: "桌面",
    apps: {
      title: "交互式应用",
      appSessions: "已创建的应用",
      createApp: "创建应用",
    },
    file: {
      fileManager: "文件管理",
      crossClusterFileTransfer: "文件传输",
      clusterFileManager: "集群文件管理",
      transferProgress: "传输进度",
    },
  },
  // button
  button: {
    searchButton: "搜索",
    refreshButton: "刷新",
    cancelButton: "取消",
    confirmButton: "确定",
    selectButton: "选择",
    actionButton: "操作",
    deleteButton: "删除",
    renameButton: "重命名",
    finishButton: "结束",
    detailButton: "详情",
    submitButton: "提交",
    closeButton: "关闭",
    startButton: "启动",
  },
  // pageComp
  pageComp: {
    // profile
    profile: {
      changPasswordModal: {
        successMessage: "密码更改成功",
        errorMessage: "原密码错误",
        changePassword: "修改密码",
        oldPassword:"原密码",
        newPassword: "新密码",
        confirm: "确认密码",
        userNotExist:"用户不存在",
        unavailable:"本功能在当前配置下不可用",
      },
    },
    // job
    job: {
      accountSelector: {
        selectAccountPlaceholder: "请选择账户",
        refreshAccountList: "刷新账户列表",
      },
      partitionSelector: {
        selectPartitionPlaceholder: "请选择分区",
        refreshPartitionList: "刷新分区列表",
      },
      allJobsTable: {
        searchForm: {
          clusterLabel: "集群",
          time: "时间",
          popoverTitle: "查询该时间区域内所有有活动（如作业提交、等待中、开始、运行、失败、完成）的作业",

          jobId: "作业ID",
        },
        tableInfo: {
          jobId: "作业ID",
          jobName: "作业名",
          account: "账户",
          partition: "分区",
          qos: "QOS",
          state: "状态",
          submitTime: "提交时间",
          startTime: "开始时间",
          endTime: "结束时间",
          elapsed: "运行时间",
          timeLimit: "作业时间限制",
          reason: "说明",
          more: "更多",
          linkToPath: "进入目录",
        },
      },
      // fileSelectModal
      fileSelectModal: {
        title: "文件目录选择框",
        newPath: "新目录",
      },
      // jobTemplateModal
      jobTemplateModal: {
        clusterLabel:"集群",
        errorMessage: "模板不存在!",
        changeSuccessMessage: "修改成功!",
        changTemplateName: "修改模板名字",
        newTemplateName: "新模板名",
        templateName: "模板名",
        comment: "备注",
        useTemplate:"使用模板",
        popConfirm: "确定删除这个模板吗?",
        deleteSuccessMessage: "模板已删除!",
      },
      // runningJobDrawer
      runningJobDrawer: {
        cluster: "集群",
        jobId: "作业ID",
        account: "账户",
        jobName: "作业名",
        partition: "分区",
        qos: "QOS",
        nodes: "节点数（个）",
        cores: "核心数（个）",
        gpus: "GPU卡数（个）",
        state: "状态",
        nodesOrReason: "说明",
        runningOrQueueTime: "运行/排队时间",
        submissionTime: "提交时间",
        timeLimit: "作业时限（分钟）",
        drawerTitle: "未结束的作业详细信息",
      },
      // runningJobTable
      runningJobTable: {
        filterForm: {
          cluster: "集群",
          jobId: "作业ID",
        },
        jobInfoTable: {
          cluster: "集群",
          jobId: "作业ID",
          account: "账户",
          name: "作业名",
          partition: "分区",
          qos: "QOS",
          nodes: "节点数",
          cores: "核心数",
          gpus: "GPU卡数",
          state: "状态",
          runningOrQueueTime: "运行/排队时间",
          nodesOrReason: "说明",
          timeLimit: "作业时间限制",
          more: "更多",
          linkToPath: "进入目录",
          popConfirm: "确定结束这个任务吗?",
          successMessage: "任务结束请求已经提交!",
        },
      },
      // submitJobForm
      submitJobForm: {
        errorMessage: "提交作业失败",
        successMessage: "提交成功！您的新作业ID为：",
        cluster: "集群",
        jobName: "作业名",
        command: "命令",
        account: "账户",
        partition: "分区",
        qos: "QOS",
        nodeCount: "节点数",
        gpuCount: "单节点GPU卡数",
        coreCount: "单节点核心数",
        maxTime: "最长运行时间",
        requireMaxTime:"请输入最长运行时间",
        minute: "分钟",
        hours:"小时",
        days: "天",
        workingDirectory: "工作目录",
        wdTooltip1: "1. 请填写绝对路径，如填写相对路径，则相对于该用户家目录；",

        wdTooltip2: "2. 填写目录不可访问或者不可操作时，提交作业或者作业运行将失败；",

        wdTooltip3: "该文件用于保存适配器返回的脚本，默认值参考输出文件。",

        output: "标准输出文件",
        errorOutput: "错误输出文件",
        saveJobSubmissionFile:"保存作业提交文件",
        totalNodeCount: "总节点数：",
        totalGpuCount: "总GPU卡数：",
        totalCoreCount: "总CPU核心数：",
        totalMemory: "总内存容量：",
        comment: "备注",
        saveToTemplate: "保存为模板",
      },
    },
    fileManagerComp: {
      clusterFileTable: {
        fileName: "文件名",
        modificationDate: "修改日期",
        size: "大小",
        permission: "权限",
        notShowHiddenItem: "不显示隐藏的项目",
        showHiddenItem: "显示隐藏的项目",
      },
      singleCrossClusterTransferSelector: {
        placeholder: "请选择集群",
      },
      transferInfoTable: {
        srcCluster: "发送集群",
        dstCluster: "接收集群",
        file: "文件",
        transferCount: "传输数量",
        transferSpeed: "传输速度",
        timeLeft: "剩余时间",
        currentProgress: "当前进度",
        operation: "操作",
        confirmCancelTitle: "确认取消",
        confirmCancelContent: "确认取消 {} -> {} 的文件 {} 的传输吗?",
        confirmOk: "确认",
        cancelSuccess: "取消成功",
        cancel: "取消",
      },
      fileEditModal: {
        edit: "编辑",
        prompt: "提示",
        save: "保存",
        doNotSave: "不保存",
        notSaved: "未保存",
        notSavePrompt: "文件未保存，是否保存该文件？",
        fileEdit: "文件编辑",
        filePreview: "文件预览",
        fileLoading: "文件正在加载...",
        exitEdit: "退出编辑",
        failedGetFile: "获取文件: {} 失败",
        cantReadFile: "无法读取文件: {}",
        saveFileFail: "文件保存失败: {}",
        saveFileSuccess: "文件保存成功",
        fileSizeExceeded: "文件过大（最大{}），请下载后编辑",
        fileFetchAbortPrompt: "获取文件 {} 操作被终止",
      },
      createFileModal: {
        createErrorMessage: "同名文件或者目录已经存在！",
        createSuccessMessage: "创建成功",
        create: "创建文件",
        fileDirectory: "要创建的文件的目录",
        fileName: "文件名",
      },
      fileManager: {
        preview: {
          cantPreview: "文件过大（最大{}）或者格式不支持，请下载后查看",
        },
        moveCopy: {
          copy: "复制",
          move: "移动",
          modalErrorTitle: "文件{}{}出错",
          existModalTitle: "文件/目录已存在",
          existModalContent: "文件/目录{}已存在，是否覆盖？",
          existModalOk: "确认",
          errorMessage: "{}错误！总计{}项文件/目录，其中成功{}项，放弃{}项，失败{}项",
          successMessage: "{}成功！总计{}项文件/目录，其中成功{}项，放弃{}项",
        },
        delete: {
          confirmTitle: "确认删除",
          confirmOk: "确认",
          confirmContent: "确认要删除选中的{}项？",
          successMessage: "删除{}项成功！",
          errorMessage: "删除成功{}项，失败{}项",
          otherErrorMessage: "执行删除操作时遇到错误",
        },
        tableInfo: {
          title: "集群{}文件管理",
          uploadButton: "上传文件",
          deleteSelected: "删除选中",
          copySelected: "复制选中",
          moveSelected: "移动选中",
          paste: "粘贴到此处",
          operationStarted: "正在{}，已完成：",
          operationNotStarted: "已选择{}{}个项",
          notShowHiddenItem: "不显示隐藏的项目",
          showHiddenItem: "显示隐藏的项目",
          openInShell: "在终端中打开",
          createFile: "新文件",
          mkDir: "新目录",
          download: "下载",
          rename: "重命名",
          deleteConfirmTitle: "确认删除",
          deleteConfirmContent: "确认删除{}?",
          deleteConfirmOk: "确认",
          deleteSuccessMessage: "删除成功",
          submitConfirmTitle: "确认提交",
          submitConfirmNotice: "请确保脚本文件提供了可用的绝对路径作为工作目录，"
          + "如未提供则默认为脚本文件所在目录",

          submitConfirmContent: "确认提交{}至{}?",
          submitConfirmOk: "确认",
          submitSuccessMessage: "提交成功！您的新作业ID为：{}",
          submitFailedMessage: "提交失败",
        },
      },
      fileTable: {
        fileName: "文件名",
        changeTime: "修改日期",
        size: "大小",
        mode: "权限",
        action: "操作",
      },
      mkDirModal: {
        existedErrorMessage: "同名文件或目录已经存在！",
        successMessage: "创建成功",
        title: "创建目录",
        mkdirLabel: "要创建的目录的目录",
        dirName: "目录名",
      },
      renameModal: {
        successMessage: "修改成功",
        title: "重命名文件",
        renameLabel: "要重命名的文件",
        newFileName: "新文件名",
      },
      uploadModal: {
        title: "上传文件",
        uploadRemark1: "文件将会上传到：",
        uploadRemark2: "。同名文件将会被覆盖。",
        uploadRemark3: "单个上传文件大小最大为：",
        uploadRemark4: "。",
        cancelUpload: "取消上传",
        deleteUploadRecords: "删除上传记录",
        successMessage: "上传成功",
        errorMessage: "上传失败",
        maxSizeErrorMessage: "{}上传失败,文件大小超过{}",
        existedModalTitle: "文件/目录已存在",
        existedModalContent: "文件/目录{}已存在，是否覆盖？",
        existedModalOk: "确认",
        dragText: "点击或者将文件拖动到这里",
        hintText: "支持上传单个或者多个文件",
        multipartUploadError: "文件上传失败: {}",
        calculateHashError: "计算哈希值错误: {}",
        uploadFileListNotExist: "上传文件列表中不存在: {}",
        mergeFileChunksErrorText: "合并文件 {} 失败，请重试",
      },
    },
    // desktop
    desktop: {
      desktopTable: {
        tableItem: {
          title: "桌面ID",
          desktopName: "桌面名称",
          wm: "桌面类型",
          addr: "地址",
          createTime: "创建时间",
        },
        filterForm: {
          cluster: "集群",
          loginNode: "登录节点",
          createNewDesktop: "新建桌面",
        },
      },
      desktopTableActions: {
        popConfirmTitle: "删除后不可恢复，你确定要删除吗?",
      },
      newDesktopModal: {
        error: {
          tooManyTitle: "新建桌面失败",
          tooManyContent: "该集群桌面数目达到最大限制",
        },
        modal: {
          createNewDesktop: "新建桌面",
          loginNode: "登录节点",
          wm: "桌面",
          desktopName: "桌面名",
        },
      },
    },
    // app
    app: {
      appSessionTable: {
        table: {
          sessionId: "作业名",
          jobId: "作业ID",
          appId: "应用",
          submitTime: "提交时间",
          state: "状态",
          remainingTime: "剩余时间",
          popFinishConfirmTitle: "确定结束这个任务吗",
          popFinishConfirmMessage: "任务结束请求已经提交",
          popCancelConfirmTitle: "确定取消这个任务吗",
          popCancelConfirmMessage: "任务取消请求已经提交",
          linkToPath: "进入目录",
        },
        filterForm: {
          appJobName: "作业名",
          autoRefresh: "10s自动刷新",
          onlyNotEnded: "只展示未结束的作业",
        },
      },
      connectToAppLink: {
        notFoundMessage: "此应用会话不存在",
        notConnectableMessage: "此应用目前无法连接",
        notReady: "应用还未准备好",
        connect: "连接",
      },
      createApps: {
        notFoundMessage: "没有可以创建的交互式应用",
        loading: "正在加载可创建的交互式应用",
        create: "创建",
      },
      launchAppForm: {
        errorMessage: "创建应用失败",
        successMessage: "创建成功",
        loading: "查询上次提交记录中",
        appJobName: "作业名",
        account: "账户",
        partition: "分区",
        qos: "QOS",
        nodeCount: "节点数",
        gpuCount: "单节点GPU卡数",
        coreCount: "单节点CPU核心数",
        maxTime: "最长运行时间",
        minute: "分钟",
        totalGpuCount: "总GPU卡数",
        totalCpuCount: "总CPU核心数",
        totalMemory: "总内存容量",
        appCommentTitle: "说明",
      },
    },
    dashboard:{
      overviewTable:{
        title:"平台概览",
        clusterName:"集群",
        partitionName:"分区",
        nodeCount:"节点总数",
        pendingJobCount:"作业排队数",
        cpuUsage:"CPU使用率",
        gpuUsage:"GPU使用率",
        usageRatePercentage:"节点使用率",
        partitionStatus:"分区状态",
        available:"可用",
        notAvailable:"不可用",
      },
      infoPanes:{
        nodeInfo:"节点信息",
        node:"节点",
        resourceInfo:"资源信息",
        core:"核",
        running:"运行中",
        idle:"空闲",
        notAvailable:"不可用",
        card:"卡",
        job:"作业",
        pending:"排队中",
        platformOverview:"平台概览",
        totalNodes:"总数",
        totalCores:"总核心数",
        totalCards:"总卡数",
      },
      nodeRange:{
        jobs:"作业",
        running:"运行中",
        pending:"排队中",
      },
      addEntryModal:{
        addQuickEntry:"添加快捷方式",
        cancel:"取消",
      },
      changeClusterModal:{
        selectCluster:"选择集群",
        cluster:"集群",
        loginNode:"登录节点",
      },
      quickEntry:{
        quickEntry:"快捷入口",
        finish:"完成",
        cancel:"取消",
        edit:"编辑",
      },
      sortable:{
        alreadyExist:"已存在该快捷方式",
        exceedMaxSize:"最多只能添加10个快捷方式",
        saveFailed:"保存失败",
        saveSuccessfully:"保存成功",
      },
      infoPane:{
        nodeUtilization:"节点使用率",
      },
      doubleInfoPane:{
        CPUCoreUsage:"CPU核心使用率",
        GPUCoreUsage:"GPU卡使用率",
      },
      titleContainer:{
        available:"可用",
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
      clusterSelector: "请选择集群",
    },
  },
  pages: {
    apps: {
      create: {
        title: "创建",
        error404: "此应用不存在",
      },
      createApps: {
        subTitle: "您所请求的集群不存在",
        title: "创建应用",
        pageTitle: "在{}集群创建应用",
      },
      sessions: {
        subTitle: "您所请求的集群不存在",
        title: "交互式应用",
        pageTitle: "集群{}交互式应用",
      },
    },
    desktop: {
      title: "桌面",
      pageTitle: "登录节点上的桌面",
    },
    files: {
      path: {
        subTitle: "您所请求的集群不存在",
        title: "文件管理",
      },
      fileTransfer: {
        confirmTransferTitle: "确认开始传输?",
        confirmTransferContent: "确认从 {} 传输到 {} 吗?",
        confirmOk: "确认",
        transferStartInfo: "传输任务已经开始",
        transferTitle: "跨集群文件传输",
      },
      currentTransferInfo: {
        checkTransfer: "文件传输进度查看",
      },
    },
    jobs: {
      allJobs: {
        title: "历史作业",
        pageTitle: "本用户所有历史作业",
      },
      runningJobs: {
        title: "未结束的作业",
        pageTitle: "本用户未结束的作业",
      },
      savedJobs: {
        title: "作业模板",
        pageTitle: "作业模板列表",
      },
      submit: {
        title: "提交作业",
        pageTitle: "提交作业",
        spin: "正在加载作业模板",
      },
    },
    profile: {
      title: "账号信息",
      userInfo: "用户信息",
      identityId: "用户ID",
      name: "用户姓名",
      changePassword: "修改密码",
      loginPassword: "登录密码",
    },
    shell: {
      loginNode: {
        title: "的终端",
        content: "以ID: {} 连接到集群 {} 的 {} 节点",
        reloadButton: "刷新并重新连接",
        popoverTitle: "命令",
        popoverContent1: "跳转到文件系统",
        popoverContent2: "，输入该命令后会跳转到文件系统，您可以进行文件的上传和下载",

        popoverContent3: "文件下载",
        popoverContentFile:"文件名",
        popoverContent4: "，输入",
        popoverContent5: "，您当前路径下的该文件会被下载到本地",

        popoverContent6: "目前不支持输入相对路径，如果需要下载或编辑其他目录下的文件请使用",
        popoverContent7: "命令跳转到文件系统。",
        popoverContent8: "使用示例：",

        popoverContent9: "文件编辑",
        popoverContent10: "，输入",
        popoverContent11: "命令后跳转到文件编辑页面， 您可以编辑指定的文件",

        popoverContent12: "文件上传",
        popoverContent13: "，输入该命令后您可以将本地文件上传到当前路径下",

        command:"命令",
      },
      index: {
        title: "终端",
        content: "启动以下集群的终端：",
      },
    },
    _app: {
      textExceedsLength:"终端登录提示信息过多，请减少'~/.bashrc'等文件中不必要的信息输出!",
      sshError:"无法以用户身份连接到登录节点。请确认您的家目录的权限为700、750或者755",
      sftpError:"SFTP操作失败，请确认您是否有操作的权限",
      otherError:"服务器出错啦！",
      adapterConnectionError: "{} 集群无法连接，请稍后重试 ",
      noActivatedClusters: "现在没有可用的集群，请在页面刷新后重试。",
      notExistInActivatedClusters: "正在查询的集群可能已被停用，请在页面刷新后重试。",

      noClusters: "无法找到集群的配置文件，请联系管理员。",
    },
    dashboard: {
      title: "仪表盘",
    },
    common: {
      noAvailableClusters: "当前没有可用集群。"
      + "请稍后再试或联系管理员。",
    },
  },
};
