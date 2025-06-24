
export type I18nStringType = string | {
  i18n: {
    default: string,
    en?: string,
    zh_cn?: string,
  }
};

// languageDic for partitionsManagement
export const languageDic = {
  zh_cn: {
    common : {
      tenant: "租户",
      account: "账户",
      search: "搜索",
      refresh: "刷新",
      add: "添加",
      remove: "移出",
      cancel: "取消",
      confirm: "确定",
      operation: "操作",
      set: "配置",
      assign: "授权",
      unassign: "取消授权",
      cluster: "集群",
      partition: "分区",
      clusterSelectorPlaceholder: "请选择集群",
      partitionSelectorPlaceholder: "请选择分区",
      partitionInputPlaceholder: "请填入分区",
      detail: "详情",
    },
    clusterPartitionManagement: {
      common: {
        head: "授权集群分区",
        assignedClustersCount: "已授权集群数",
        assignedPartitionsCount: "已授权分区数",
        assignCluster: "授权集群",
        assignPartition: "授权分区",
        assignedState: "已授权",
        unAssignedState: "未授权",
        noTenantDisplayedClusters: "当前暂无可以授权的集群，请确认当前在线集群信息",
        noAccountDisplayedClusters: "当前暂无可以授权的集群，请确认当前在线集群信息以及是否已经在租户下授权了集群信息",
        noTenantDisplayedPartitions: "当前暂无可以授权的分区，请确认当前在线集群信息",
        noAccountDisplayedPartitions: "当前暂无可以授权的分区，请确认当前在线集群信息以及是否已经在租户下授权了分区信息",
        someClusterPartitionsFailed: "当前可能存在获取失败的集群分区数据，请检查各集群连接是否正常",
      },
      setPartitionAssignmentModal: {
        title: "配置授权分区",
        tenantAssignedSuccessMessage: "授权租户分区成功",
        tenantUnAssignedMessage: "取消授权租户分区成功",
        accountAssignedSuccessMessage: "授权账户分区成功",
        accountUnassignedSuccessMessage: "取消授权账户分区成功",
        assignContent: "确定在集群 {0} 的分区 {1} 下对 {2} 进行授权吗？",
        unAssignContent: "确定要在集群 {0} 的分区 {1} 下取消对 {2} 的授权吗？",
        unAssignTenantPartitionExplanation: "取消授权后，该租户下所有账户均无法使用该分区  ",
      },
      setClusterAssignmentModal: {
        title: "配置授权集群",
        tenantAssignedSuccessMessage: "授权租户集群成功",
        tenantUnAssignedMessage: "取消授权租户集群成功",
        accountAssignedSuccessMessage: "授权账户集群成功",
        accountUnassignedSuccessMessage: "取消授权账户集群成功",
        assignContent: "确定在集群 {0} 下对 {1} 进行授权吗？",
        unAssignContent: "确定要在集群 {0} 下取消对 {1} 的授权吗？",
        unAssignTenantClusterExplanation: "取消授权后，该集群所有分区均对该租户取消授权 ",
        unAssignAccountClusterExplanation: "取消授权后，该集群所有分区均对该账户取消授权",
      },
      details: {
        tenantName: "租户名",
        accountName: "账户名",
        assignedClustersCount: "已授权集群数",
        assignedClusters: "已授权集群",
        assignedPartitionsCount:"已授权分区数",
        assignedPartitions: "已授权分区",
      },
    },
    accountDefaultClusters: {
      title: "默认授权集群",
      defaultAccountClustersNotFoundError: "无法获取租户下设置的默认授权集群",
      explanation: "新建账户时，会自动添加默认授权集群信息到该账户的授权集群中",
      removeModal: {
        title: "移出默认集群",
        content: "确认从租户 {0} 的默认授权集群下移出集群 {1} 吗？",
        removedSuccessMessage: "已从默认授权集群下移出",
      },
      addModal: {
        title: "添加默认授权集群",
        successMessage: "默认授权集群已添加",
      },
      noDataText: "当前暂无可以添加的集群，请确认租户下是否已有已授权集群。",
    },
    accountDefaultPartitions: {
      title: "默认授权分区",
      defaultAccountPartitionsNotFoundError: "无法获取租户下设置的默认授权分区",
      explanation: "新建账户时，会自动添加默认授权分区信息到该账户的授权分区中",
      addModal: {
        title: "添加默认授权分区",
        successMessage: "默认授权分区已添加",
      },
      removeModal: {
        title: "移出默认授权分区",
        content: "确认从租户 {0} 的默认授权分区下移出分区 {1} 吗？",
        successMessage: "已从租户下设置的默认授权分区移出",
      },
      noDataText: "当前暂无可以添加的分区，请确认租户下是否已有已授权分区。",
    },
    globalMessage: {
      noPartitionsMessage: "无法获取租户授权分区数据，请刷新后重试",
      authFailureMessage: "没有操作权限",
      partitionNotFoundMessage: "没有找到该分区，请刷新后重试",
      assignedPartitionsNotFoundMessage: "无法获取已授权分区信息，请刷新后重试",
      totalPartitionsNotFoundMessage: "无法获取全部分区信息，请刷新后重试",
      currentClustersNotFoundError: "无法获取当前在线集群，请刷新后重试",
      currentClusterPartitionsNotFoundError: "无法获取当前在线集群分区信息，请刷新后重试",
      clusterNotFoundError: "无法找到该集群，请刷新后重试",
      partitionNotFoundError: "无法找到该分区，请刷新后重试",
      tenantNotFound: "无法获取租户名，请刷新后重试",
      unassignPartitionWithoutAssignedClusterWarn: "集群暂未被授权，无法授权分区。请先授权集群信息。",
      tenantAssignedClustersNotFound: "无法获取租户已授权的集群数据，请刷新后重试",
    },
  },
  en: {
    common: {
      tenant: "Tenant",
      account: "Account",
      search: "Search",
      refresh: "Refresh",
      add: "Add",
      remove: "Remove",
      cancel: "Cancel",
      confirm: "Confirm",
      operation: "Operation",
      set: "Set",
      assign: "Assign",
      unassign: "Unassign",
      cluster: "Cluster",
      partition: "Partition",
      clusterSelectorPlaceholder: "Please select a cluster",
      partitionSelectorPlaceholder: "Please select a partition",
      partitionInputPlaceholder: "Please enter a partition",
      detail: "Detail",
    },
    clusterPartitionManagement: {
      common: {
        head: "Assign Cluster Partitions",
        assignedClustersCount: "Assigned Clusters Count",
        assignedPartitionsCount: "Assigned Partitions Count",
        assignCluster: "Assign Cluster",
        assignPartition: "Assign Partition",
        assignedState: "Assigned",
        unAssignedState: "Unassigned",
        noTenantDisplayedClusters: "There are currently no clusters available for authorization. "
        + "Please verify the current online cluster information.",
        noAccountDisplayedClusters: "There are currently no clusters available for authorization. "
        + "Please verify the current online cluster information and whether any cluster information "
        + "has already been authorized under the tenant.",
        noTenantDisplayedPartitions: "There are currently no partitions available for authorization. "
        + "Please verify the current online cluster information.",
        noAccountDisplayedPartitions: "There are currently no partitions available for authorization. "
        + "Please verify the current online cluster information and whether any partition information "
        + "has already been authorized under the associated tenant.",
        someClusterPartitionsFailed: "There may be some cluster partition data retrieval failures. "
        + "Please check the connectivity of each cluster.",
      },
      setPartitionAssignmentModal: {
        title: "Set Partition Assignment",
        tenantAssignedSuccessMessage: "Successfully assigned tenant partition",
        tenantUnAssignedMessage: "Successfully unassigned tenant partition",
        accountAssignedSuccessMessage: "Successfully assigned account partition",
        accountUnassignedSuccessMessage: "Successfully unassigned account partition",
        assignContent: "Are you sure you want to assign the partition {1} of the cluster {0} to {2}?",
        unAssignContent: "Are you sure you want to unassign"
        + " the partition {1} of the cluster {0} from the {2}?",
        unAssignTenantPartitionExplanation: "After revoking authorization, "
        + "all accounts under this tenant will be unable to use this partition.",
      },
      setClusterAssignmentModal: {
        title: "Set Cluster Assignment",
        tenantAssignedSuccessMessage: "Successfully assigned tenant cluster",
        tenantUnAssignedMessage: "Successfully unassigned tenant cluster",
        accountAssignedSuccessMessage: "Successfully assigned account cluster",
        accountUnassignedSuccessMessage: "Successfully unassigned account cluster",
        assignContent: "Are you sure you want to assign {1} in the cluster {0}?",
        unAssignContent: "Are you sure you want to unassign the {1} in the cluster {0}?",
        unAssignTenantClusterExplanation: "After revoking authorization, "
        + "all partitions of this cluster will be unauthorized for the tenant.",
        unAssignAccountClusterExplanation: "After revoking authorization, "
        + "all partitions of this cluster will be unauthorized for the account.",
      },
      details: {
        tenantName: "Tenant Name",
        accountName: "Account Name",
        assignedClustersCount: "Assigned Clusters Count",
        assignedClusters: "Assigned Clusters",
        assignedPartitionsCount: "Assigned Partitions Count",
        assignedPartitions: "Assigned Partitions",
      },
    },
    accountDefaultClusters: {
      title: "Default Assigned Clusters",
      defaultAccountClustersNotFoundError: "Unable to retrieve the default assigned clusters set for the tenant",
      explanation: "When creating a new account, default authorized cluster information will be automatically "
      + "added to the account's authorized clusters.",
      removeModal: {
        title: "Remove Default Cluster",
        content: "Are you sure you want to remove cluster {1} from the default assigned clusters of tenant {0}?",
        removedSuccessMessage: "Successfully removed from the default assigned clusters",
      },
      addModal: {
        title: "Add Default Cluster",
        successMessage: "Successfully added to the default assigned clusters",
      },
      noDataText: "No clusters are available to add at the moment. "
      + "Please confirm if the tenant already has authorized clusters.",
    },
    accountDefaultPartitions: {
      title: "Default Assigned Partitions",
      defaultAccountPartitionsNotFoundError: "Unable to retrieve the default assigned partitions set for the tenant",
      explanation: "When creating a new account, default authorized partition information will be automatically "
      + "added to the account's authorized partitions.",
      addModal: {
        title: "Add Default Partition",
        successMessage: "Successfully added to the default assigned partitions",
      },
      removeModal: {
        title: "Remove Default Partition",
        content: "Are you sure you want to remove partition {1} from the default assigned partitions of tenant {0}?",
        successMessage: "Successfully removed from the tenant's default assigned partitions",
      },
      noDataText: "No partitions are available to add at the moment. "
      + "Please confirm if the tenant already has authorized partitions.",
    },
    globalMessage: {
      noPartitionsMessage: "Unable to retrieve tenant's assigned partitions. Please refresh and try again",
      authFailureMessage: "You do not have permission to perform this action",
      partitionNotFoundMessage: "Partition not found. Please refresh and try again",
      assignedPartitionsNotFoundMessage: "Unable to retrieve assigned partitions. Please refresh and try again",
      totalPartitionsNotFoundMessage: "Unable to retrieve all partitions. Please refresh and try again",
      currentClustersNotFoundError: "Unable to retrieve current online clusters. Please refresh and try again",
      currentClusterPartitionsNotFoundError: "Unable to retrieve current online clusters and their partitions. "
      + "Please refresh and try again",
      clusterNotFoundError: "Cluster not found. Please refresh and try again",
      partitionNotFoundError: "Partition not found. Please refresh and try again",
      tenantNotFound: "Unable to retrieve tenant name. Please refresh and try again",
      unassignPartitionWithoutAssignedClusterWarn: "Unable to assign partition "
      + "if the cluster has not been authorized. Please authorize the cluster first.",
      tenantAssignedClustersNotFound: "Unable to retrieve tenant's assigned clusters. Please refresh and try again",
    },
  },
};

export type I18nDicType = typeof languageDic.zh_cn;
