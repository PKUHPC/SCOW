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
    linkTextMis: "Admin",
    linkTextAI: "SCOW AI",
  },
  // routes
  routes: {
    dashboard: "Dashboard",
    job: {
      title: "Jobs",
      runningJobs: "Running Jobs",
      allJobs: "All Jobs",
      submitJob: "Submit Job",
      jobTemplates: "Job Templates",
    },
    desktop: "Desktop",
    apps: {
      title: "Applications",
      appSessions: "Created Apps",
      createApp: "Create App",
    },
    file: {
      fileManager: "Files",
      crossClusterFileTransfer: "File Transfer",
      clusterFileManager: "Clusters",
      transferProgress: "Transfer Progress",
    },
  },
  // button
  button: {
    searchButton: "Search",
    refreshButton: "Refresh",
    cancelButton: "Cancel",
    confirmButton: "Confirm",
    selectButton: "Select",
    actionButton: "Action",
    deleteButton: "Delete",
    renameButton: "Rename",
    finishButton: "Finish",
    detailButton: "Details",
    submitButton: "Submit",
    closeButton: "Close",
    startButton: "Start",
  },
  // pageComp
  pageComp: {
    // profile
    profile: {
      changPasswordModal: {
        successMessage: "Password changed successfully",
        errorMessage: "Incorrect original password",
        changePassword: "Change Password",
        oldPassword: "Old Password",
        newPassword: "New Password",
        confirm: "Confirm Password",
        userNotExist:"User Not Exist",
        unavailable:"This feature is not available in the current configuration",
      },
    },
    // job
    job: {
      accountSelector: {
        selectAccountPlaceholder: "Select Account",
        refreshAccountList: "Refresh Account List",
      },
      partitionSelector: {
        selectPartitionPlaceholder: "Select Partition",
        refreshPartitionList: "Refresh Partition List",
      },
      allJobsTable: {
        searchForm: {
          clusterLabel: "Cluster",
          time: "Time",
          popoverTitle: "Query all active jobs (such as job submission, pending, started, running, "
          + "failed, completed) in this time range",
          jobId: "Job ID",
        },
        tableInfo: {
          jobId: "Job ID",
          jobName: "Job Name",
          account: "Account",
          partition: "Partition",
          qos: "QOS",
          state: "State",
          submitTime: "Submission Time",
          startTime: "Start Time",
          endTime: "End Time",
          elapsed: "Elapsed Time",
          timeLimit: "Job Time Limit",
          reason: "Reason",
          more: "More",
          linkToPath: "Go to Directory",
        },
      },
      // fileSelectModal
      fileSelectModal: {
        title: "File Directory Selection Box",
        newPath: "New Directory",
      },
      // jobTemplateModal
      jobTemplateModal: {
        clusterLabel: "Cluster",
        errorMessage: "Template does not exist!",
        changeSuccessMessage: "Modified successfully!",
        changTemplateName: "Change Template Name",
        newTemplateName: "New Template Name",
        templateName: "Template Name",
        comment: "Comment",
        useTemplate: "Use Template",
        popConfirm: "Are you sure you want to delete this template?",
        deleteSuccessMessage: "Template has been deleted!",
      },
      // runningJobDrawer
      runningJobDrawer: {
        cluster: "Cluster",
        jobId: "Job ID",
        account: "Account",
        jobName: "Job Name",
        partition: "Partition",
        qos: "QOS",
        nodes: "Number of Nodes",
        cores: "Number of Cores",
        gpus: "Number of GPU Cards",
        state: "State",
        nodesOrReason: "Reason",
        runningOrQueueTime: "Running/Queue Time",
        submissionTime: "Submission Time",
        timeLimit: "Job Time Limit (minutes)",
        drawerTitle: "Details of Running Jobs",
      },
      // runningJobTable
      runningJobTable: {
        filterForm: {
          cluster: "Cluster",
          jobId: "Job ID",
        },
        jobInfoTable: {
          cluster: "Cluster",
          jobId: "Job ID",
          account: "Account",
          name: "Job Name",
          partition: "Partition",
          qos: "QOS",
          nodes: "Nodes",
          cores: "Cores",
          gpus: "GPUs",
          state: "State",
          runningOrQueueTime: "Running/Pending Time",
          nodesOrReason: "Reason",
          timeLimit: "Time Limit",
          more: "More",
          linkToPath: "Go to Directory",
          popConfirm: "Are you sure you want to cancel this job?",
          successMessage: "Job cancellation request has been submitted!",
        },
      },
      // submitJobForm
      submitJobForm: {
        errorMessage: "Failed to submit job",
        successMessage: "Submitted successfully! Your new job ID is: ",
        cluster: "Cluster",
        jobName: "Name",
        command: "Command",
        account: "Account",
        partition: "Partition",
        qos: "QOS",
        nodeCount: "Number of Nodes",
        gpuCount: "Number of GPU Cards per Node",
        coreCount: "Number of CPU Cores per Node",
        maxTime: "Maximum Running Time",
        requireMaxTime: "Please enter the maximum runtime",
        minute: "Minutes",
        hours:"Hours",
        days: "Days",
        workingDirectory: "Working Directory",
        wdTooltip1: "1. Please enter the absolute path. If you enter a relative path, it will be "
        + "relative to the user's home directory.",
        wdTooltip2: "2. If the specified directory is not accessible or cannot be operated on, "
        + "the job submission or execution will fail.",
        wdTooltip3: "2.This file is used to save the script returned by the adapter"
        + "The default value refers to the output file.",
        output: "Standard Output File",
        errorOutput: "Error Output File",
        saveJobSubmissionFile:"Save Job Submission File",
        totalNodeCount: "Total Nodes: ",
        totalGpuCount: "Total GPUs: ",
        totalCoreCount: "Total CPU Cores: ",
        totalMemory: "Total Memory: ",
        comment: "Comment",
        saveToTemplate: "Save as Template",
      },
    },
    fileManagerComp: {
      clusterFileTable: {
        fileName: "File Name",
        modificationDate: "Modification Date",
        size: "Size",
        permission: "Permission",
        notShowHiddenItem: "Do not show hidden items",
        showHiddenItem: "Show hidden items",
      },
      singleCrossClusterTransferSelector: {
        placeholder: "Please select a cluster",
      },
      transferInfoTable: {
        srcCluster: "Origin Cluster",
        dstCluster: "Destination Cluster",
        file: "File",
        transferCount: "Transfer Count",
        transferSpeed: "Transfer Speed",
        timeLeft: "Time Remaining",
        currentProgress: "Current Progress",
        operation: "Operation",
        confirmCancelTitle: "Confirm Cancellation",
        confirmCancelContent: "Are you sure you want to cancel the transfer of the file {} from {} to {}?",
        confirmOk: "Confirm",
        cancelSuccess: "Cancellation Successful",
        cancel: "Cancel",
      },
      fileEditModal: {
        edit: "Edit",
        prompt: "Prompt",
        save: "Save",
        doNotSave: "Do Not Save",
        notSaved: "Not Saved",
        notSavePrompt: "The file has not been saved, do you want to save this file?",
        fileEdit: "File Edit",
        filePreview: "File Preview",
        fileLoading: "File is loading...",
        exitEdit: "Exit Edit Mode",
        failedGetFile: "Failed to get file: {}",
        cantReadFile: "Cannot read file: {}",
        saveFileFail: "File save failed: {}",
        saveFileSuccess: "File saved successfully",
        fileSizeExceeded: "File too large (maximum {}), please download and edit",
        fileFetchAbortPrompt: "Fetch {} operation was aborted",
      },
      createFileModal: {
        createErrorMessage: "File or directory with the same name already exists!",
        createSuccessMessage: "Created successfully",
        create: "Create File",
        fileDirectory: "Directory to Create File",
        fileName: "File Name",
      },
      fileManager: {
        preview: {
          cantPreview: "File too large (maximum {}) or format not supported, please download to view",
        },
        moveCopy: {
          copy: "Copy",
          move: "Move",
          modalErrorTitle: "Error {} {}",
          existModalTitle: "File/Directory Already Exists",
          existModalContent: "File/Directory {} already exists. Do you want to overwrite it?",
          existModalOk: "Confirm",
          errorMessage: "{} error! A total of {} files/directories, {} succeeded, {} abandoned, {} failed",
          successMessage: "{} succeeded! A total of {} files/directories, {} succeeded, {} abandoned",
        },
        delete: {
          confirmTitle: "Confirm Deletion",
          confirmOk: "Confirm",
          confirmContent: "Are you sure you want to delete selected {}?",
          successMessage: "Deleted {} successfully!",
          errorMessage: "Deleted {} items, failed {} items",
          otherErrorMessage: "Error occurred while performing delete operation",
        },
        tableInfo: {
          title: "{} Files",
          uploadButton: "Upload File",
          deleteSelected: "Delete Selected",
          copySelected: "Copy Selected",
          moveSelected: "Move Selected",
          paste: "Paste Here",
          operationStarted: "{} in progress, completed: ",
          operationNotStarted: "Selected {} {} items",
          notShowHiddenItem: "Do not Show Hidden Items",
          showHiddenItem: "Show Hidden Items",
          openInShell: "Open in Terminal",
          createFile: "New File",
          mkDir: "New Directory",
          download: "Download",
          rename: "Rename",
          deleteConfirmTitle: "Confirm Deletion",
          deleteConfirmContent: "Confirm deletion of {}?",
          deleteConfirmOk: "Confirm",
          deleteSuccessMessage: "Deleted successfully",
          submitConfirmTitle: "Submit Confirmation",
          submitConfirmNotice: "Please ensure that the script file specifies a valid absolute path "
          + "as its working directory. If a working directory is not specified, the directory containing "
          + "the script file will be designated as the default working directory.",
          submitConfirmContent: "Confirm submission of {} to {}?",
          submitConfirmOk: "Confirm",
          submitSuccessMessage: "Submitted successfully! Your new job ID is: {}",
          submitFailedMessage: "Submitted Failed",
        },
      },
      fileTable: {
        fileName: "File Name",
        changeTime: "Modification Date",
        size: "Size",
        mode: "Permissions",
        action: "Action",
      },
      mkDirModal: {
        existedErrorMessage: "File or directory with the same name already exists!",
        successMessage: "Created successfully",
        title: "Create Directory",
        mkdirLabel: "Directory to Create",
        dirName: "Directory Name",
      },
      renameModal: {
        successMessage: "Renamed successfully",
        title: "Rename File",
        renameLabel: "File to Rename",
        newFileName: "New File Name",
      },
      uploadModal: {
        title: "Upload File",
        uploadRemark1: "File will be uploaded to: ",
        uploadRemark2: ". Files with the same name will be overwritten. ",
        uploadRemark3: "Maximum file size for single upload: ",
        uploadRemark4: ".",
        cancelUpload: "Cancel Upload",
        deleteUploadRecords: "Delete Upload Records",
        successMessage: "Uploaded successfully",
        errorMessage: "Upload failed",
        maxSizeErrorMessage: "{} upload failed, file size exceeded {} ",
        existedModalTitle: "File/Directory Already Exists",
        existedModalContent: "File/Directory {} already exists. Do you want to overwrite it?",
        existedModalOk: "Confirm",
        dragText: "Click or drag files here",
        hintText: "Supports uploading single or multiple files",
        multipartUploadError: "Upload file failed: {}",
        calculateHashError: "Error calculating hash: {}",
        uploadFileListNotExist: "The uploaded file list does not exist: {}",
        mergeFileChunksErrorText: "Failed to merge file {}, please try again",
      },
    },
    // desktop
    desktop: {
      desktopTable: {
        tableItem: {
          title: "Desktop ID",
          desktopName: "Desktop Name",
          wm: "Desktop Type",
          addr: "Address",
          createTime: "Creation Time",
        },
        filterForm: {
          cluster: "Cluster",
          loginNode: "Login Node",
          createNewDesktop: "Create New Desktop",
        },
      },
      desktopTableActions: {
        popConfirmTitle: "This action is irreversible. Are you sure you want to delete?",
      },
      newDesktopModal: {
        error: {
          tooManyTitle: "Failed to Create Desktop",
          tooManyContent: "The number of desktops in this cluster has reached its maximum limit.",
        },
        modal: {
          createNewDesktop: "Create New Desktop",
          loginNode: "Login Node",
          wm: "Desktop",
          desktopName: "Desktop Name",
        },
      },
    },
    // app
    app: {
      appSessionTable: {
        table: {
          sessionId: "Job Name",
          jobId: "Job ID",
          appId: "Application",
          submitTime: "Submission Time",
          state: "Status",
          remainingTime: "Remaining Time",
          popFinishConfirmTitle: "Are you sure you want to cancel this job?",
          popFinishConfirmMessage: "Job cancelation request has been submitted.",
          popCancelConfirmTitle: "Are you sure you want to cancel this job?",
          popCancelConfirmMessage: "Job cancellation request has been submitted.",
          linkToPath: "Enter Directory",
        },
        filterForm: {
          appJobName: "Job Name",
          autoRefresh: "Auto-refresh every 10s",
          onlyNotEnded: "Show only running jobs",
        },
      },
      connectToAppLink: {
        notFoundMessage: "Application session does not exist.",
        notConnectableMessage: "Application cannot be connected now, please wait.",
        notReady: "Application is not ready yet.",
        connect: "Connect",
      },
      createApps: {
        notFoundMessage: "No interactive application available for creation.",
        loading: "Loading available interactive applications...",
        create: "Create",
      },
      launchAppForm: {
        errorMessage: "Failed to create application.",
        successMessage: "Successfully created.",
        loading: "Retrieving last submission records...",
        appJobName: "Job Name",
        account: "Account",
        partition: "Partition",
        qos: "QOS",
        nodeCount: "Node Count",
        gpuCount: "GPU Cards per Node",
        coreCount: "CPU Cores per Node",
        maxTime: "Maximum Running Time",
        minute: "Minutes",
        totalGpuCount: "Total GPU Cards",
        totalCpuCount: "Total CPU Cores",
        totalMemory: "Total Memory Capacity",
        appCommentTitle: "Explanation",
      },
    },
    dashboard:{
      addEntryModal:{
        addQuickEntry:"Add links",
        cancel:"cancel",
      },
      changeClusterModal:{
        selectCluster:"Select Cluster",
        cluster:"cluster",
        loginNode:"Login node",
      },
      quickEntry:{
        quickEntry:"Links",
        finish:"Finish",
        cancel:"Cancel",
        edit:"Edit",
      },
      sortable:{
        alreadyExist:"Link already exists",
        exceedMaxSize:"Up to 10 quickEntries can be added",
        saveFailed:"Save failed",
        saveSuccessfully:"Save succeeded",
      },
      overviewTable:{
        title:"Platform overview",
        clusterName:"Cluster",
        partitionName:"Partition",
        nodeCount:"All nodes",
        pendingJobCount:"Pending Jobs",
        cpuUsage:"CPU",
        gpuUsage:"GPU",
        usageRatePercentage:"Nodes",
        partitionStatus:"Status",
        available:"Available",
        notAvailable:"Error",
      },
      infoPanes:{
        nodeInfo:"Nodes",
        node:"Nodes",
        resourceInfo:"CPU & GPU",
        core:"Core",
        running:"Running",
        idle:"idle",
        notAvailable:"Error",
        card:"Card",
        job:"Job",
        pending:"Pending",
        platformOverview:"Platform Overview",
        totalNodes:"Total Nodes",
        totalCores:"Total Cores",
        totalCards:"Total Cards",
      },
      nodeRange:{
        jobs:"Jobs",
        running:"Running",
        pending:"Pending",
      },
      infoPane:{
        nodeUtilization:"Node Utilization",
      },
      doubleInfoPane:{
        CPUCoreUsage:"CPU Core Usage",
        GPUCoreUsage:"GPU Core Usage",
      },
      titleContainer:{
        available:"Available",
      },
    },
  },
  component: {
    errorPages: {
      notAllowedPage: "Access to this page is not allowed.",
      systemNotAllowed: "The system does not allow access to this page.",
      notAllowed: "Access Denied",
      needLogin: "Login Required",
      notLogin: "You are either not logged in or your login session has expired. "
      + "You need to login to access this page.",
      login: "Login",
      notExist: "Does Not Exist",
      pageNotExist: "The page you requested does not exist.",
      serverWrong: "Server Error",
      sorry: "Sorry, there was a server error. Please refresh and try again.",
      clusterNotAvailable: "The cluster you are currently accessing is unavailable or there are no available clusters. "
      + " Please try again later or contact the administrator.",
    },
    others: {
      clusterSelector: "Please select a cluster.",
    },
  },
  pages: {
    apps: {
      create: {
        title: "Create ",
        error404: "App does not exist",
      },
      createApps: {
        subTitle: "The requested cluster does not exist",
        title: "Create App",
        pageTitle: "Create an App on {}",
      },
      sessions: {
        subTitle: "The requested cluster does not exist",
        title: "Interactive Apps",
        pageTitle: "{} Interactive Apps",
      },
    },
    desktop: {
      title: "Desktop",
      pageTitle: "Desktop on Login Node",
    },
    files: {
      path: {
        subTitle: "The requested cluster does not exist",
        title: "Files",
      },
      fileTransfer: {
        confirmTransferTitle: "Confirm to start transfer?",
        confirmTransferContent: "Are you sure to transfer from {} to {}?",
        confirmOk: "Confirm",
        transferStartInfo: "Transfer task has started",
        transferTitle: "Cross-cluster file transfer",
      },
      currentTransferInfo: {
        checkTransfer: "Check file transfer progress",
      },
    },
    jobs: {
      allJobs: {
        title: "aLL Jobs",
        pageTitle: "My Jobs",
      },
      runningJobs: {
        title: "Running Jobs",
        pageTitle: "My Running Jobs",
      },
      savedJobs: {
        title: "Job Templates",
        pageTitle: "My Job Templates",
      },
      submit: {
        title: "Submit Job",
        pageTitle: "Submit Job",
        spin: "Loading job templates",
      },
    },
    profile: {
      title: "Account Information",
      userInfo: "User Information",
      identityId: "User ID",
      name: "User Name",
      changePassword: "Change Password",
      loginPassword: "Login Password",
    },
    shell: {
      loginNode: {
        title: "Terminal",
        content: "Connected to {}  {} node with ID: {}",
        reloadButton: "Refresh and Reconnect",
        popoverTitle: "Commands",
        popoverContent1: "Navigate to the file system ",
        popoverContent2: "After entering this command, you will navigate to the file system, where you "
        + "can upload and download files.",
        popoverContent3: "Download a file",
        popoverContentFile: "File Name",
        popoverContent4: "By entering",
        popoverContent5: ", the file in your current path will be downloaded locally. ",
        popoverContent6: "Relative paths are not supported at the moment. "
        + "If you need to download or edit files from other directories, please use",
        popoverContent7: "command to navigate to the file system.",
        popoverContent8: "Usage example: ",
        popoverContent9: "Edit a file",
        popoverContent10: "After entering the command ",
        popoverContent11: ", you will be redirected to a file editing page where you can edit the specified file. ",
        popoverContent12: "Upload files ",
        popoverContent13: "By entering this command, you can upload local files to the current directory.",

        command: "Command",
      },
      index: {
        title: "Terminal",
        content: "Launch terminal for the following clusters: ",
      },
    },
    _app: {
      sshError: "Unable to connect as a user to the login node. Please make sure the permissions "
      + "of your home directory are 700, 750, or 755.",
      textExceedsLength:"There are too many terminal login prompts. "
                        + "Please reduce unnecessary information output in files such as'~/. bashrc'!",
      sftpError: "SFTP operation failed. Please confirm if you have the necessary permissions.",
      otherError: "Server encountered an error!",
      adapterConnectionError: "The {} cluster is currently unreachable. Please try again later. ",
      noActivatedClusters: "No available clusters. Please try again after refreshing the page.",
      notExistInActivatedClusters: "The cluster(s) being queried may have been deactivated. "
      + "Please try again after refreshing the page.",
      noClusters: "Unable to find cluster configuration files. Please contact the system administrator.",
    },
    dashboard: {
      title: "Dashboard",
    },
    common: {
      noAvailableClusters: "There are currently no available clusters."
      + " Please try again later or contact the administrator.",
    },
  },
};
