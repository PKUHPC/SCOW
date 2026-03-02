// languageDic for partitionsManagement
export const languageDic = {
  zh_cn: {
    common : {
      tenant: "租户",
      account: "账户",
      accountOwner: "账户拥有者",
      searchOwnerText: "拥有者ID或姓名",
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
        someClusterPartitionsFailed: "{} 集群分区数据获取失败，请检查集群连接是否正常",
        accountsAssignedInfoFetchFailed: "账户授权集群分区信息获取失败。",
        tenantsAssignedInfoFetchFailed: "租户授权集群分区信息获取失败。",
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
        accountOwner: "账户拥有者",
        assignedClustersCount: "已授权集群数",
        assignedClusters: "已授权集群",
        assignedPartitionsCount:"已授权分区数",
        assignedPartitions: "已授权分区",
      },
    },
    accountDefaultClusters: {
      title: "默认授权集群",
      defaultAccountClustersNotFoundError: "无法获取租户下设置的默认授权集群",
      explanation1: "默认授权集群是该租户下的一个集群组，它影响租户内的所有账户，具体如下：",
      explanation2: "新建账户时，该账户的初始授权集群即默认授权集群；",
      explanation3: "将集群添加或者移出默认授权集群时，所有账户的授权集群也同步添加或移出该集群；",
      removeModal: {
        title: "移出默认集群",
        content: "确认从租户 {0} 的默认授权集群下移出集群 {1} 吗？",
        removeWarn: "移出默认授权集群后，该租户下所有账户均同步取消该集群及集群下分区的授权",
        removedSuccessMessage: "已从默认授权集群下移出",
        successExplanation: "以下账户 {} 同步取消授权时失败，请管理员确认。",
      },
      addModal: {
        title: "添加默认授权集群",
        addWarn: "添加默认授权集群后，该租户下所有账户均同步添加该集群的授权",
        successMessage: "默认授权集群已添加",
        successExplanation: "以下账户 {} 同步授权时失败，请管理员确认。",
      },
      noDataText: "当前暂无可以添加的集群，请确认租户下是否已有已授权集群。",
    },
    accountDefaultPartitions: {
      title: "默认授权分区",
      defaultAccountPartitionsNotFoundError: "无法获取租户下设置的默认授权分区",
      explanation1: "默认授权分区是该租户下的一个分区组，它影响租户内的所有账户，具体如下：",
      explanation2: "新建账户时，该账户的初始授权分区即默认授权分区；",
      explanation3: "将分区添加或者移出默认授权分区时，所有账户的授权分区也同步添加或移出该分区；",
      addModal: {
        title: "添加默认授权分区",
        addWarn: "添加默认授权分区后，该租户下所有账户均同步添加该分区及分区所属集群的授权",
        successMessage: "默认授权分区已添加",
        successExplanation: "以下账户 {} 同步授权时失败，请管理员确认。",
      },
      removeModal: {
        title: "移出默认授权分区",
        content: "确认从租户 {0} 的默认授权分区下移出分区 {1} 吗？",
        removeWarn: "移出默认授权分区后，该租户下所有账户均同步取消该分区的授权",
        successMessage: "已从租户下设置的默认授权分区移出",
        successExplanation: "以下账户 {} 同步取消授权时失败，请管理员确认。",
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
      partitionsNotFound: "未获取到集群 {} 分区数据，无法对分区进行授权相关操作",
    },
  },
  en: {
    common: {
      tenant: "Tenant",
      account: "Account",
      accountOwner: "Account Owner",
      searchOwnerText: "Owner id or name",
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
        someClusterPartitionsFailed: "{} partition data retrieval failed. "
        + "Please check the connectivity of clusters.",
        accountsAssignedInfoFetchFailed: "Failed to fetch account assigned cluster partition information.",
        tenantsAssignedInfoFetchFailed: "Failed to fetch tenant assigned cluster partition information.",
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
        accountOwner: "Account Owner",
        assignedClustersCount: "Assigned Clusters Count",
        assignedClusters: "Assigned Clusters",
        assignedPartitionsCount: "Assigned Partitions Count",
        assignedPartitions: "Assigned Partitions",
      },
    },
    accountDefaultClusters: {
      title: "Default Assigned Clusters",
      defaultAccountClustersNotFoundError: "Unable to retrieve the default assigned clusters set for the tenant",
      explanation1: "A default authorized cluster is a cluster group under the tenant that affects all accounts "
      + "within the tenant, specifically as follows:",
      explanation2: "When creating a new account, the initial authorized cluster for that account will be the "
      + "default authorized cluster;",
      explanation3: "When adding or removing a cluster from the default authorized cluster, the authorized "
      + "clusters for all accounts will be synchronously added or removed accordingly;",
      removeModal: {
        title: "Remove Default Cluster",
        removeWarn: "After removing the default authorized cluster, all accounts under the tenant will "
        + "synchronously have their authorization for the cluster and its partitions revoked.",
        content: "Are you sure you want to remove cluster {1} from the default assigned clusters of tenant {0}?",
        removedSuccessMessage: "Successfully removed from the default assigned clusters",
        successExplanation: "The following accounts {} failed to synchronously revoke authorization. "
        + "Please confirm with the administrator.",
      },
      addModal: {
        title: "Add Default Cluster",
        addWarn: "After adding the default authorized cluster, all accounts under the tenant "
        + "will synchronously be granted authorization for the cluster.",
        successMessage: "Successfully added to the default assigned clusters",
        successExplanation: "The following accounts {} failed to synchronize authorization. "
        + "Please confirm with the administrator.",
      },
      noDataText: "No clusters are available to add at the moment. "
      + "Please confirm if the tenant already has authorized clusters.",
    },
    accountDefaultPartitions: {
      title: "Default Assigned Partitions",
      defaultAccountPartitionsNotFoundError: "Unable to retrieve the default assigned partitions set for the tenant",
      explanation1: "A default authorized partition is a partition group under the tenant that affects all accounts "
      + "within the tenant, specifically as follows:",
      explanation2: "When creating a new account, the initial authorized partition for that account will be the "
      + "default authorized partition;",
      explanation3: "When adding or removing a partition from the default authorized partition, the authorized "
      + "partitions for all accounts will be synchronously added or removed accordingly;",
      addModal: {
        title: "Add Default Partition",
        addWarn: "After adding the default authorized partition, all accounts under the tenant will synchronously be "
        + "granted authorization for the partition and its parent cluster.",
        successMessage: "Successfully added to the default assigned partitions",
        successExplanation: "The following accounts {} failed to synchronize authorization. "
        + "Please confirm with the administrator.",
      },
      removeModal: {
        title: "Remove Default Partition",
        removeWarn: "After removing the default authorized partition, all accounts under the tenant will "
        + "synchronously have their authorization for the partition revoked.",
        content: "Are you sure you want to remove partition {1} from the default assigned partitions of tenant {0}?",
        successMessage: "Successfully removed from the tenant's default assigned partitions",
        successExplanation: "The following accounts {} failed to synchronously revoke authorization. "
        + "Please confirm with the administrator.",
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
      partitionsNotFound: "The partition data for the cluster {} could not be retrieved, and therefore, "
      + "authorization-related operations for the partition cannot be performed.",
    },
  },
};

export type I18nDicType = typeof languageDic.zh_cn;

export const optionalLanguageDic: Record<string, I18nDicType> = {};


