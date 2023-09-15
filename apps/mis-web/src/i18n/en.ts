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
  common: {
    changeSuccess: "Modification Successful",
    changeFail: "Modification Failed",
    email: "Email",
    platform: "Platform",
    userCount: "User Count",
    balance: "Balance",
    createTime: "Creation Time",
    search: "Search",
    operation: "Operation",
    tenant: "Tenant",
    tenantName: "Tenant Name",
    tenantRole: "User Role",
    user: "User",
    userId: "User ID",
    userName: "Username",
    import: "Import",
    fresh: "Refresh",
    account: "Account",
    accountName: "Account Name",
    owner: "Owner",
    selectTenant: "Please Select a Tenant",
    selectAccount: "Please Select an Account",
    amount: "Amount",
    unit: "CNY",
    comment: "Comment",
    submit: "Submit",
    time: "Time",
    type: "Type",
    total: "Total",
    sum: "Sum",
    ok: "Confirm",
    prompt: "Prompt",
    role: "Role",
    add: "Add",
    modify: "Modify",
    cancel: "Cancel",
    cluster: "Cluster",
    workId: "Job ID",
    minute: "Minutes",
    name: "Name",
    set: "Settings",
    clusterWorkId: "Cluster Job ID",
    partition: "Partition",
    workName: "Job Name",
    timeSubmit: "Submission Time",
    timeEnd: "End Time",
    more: "More",
    detail: "Details",
    price: "Price",
    status: "Status",
    changePassword: "Change Password",
    changeEmail: "Change Email",
    platformRole: "Platform Role",
    illustrate: "Explanation",
    userInfo: "User Information",
    loginPassword: "Login Password",
    historyJob: "Historical Jobs",
    tenantInfo: "Tenant Information",
    admin: "Administrator",
    accountCount: "Account Count",
    tenantBalance: "Tenant Balance",
    jobBillingTable: "Job Pricing Table",
    operationLog: "Operation Log",
    unfinishedJob: "Unfinished Jobs",
    userList: "User List",
    platformInfo: "Platform Information",
    platformAdmin: "Platform Administrator",
    platformFinancialStaff: "Platform Financial Staff",
    tenantCount: "Tenant Count",
    accountList: "Account List",
    tenantList: "Tenant List",
    addFail: "Addition Failed",
    addSuccess: "Addition Successful",
    jobBilling: "Job Billing",
    accountOwner: "Account Owner",
    accountStatus: "Account Status",
    block: "Blocked",
    accountBalance: "Account Balance",
    normal: "Normal",
  },
  dashboard: {
    title: "Dashboard",
    account: {
      title: "Account Information",
      state: "Status",
      balance: "Available Balance",
      status: {
        blocked: "Blocked",
        normal: "Normal",
      },
      alert: "You do not belong to any account.",
    },
    job: {
      title: "Unfinished Job List",
      extra: "View All Unfinished Jobs",
      jobTable: {
        cluster: "Cluster",
        jobId: "Job ID",
        account: "Account",
        name: "Job Name",
        partition: "Partition",
        qos: "QOS",
        nodes: "Node Count",
        cores: "Core Count",
        state: "Status",
        time: "Runtime/Queue Time",
        reason: "Explanation",
        limit: "Job Time Limit",
        others: "More",
      },
      none: "No data available",
    },
  },

  footer: "Powered by SCOW",

  runningJob: {
    title: "Unfinished Jobs for this User",
  },
  layouts: {
    route: {
      common: {
        operationLog: "Operation Log",
      },
      navLinkText: "Portal",
      dashboard: "Dashboard",
      user: {
        firstNav: "User Space",
        runningJobs: "Unfinished Jobs",
        finishedJobs: "Finished Jobs",
        clusterPartitions: "Cluster and Partition Information",
      },
      platformManagement: {
        fistNav: "Platform Management",
        info: "Platform Information",
        importUsers: "Import Users",
        tenantsManagement: "Tenant Management",
        tenantsList: "Tenant List",
        createTenant: "Create Tenant",
        usersList: "User List",
        jobBillingTable: "Job Pricing Table",
        financeManagement: "Finance Management",
        tenantPay: "Tenant Recharge",
        payments: "Recharge Records",
        accountChargeRecords: "Account Consumption Records",
        systemDebug: "Platform Debug",
        statusSynchronization: "Block Status Synchronization",
        jobSynchronization: "Job Information Synchronization",
        accountList: "Account List",
      },
      tenantManagement: {
        firstNav: "Tenant Management",
        info: "Tenant Information",
        manageJobPrice: "Job Pricing Table",
        runningJobs: "Unfinished Jobs",
        finishedJobs: "Finished Jobs",
        userManagement: "User Management",
        userList: "User List",
        createUser: "Create User",
        jobTimeLimit: "Adjust Job Time Limit",
        storage: "Adjust User Storage Space",
        accountManagement: "Account Management",
        accountList: "Account List",
        createAccount: "Create Account",
        whitelist: "Account Whitelist",
        financeManagement: "Finance Management",
        accountPay: "Account Recharge",
        financePayments: "Recharge Records",
        accountPayments: "Account Recharge Records",
        accountChargeRecords: "Account Consumption Records",
      },
      accountManagement: {
        firstNav: "Account Management",
        info: "Account Information",
        runningJobs: "Unfinished Jobs",
        finishedJobs: "Finished Jobs",
        userManagement: "User Management",
        pay: "Recharge Records",
        cost: "Consumption Records",
      },
    },
  },
  pageComp: {
    accounts: {
      accountTable: {
        allAccount: "All Accounts",
        debtAccount: "Debt Accounts",
        blockedAccount: "Blocked Accounts",
        account: "Account",
        accountName: "Account Name",
        owner: "Owner",
        tenant: "Tenant",
        comment: "Comment",
        status: "Status",
        mangerMember: "Manage Members",
        block: "Blocked",
        normal: "Normal",
        unit: "CNY",
      },
    },
    admin: {
      allTenantsTable: {
        tenantName: "Tenant Name",
        accountCount: "Account Count",
      },
      allUserTable: {
        allUsers: "All Users",
        platformAdmin: "Platform Administrators",
        platformFinance: "Finance Staff",
        idOrName: "User ID or Name",
        userId: "User ID",
        name: "Name",
        tenant: "Belongs to Tenant",
        availableAccounts: "Available Accounts",
        roles: "Platform Roles",
        notExist: "User does not exist",
        notAvailable: "This feature is not available in the current configuration",
        success: "Success in the current configuration",
        fail: "Fail in the current configuration",
        changePassword: "Change Password",
      },
      createTenantForm: {
        prompt: "Please enter the tenant name and create a new user as the administrator for this tenant.",
        adminInfo: "Administrator Information",
        userEmail: "User Email",
        userPassword: "User Password",
        confirmPassword: "Confirm Password",
      },
      ImportUsersTable: {
        selectAccount: "Please select an account!",
        specifyOwner: "Specify an owner for each account.",
        incorrectFormat: "Incorrect data format.",
        importSuccess: "Import successful.",
        selectCluster: "Select a cluster to import accounts into the default tenant on a per-account basis.",
        alreadyExist: "Account already exists in SCOW.",
        notExist: "Account does not exist in SCOW and will be imported into SCOW.",
        partNotExist: "Some users in the account do not exist in SCOW and will be imported as new users.",
        selectOwner: "Please select an owner.",
        importStatus: "Import Status",
        alreadyImport: "Already imported",
        partImport: "Account already imported, some users not imported.",
        notImport: "Not imported",
        userList: "User List",
        addWhitelist: "Add all accounts to the whitelist.",
      },
      tenantChargeForm: {
        loadType: "Loading used types...",
        charging: "Charging...",
        accountNotFound: "Account not found.",
        chargeFinish: "Charging completed!",
      },
    },
    commonComponent: {
      paymentTable: {
        total: "Total",
        sum: "Sum",
        paymentDate: "Payment Date",
        paymentAmount: "Payment Amount",
        ipAddress: "IP Address",
        operatorId: "Operator ID",
      },
    },
    dashboard: {
      storageCard: {
        storage: "Storage",
        alreadyUsed: "Already Used",
        totalLimited: "Total Limit",
        nowUsed: "Current Usage",
      },
      storageSection: {
        storageStatus: "Storage Status",
      },
    },
    finance: {
      AccountSelector: {
        freshList: "Refresh account list",
      },
      chargeForm: {
        loadType: "Loading used types...",
        charging: "Charging...",
        notFound: "Account not found.",
        chargeFinished: "Charging finished!",
      },
      chargeTable: {
        time: "Deduction Date",
        amount: "Deduction Amount",
      },
    },
    init: {
      initAdminForm: {
        alreadyExist: "User already exists.",
        cannotAdd: "User already exists in the SCOW database and cannot be added again.",
        notExist: "User does not exist in the authentication system.",
        confirm: "User does not exist. Please confirm if the user ID is correct.",
        existText: "The user already exists in the authentication system. The password you enter "
        + "here will not be used; the new user's password will be the current password in the "
        + "authentication system. Confirm adding as the initial administrator?",
        notExistText: "User does not exist in the authentication system. Confirm creating this user "
        + "and adding as the initial administrator?",
        cannotConfirmText1: "Unable to confirm whether the user exists in the authentication system. "
        + "An attempt will be made to create the user in the authentication system. "
        + "If the user already exists in the authentication system, the password you enter here "
        + "will not be used; the new user's password will be the current password in the authentication system.",
        cannotConfirmText2: "Unable to confirm whether the user exists in the authentication system, "
        + "and the current authentication system does not support user creation. "
        + "Please confirm that the user already exists in the authentication system. "
        + "Confirmation will directly add the user to the database, and the password you enter "
        + "here will not be used; the new user's password will be the current password in the authentication system.",
        addFail: "Add failed.",
        userExist: "This user exists in the SCOW database.",
        addSuccess: "Added successfully.",
        addDb: "This user exists in the authentication system and has been successfully added to the SCOW database.",
        addFinish: "Addition completed!",
        createFail: "Failed to create user.",
        initAdmin: "You can create an initial administrator user here.",
        addAdmin: "The users added here are initial administrators, located in the default tenant, "
        + "and will automatically have the platform administrator and default tenant tenant administrator roles.",
        platFormAdmin: "Platform Administrator",
        and: "and",
        defaultTenant: "Default Tenant Tenant Administrator",
        createText1: "The current authentication system supports user creation. You can choose to add "
        + "an existing user from the authentication system or create a completely new user. "
        + "The system will create this user in the authentication system.",
        createText2: "The current authentication system does not support user creation. Please confirm "
        + "that the user to be added must already exist in the authentication system, and the user ID "
        + "must match the user ID in the authentication system.",
      },
      initImportUsersTable: {
        importUser: "You can import existing users here. See the",
        document: "document",
        learn: "to learn about the system user model and how to import user information.",
        useMore: "If you use SCOW to manage multiple clusters, SCOW system requires that multiple "
        + "clusters have identical user account information. You only need to import user information "
        + "from one cluster.",
      },
      initJobBillingTable: {
        set: "You can set the default job pricing table here. You must set prices for all items "
        + "to complete the initialization.",
      },
      initLayout: {
        importUser: "Import Users",
        userManager: "User Account Management",
        create: "Create Initial Administrator User",
        edit: "Edit Job Pricing Table",
        Incomplete: "Incomplete Pricing Table",
        set: "Please set prices for each job billing item before completing initialization.",
        confirm: "Confirm completion of initialization",
        confirmText: "Once initialization is complete, you will not be able to return to this page to reinitialize.",
        finish: "Initialization completed!",
        goLogin: "Click to confirm and go to login",
        init: "System Initialization",
        complete: "Complete Initialization",
      },
      initUsersAndAccountsTable: {
        platformRole: "Platform Role",
        tenantRole: "Tenant Role",
        accountAffiliation: "Affiliated Account",
        defaultTenant: "You can manage users and accounts under the default tenant in the current system here,"
        + "and set a user as",
        initAdmin: "Initial Administrator",
        set: "who serves as both a tenant administrator and a platform administrator.",
      },
    },
    job: {
      ChangeJobTimeLimitModal: {
        modifyLimit: "Modify Job Time Limit",
        success: "All modifications to time limits were successful.",
        fail: "Some modifications to job time limits failed.",
        setLimit: "Set Job Time Limit",
        modifyWork: "Failed Job Modifications",
      },
      editableJobBillingTable: {
        alreadyUsed: "This ID has already been used.",
        addSuccess: "Added successfully!",
        edit: "Edit Job Pricing Item",
        defaultPrice: "Default Pricing Item",
        path: "Billing Path",
        id: "Billing Item ID",
        strategy: "Billing Strategy",
        price: "Price (CNY)",
        name: "Full Name of Partition",
        nodes: "Number of Nodes per Partition",
        cores: "Number of Cores per Node",
        gpus: "Number of GPUs per Node",
        memory: "Memory per Node (MB)",
        now: "Current Billing Item",
        unset: "Not Set",
      },
      historyJobDrawer: {
        list: "Node Usage List",
        timeSubmit: "Submission Time",
        timeStart: "Start Time",
        timeEnd: "End Time",
        gpus: "Number of GPUs Used",
        cpusReq: "Requested Number of CPUs",
        cpusAlloc: "Allocated Number of CPUs",
        memReq: "Requested Memory (MB)",
        memAlloc: "Allocated Memory (MB)",
        nodesReq: "Requested Number of Nodes",
        nodesAlloc: "Allocated Number of Nodes",
        timeLimit: "Job Time Limit (Minutes)",
        timeUsed: "Job Execution Time (Seconds)",
        timeWait: "Job Wait Time (Seconds)",
        recordTime: "Record Time",
        workFee: "Job Billing (CNY)",
        tenantFee: "Tenant Billing (CNY)",
        platformFee: "Platform Billing",
        detail: "Job Details",
      },
      historyJobTable: {
        noAuth: "You do not have permission to view this information.",
        batchSearch: "Batch Search",
        jobEndTime: "Job End Time",
        precision: "Precision Search",
        platformPrice: "Platform Billing",
        tenantPrice: "Tenant Billing",
        jobNumber: "Number of Jobs",
      },
      jobBillingManagementTable: {
        priceId: "Billing Item ID",
        path: "Billing Path",
        tenant: "Tenant",
      },
      manageJobBillingTable: {
        itemId: "Price Item ID",
        price: "Price (CNY)",
        abandon: "Abandoned",
        notExpanded: "Hide Historical Billing Items",
        expanded: "Show Historical Billing Items",
        priceItem: "Billing Item",
        text: "A cluster, partition, and QOS collectively constitute a billing item. Billing methods "
        + "and prices can be set for billing items.",
        executing: "Executing",
        unset: "Not Set",
        alreadyUsed: "This ID has already been used!",
        addSuccess: "Added successfully!",
        setPrice: "Set Billing Price",
        object: "Object",
        newItemId: "New Price Item ID",
      },
      runningJobDrawer: {
        nodes: "Number of Nodes",
        cores: "Number of Cores",
        gpus: "Number of GPU Cards",
        nodesOrReason: "Explanation",
        runningOrQueueTime: "Running/Queue Time",
        timeLimit: "Job Time Limit (Minutes)",
        detail: "Unfinished Job Details",
      },
      runningJobTable: {
        extendLimit: "Extend Job Time Limit for Selected Jobs",
        batch: "Batch Search",
        precision: "Precision Search",
        nodes: "Number of Nodes",
        cores: "Number of Cores",
        time: "Running/Queue Time",
        reason: "Explanation",
        limit: "Job Time Limit",
        changeLimit: "Modify Job Time Limit",
        gpus: "Number of GPU Cards",
      },
    },
    profile: {
      changeEmailFail: "Failed to change email.",
      changeEmailSuccess: "Email changed successfully!",
      changeEmail: "Change Email",
      oldEmail: "Old Email",
      newEmail: "New Email",
      inputEmail: "Please enter a new email",
      changePasswordSuccess: "Password changed successfully!",
      oldPasswordWrong: "Incorrect old password!",
      changePassword: "Change Password",
      oldPassword: "Old Password",
      newPassword: "New Password",
      confirmPassword: "Confirm Password",
    },
    tenant: {
      accountWhitelistTable: {
        whiteList: "Whitelist Count",
        debtSum: "Total Debt in Whitelist",
        joinTime: "Join Time",
        operatorId: "Operator",
        confirmRemoveWhite: "Confirm removing the account from the whitelist?",
        confirmRemoveWhiteText1: "Confirm removing the account",
        confirmRemoveWhiteText2: "from the whitelist?",
        removeWhiteSuccess: "Successfully removed from the whitelist!",
        removeWhite: "Remove from Whitelist",
      },
      addWhitelistedAccountButton: {
        notExist: "Account does not exist!",
        addSuccess: "Added successfully!",
        addWhiteList: "Add Whitelisted Account",
      },
      adminJobTable: {
        batch: "Batch Search",
        precise: "Precision Search",
        adjust: "Adjust all jobs in search results",
        tenantPrice: "Tenant Billing",
        platformPrice: "Platform Billing",
        jobNumber: "Number of Jobs:",
        tenantPriceSum: "Total Tenant Billing:",
        platformPriceSum: "Total Platform Billing:",
      },
      adminUserTable: {
        allUsers: "All Users",
        tenantAdmin: "Tenant Administrator",
        tenantFinance: "Financial Staff",
        idOrName: "User ID or Name",
        tenantRole: "Tenant Role",
        affiliatedAccountName: "Available Accounts",
        notExist: "User does not exist",
        notAvailable: "This feature is not available in the current configuration",
        changeSuccess: "Modification successful",
        changeFail: "Modification failed",
        changePassword: "Change Password",
      },
      jobPriceChangeModal: {
        tenantPrice: "Tenant Billing",
        platformPrice: "Platform Billing",
        changeJob: "Change Job",
        jobNumber: "Job Number",
        newJob: "New Job",
        reason: "Reason for Modification",
      },
      tenantSelector: {
        fresh: "Refresh Tenant List",
      },
    },
    user: {
      addUserButton: {
        addUser: "Add User",
        notMatch: "The user ID and name you entered do not match.",
        alreadyBelonged: "Already Belonged to Another Tenant",
        notExist: "Tenant or Account Does Not Exist",
        will: "Will be in",
        createModal: "seconds to open the create user interface",
        createFirst: "User does not exist. Please create a user first",
        addSuccess: "Added Successfully!",
      },
      createUserForm: {
        email: "User Email",
        password: "User Password",
        confirm: "Confirm Password",
      },
      createUserModal: {
        alreadyExist: "This user ID already exists!",
        createUser: "Create User",
        notExist: "User does not exist. Please enter new user information to create the user and add it "
        + "to the account.",
        email: "User Email",
        password: "User Password",
        confirm: "Confirm Password",
      },
      jobChargeLimitModal: {
        setSuccess: "Set Successfully",
        priceLimited: "User Job Charge Limit",
        alreadyUsed: "Currently Used/Total Limit",
        cancelPriceLimited: "Cancel Job Charge Limit",
        confirmCancelLimited: "Are you sure you want to cancel the job charge limit for this user in this account?",
        cancelAndNotBlock: "Cancel limit while unblocking",
        cancelSuccess: "Cancellation Successful!",
        cancelLimited: "Cancel Limit",
        unset: "Unset",
        changeLimited: "Change Limit to",
        setLimited: "Set Limit",
      },
      userTable: {
        block: "Block",
        normal: "Normal",
        admin: "Admin",
        user: "Regular User",
        role: "Role",
        alreadyUsed: "Used Quota/User Limit",
        none: "None",
        limitManage: "Limit Management",
        confirmNotBlock: "Confirm unblocking the user?",
        confirmUnsealText1: "Confirm unsealing user from account",
        confirmUnsealText2: "",
        confirmUnsealText3: "?",
        unsealSuccess: "User unsealed successfully!",
        unseal: "Unseal",
        confirmBlock: "Confirm blocking user?",
        confirmBlockText1: "Confirm blocking user from account",
        confirmBlockText2: "",
        blockSuccess: "User blocked successfully!",
        confirmCancelAdmin: "Confirm revoking admin privileges",
        confirmCancelAdminText1: "Confirm revoking user",
        confirmCancelAdminText2: "'s admin privileges in account",
        confirmCancelAdminText3: "?",
        operateSuccess: "Operation successful!",
        cancelAdmin: "Revoke Admin Privileges",
        confirmGrantAdmin: "Confirm granting admin privileges",
        confirmGrantAdminText1: "Confirm granting user",
        confirmGrantAdminText2: "'s admin privileges in account",
        grantAdmin: "Grant Admin Privileges",
        cannotRemove: "Cannot remove account owner",
        confirmRemove: "Confirm removing user",
        confirmRemoveText: "Confirm removing user from account",
        removeSuccess: "User removed successfully!",
        removerUser: "Remove User",
      },
    },
  },
  component: {
    errorPages: {
      notAllowedPage: "Access to this page is not allowed",
      systemNotAllowed: "The system does not allow you to access this page.",
      notAllowed: "Access Not Allowed",
      needLogin: "Login Required",
      notLogin: "You are not logged in or your login session has expired. You need to log in to access this page.",
      login: "Login",
      notExist: "Does Not Exist",
      pageNotExist: "The page you requested does not exist.",
      serverWrong: "Server Error",
      sorry: "Sorry, there was a server error. Please refresh and try again.",
    },
    others: {
      seeDetails: "For details, please refer to the documentation",
      modifyUser: "Modify User",
      password: "'s Password",
      inputNewPassword: "Please enter a new password",
      newPassword: "New Password",
      confirmPassword: "Confirm Password",
      selectCluster: "Select Cluster",
      nodes: "Number of Partition Nodes",
      cores: "Number of Cores per Node",
      gpus: "Number of GPUs per Node",
      mem: "Memory per Node (MB)",
      price: "Price per Unit (CNY)",
      notDefined: "Not Defined",
      description: "Description",
      operationType: "Operation Type",
      operationResult: "Operation Result",
      operatorUserId: "Operator ID",
      operationTime: "Operation Time",
      operationCode: "Operation Code",
      operationDetail: "Operation Details",
      operatorIp: "Operator IP",
      alreadyIs: "User is already in this role",
      notExist: "User does not exist",
      notAuth: "User does not have permission",
      setSuccess: "Set Successfully",
      cannotCancel: "Cannot cancel your own platform admin role",
      alreadyNot: "User is already not in this role",
      selectRole: "Select Role",
    },
  },
  page: {
    noAccount: {
      resultTitle: "No Manageable Accounts",
    },
    _app: {
      clusterOpErrorTitle: "Operation Failed",
      clusterOpErrorContent: "Multiple cluster operations encountered errors, and some clusters were not "
      + "synchronized with the modifications.",
      effectErrorMessage: "Server error occurred!",
    },
    profile: {
      index: {
        accountInfo: "Account Information",
      },
    },
    user: {
      partitions: {
        getBillingTableErrorMessage: "Failed to retrieve cluster and partition information. "
        + "Please contact the administrator.",
        partitionInfo: "Partition Information",
      },
      operationLogs: {
        userOperationLog: "User Operation Log",
      },
      historyJobs: {
        userCompletedJob: "User's Completed Jobs",
      },
    },
    tenant: {
      info: {
        tenantFinanceOfficer: "Tenant Finance Officer",
      },
      jobBillingTable: {
        manageTenantJobPriceTable: "Manage Tenant Job Price Table",
      },
      storage: {
        increase: "Increase",
        decrease: "Decrease",
        set: "Set to",
        userNotFound: "User not found",
        balanceChangeIllegal: "Illegal balance change",
        editSuccess: "Edit Successful!",
        inputUserIdAndCluster: "Please enter User ID and Cluster",
        currentSpace: "Current Space",
        searching: "Searching...",
        clickSearch: "Please click to search",
        storageChange: "Storage Change",
        selectSetTo: "Select Set To",
        adjustUserStorageSpace: "Adjust User Storage Space",
      },
      users: {
        list: {
          title: "User List",
        },
        create: {
          userExist: "User Already Exists",
          userExistMessage: "The user already exists in the SCOW database and cannot be added again.",
          userExistAuth: "User already exists in the authentication system",
          userNotExistAuth: "User does not exist in the authentication system",
          unableDetermineUserExistAuth: "Unable to determine if the user exists in the authentication system",
          userExistAuthMessage: "The user already exists in the authentication system. The password you enter "
          + "here will not be effective, and the new user's password will be the current password of the "
          + "existing user in the authentication system. Click 'Confirm' to add this user directly to the SCOW "
          + "database.",
          userNotExistAuthMessage: "Click 'Confirm' to create this user in both the SCOW database and the "
          + "authentication system.",
          userExistInSCOWDatabaseMessage: "This user already exists in the SCOW database",
          userExistAndAddToSCOWDatabaseMessage: "This user already exists in the authentication system "
          + "and has been successfully added to the SCOW database",
          createUserFail: "Failed to create user",
          addCompleted: "Added Successfully!",
          crateUser: "Create User",
        },
      },
      finance: {
        payments: {
          title: "Payment Records",
        },
        payAccount: {
          title: "Account Payment",
        },
        accountPayments: {
          title: "Account Payment Records",
        },
      },
      accounts: {
        whitelist: {
          title: "Whitelisted Accounts",
          whitelistAccountList: "Whitelisted Account List",
        },
        list: {
          title: "Account List",
        },
        create: {
          tenantNotExistUser: "User {} does not exist under tenant {}.",
          accountNameOccupied: "Account name is already occupied",
          userIdAndNameNotMatch: "User ID and name do not match.",
          createSuccess: "Created Successfully!",
          ownerUserId: "Owner User ID",
          ownerName: "Owner Name",
          remark: "Remark",
          createAccount: "Create Account",
        },
        accountName: {
          users: {
            userId: {
              jobs: {
                userExecJobList: "Job List Executed by {} in {}",
              },
            },
            index: {
              cannotManageUser: "You cannot manage users for account {}.",
              userInAccount: "Users in Account {}",
            },
          },
        },
      },
    },
    init: {
      systemInitialized: "System Initialized",
      unableReinitialize: "The system has already been initialized and cannot be reinitialized!",
    },
    admin: {
      operationLogs: {
        platformOperationLog: "Platform Operation Log",
      },
      jobBilling: {
        jobBillingPriceTable: "Job Billing Price Table",
      },
      importUsers: {
        importUserInfo: "Import User Information",
      },
      tenants: {
        create: {
          adminExist: "Admin User Already Exists",
          adminExistMessage: "The admin user already exists in the SCOW database and cannot be added again.",
          adminNotExistAuth: "Admin user does not exist in the authentication system",
          adminNotExistAuthMessage: "Admin user does not exist. Please confirm that the admin user ID is correct.",
          adminExistAuthMessage: "The admin user already exists in the authentication system. The password you enter "
          + "here will not be effective, and the new user's password will be the current password of the existing user "
          + "in the authentication system. Confirm adding as a new tenant administrator?",
          adminNotExistAuthAndConfirmCreateMessage: "Admin user does not exist in the authentication system. "
          + "Do you want to confirm creating this user and adding as a new tenant administrator?",
          unableConfirmAdminExistInAuthMessage: "Unable to confirm whether the admin user exists in the authentication "
          + "system and will attempt to create it in the authentication system."
          + "If the user already exists in the authentication system, the password you enter here will not "
          + "be effective, and the new user's password will be the current password of the existing user "
          + "in the authentication system.",
          unableConfirmAdminExistInAuthAndUnableCreateMessage: "Unable to confirm whether the admin user exists "
          + "in the authentication system, and the current authentication system does not support creating users. "
          + "Please confirm that this user already exists in the authentication system. "
          + "Confirmation will add it directly to the database, and the password you enter here will not be effective. "
          + "The new user's password will be the current password of the existing user in the authentication system.",
          existInSCOWDatabase: "This {} already exists in the SCOW database",
          createTenantSuccessMessage: "Tenant created successfully, and the admin user exists in the authentication "
          + "system and has been successfully added to the SCOW database",
          addCompleted: "Added Successfully!",
          createTenantFailMessage: "Failed to create tenant",
          createTenant: "Create Tenant",
        },
      },
      systemDebug: {
        slurmBlockStatus: {
          syncUserAccountBlockingStatus: "Synchronize User Account Blocking Status",
          alertInfo: "After the scheduler restarts, the blocking status of users between the cluster and SCOW "
          + "may become unsynchronized. You can click 'Refresh Scheduler User Blocking Status' to "
          + "manually refresh and synchronize all user statuses.",
          slurmScheduler: "Slurm Scheduler",
          slurmSchedulerMessage1: "If you are using the Slurm scheduler, due to technical limitations, "
          + "when you run slurm.sh nodes and the slurm management node are not on the same node,"
          + " blocked users, accounts, and user accounts will be unblocked after the slurm cluster restarts.",
          slurmSchedulerMessage2: "SCOW will automatically refresh the slurm blocking status once "
          + "when starting, but the slurm cluster may restart during SCOW operation, and SCOW cannot react "
          + "to this temporarily.",
          slurmSchedulerMessage3: "So, if you run slurm.sh nodes and the slurm management node are not "
          + "on the same node, you need to manually execute the 'Refresh Scheduler User Blocking Status' "
          + "function on this page after the slurm cluster restarts."
          + " If slurm.sh nodes and the slurm management node are on the same node, you can ignore this function.",
          otherScheduler: "Other Schedulers",
          otherSchedulerMessage: "If you are using a scheduler other than Slurm, when the user blocking status "
          + "is unsynchronized between the scheduler and SCOW, you can manually execute the "
          + "'Refresh Scheduler User Blocking Status' function on this page.",
          lastRunTime: "Last Run Time",
          notBlocked: "Not Blocked",
          refreshSuccess: "Refreshed Successfully",
          refreshSchedulerUserBlockingStatus: "Refresh Scheduler User Blocking Status",
        },
        fetchJobs: {
          jobInfoSync: "Job Information Synchronization",
          alertMessage: "SCOW will periodically synchronize job information from the cluster. "
          + "You can click 'Sync Now' to manually synchronize immediately.",
          periodicSyncJobInfo: "Periodic Job Info Synchronization",
          turnedOn: "Turned On",
          paused: "Paused",
          stopSync: "Stop Synchronization",
          startSync: "Start Synchronization",
          jobSyncCycle: "Job Synchronization Cycle",
          lastSyncTime: "Last Sync Time",
          notSynced: "Not Synchronized",
          jobSyncSuccessMessage: "Job synchronization completed, synchronized to {} new records.",
          syncJobNow: "Sync Now",
        },
      },
      finance: {
        pay: {
          tenantCharge: "Tenant Charge",
        },
        payments: {
          chargeRecord: "Charge Record",
        },
      },
    },
    accounts: {
      accountName: {
        users: {
          title: "Account {} User Management",
        },
        userJob: {
          title: "Jobs Run by User {} in Account {}",
        },
        runningJobs: {
          title: "Unfinished Jobs in Account {}",
        },
        payments: {
          title: "Account {} Payment Records",
        },
        operationLog: {
          title: "Account {} Operation Log",
        },
        historyJobs: {
          title: "Account {} Completed Jobs",
        },
        charges: {
          title: "Account {} Deduction Records",
        },
      },
    },
  },
};
