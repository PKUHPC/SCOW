package config

import (
	"context"
	"fmt"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"

	craneProtos "scow-adapters/gen/crane"
	protos "scow-adapters/gen/go"
	ce "scow-adapters/pkg/common/error"
	"scow-adapters/pkg/crane/client"
	"scow-adapters/pkg/crane/utils"
)

type ServerConfig struct {
	protos.UnimplementedConfigServiceServer
}

func (s *ServerConfig) GetClusterConfig(ctx context.Context, in *protos.GetClusterConfigRequest) (*protos.GetClusterConfigResponse, error) {
	var partitions []*protos.Partition
	logrus.Infof("Received request GetClusterConfig: %v", in)

	// 获取系统Qos
	qosList, err := utils.GetAllQos()
	if err != nil {
		logrus.Errorf("GetClusterConfig Error getting QoS: %v", err)
		return nil, ce.RichError(codes.Internal, "Error getting QoS", err.Error())
	}

	partitions, err = utils.GetCraneClusterConfig(nil, qosList)
	if err != nil {
		logrus.Errorf("GetClusterConfig error: %v", err)
		return nil, err
	}

	logrus.Tracef("GetClusterConfig %v", partitions)
	return &protos.GetClusterConfigResponse{Partitions: partitions, SchedulerName: "Crane"}, nil
}

func (s *ServerConfig) GetAvailablePartitions(ctx context.Context, in *protos.GetAvailablePartitionsRequest) (*protos.GetAvailablePartitionsResponse, error) {
	logrus.Infof("Received request GetAvailablePartitions: %v", in)
	var partitions []*protos.Partition

	// 获取账户信息
	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("GetAvailablePartitions err: %v", err)
		return nil, ce.RichError(codes.Unavailable, "CRANE_INTERNAL_ERROR", err.Error())
	}

	logrus.Tracef("GetAvailablePartitions account info: %v", account)
	logrus.Tracef("GetAvailablePartitions account users: %v", account.GetUsers())

	if account.GetBlocked() {
		return &protos.GetAvailablePartitionsResponse{}, nil
	}

	// 判断账户是否包含用户
	if !utils.Contains(account.GetUsers(), in.UserId) {
		err = fmt.Errorf("user: %v is not in Account: %v", in.UserId, in.AccountName)
		logrus.Errorf("GetAvailablePartitions err: %v", err)
		return nil, err
	}

	// 获取账户的allowPartitions
	allowPartitions := account.GetAllowedPartitions()
	if len(allowPartitions) == 0 {
		return &protos.GetAvailablePartitionsResponse{}, nil
	}

	// 获取账户的allowQos
	allowQos := account.GetAllowedQosList()

	partitions, err = utils.GetCraneClusterConfig(allowPartitions, allowQos)
	if err != nil {
		logrus.Errorf("GetAvailablePartitions err: %v", err)
		return nil, err
	}

	logrus.Tracef("GetAvailablePartitions %v", partitions)
	return &protos.GetAvailablePartitionsResponse{Partitions: partitions}, nil
}

func (s *ServerConfig) GetClusterNodesInfo(ctx context.Context, in *protos.GetClusterNodesInfoRequest) (*protos.GetClusterNodesInfoResponse, error) {
	var nodesInfo []*protos.NodeInfo
	logrus.Infof("Received request GetClusterNodesInfo: %v", in)

	request := &craneProtos.QueryCranedInfoRequest{}
	info, err := client.CraneCtld.QueryCranedInfo(context.Background(), request)
	if err != nil {
		logrus.Errorf("GetClusterNodesInfo failed: %v", err)
		return nil, err
	}

	logrus.Tracef("GetClusterNodesInfo nodeInfo%v", info.GetCranedInfoList())

	for _, cranedInfo := range info.GetCranedInfoList() {
		nodeInfo := utils.ExtractNodeInfo(cranedInfo)
		logrus.Tracef("GetClusterNodesInfo node: %v, Info: %v", cranedInfo.GetHostname(), info.GetCranedInfoList())
		nodesInfo = append(nodesInfo, nodeInfo)
	}

	logrus.Tracef("GetClusterNodesInfoResponse: %v", nodesInfo)
	return &protos.GetClusterNodesInfoResponse{Nodes: nodesInfo}, nil
}

func (s *ServerConfig) GetClusterInfo(ctx context.Context, in *protos.GetClusterInfoRequest) (*protos.GetClusterInfoResponse, error) {
	var partitions []*protos.PartitionInfo
	logrus.Infof("Received request GetClusterInfo: %v", in)
	for _, part := range client.CConfig.Partitions { // 遍历每个计算分区、分别获取信息  分区从接口获取
		var state protos.PartitionInfo_PartitionStatus
		// 根据分区名获取分区信息
		partitionName := part.Name

		partitionInfo, err := utils.GetPartitionByName(partitionName)
		if err != nil {
			logrus.Errorf("GetClusterInfo failed: %v", err)
			return nil, ce.RichError(codes.Internal, "GetClusterInfo failed", err.Error())
		}
		logrus.Tracef("GetClusterInfo partition info: %v", partitionInfo)

		// 获取正在运行作业的个数
		runningJob, err := utils.GetTaskByPartitionAndStatus([]string{partitionName}, []craneProtos.TaskStatus{craneProtos.TaskStatus_Running})
		if err != nil {
			logrus.Errorf("GetClusterInfo failed: %v", err)
			return nil, ce.RichError(codes.Internal, "CRANE_RUNCOMMAND_ERROR", err.Error())
		}
		runningJobNum := len(runningJob)

		// 获取正在排队作业的个数
		pendingJob, err := utils.GetTaskByPartitionAndStatus([]string{partitionName}, []craneProtos.TaskStatus{craneProtos.TaskStatus_Pending})
		if err != nil {
			logrus.Errorf("GetClusterInfo failed: %v", err)
			return nil, ce.RichError(codes.Internal, "CRANE_RUNCOMMAND_ERROR", err.Error())
		}
		pendingJobNum := len(pendingJob)

		idleNodeCount, allocNodeCount, mixNodeCount, downNodeCount, err := utils.GetNodeByPartition([]string{partitionName})
		if err != nil {
			logrus.Errorf("GetClusterInfo failed: %v", err)
			return nil, ce.RichError(codes.Internal, "CRANE_RUNCOMMAND_ERROR", err.Error())
		}
		logrus.Tracef("GetClusterInfo idleNodeCount, allocNodeCount, mixNodeCount, downNodeCount: %v, %v, %v, %v", idleNodeCount, allocNodeCount, mixNodeCount, downNodeCount)

		runningNodes := allocNodeCount + mixNodeCount
		resultRatio := float64(runningNodes) / float64(partitionInfo.GetTotalNodes())
		percentage := int(resultRatio * 100) // 保留整数
		if partitionInfo.GetState() == craneProtos.PartitionState_PARTITION_UP {
			state = protos.PartitionInfo_AVAILABLE
		} else {
			state = protos.PartitionInfo_NOT_AVAILABLE
		}
		TotalCpu := partitionInfo.GetResTotal().GetAllocatableRes().GetCpuCoreLimit()
		AllocCpu := partitionInfo.GetResAlloc().GetAllocatableRes().GetCpuCoreLimit()
		AvailCpu := partitionInfo.GetResAvail().GetAllocatableRes().GetCpuCoreLimit()
		IdleCpu := TotalCpu - AllocCpu
		NotAvailableCpu := TotalCpu - AvailCpu - AllocCpu

		TotalGpu := utils.GetGpuNumsFromPartition(partitionInfo.GetResTotal().GetDeviceMap())
		AllocGpu := utils.GetGpuNumsFromPartition(partitionInfo.GetResAlloc().GetDeviceMap())
		AvailGpu := utils.GetGpuNumsFromPartition(partitionInfo.GetResAvail().GetDeviceMap())
		IdleGpu := TotalGpu - AllocGpu
		NotAvailableGpu := TotalGpu - AvailGpu - AllocGpu

		partitions = append(partitions, &protos.PartitionInfo{
			PartitionName:         partitionInfo.GetName(),
			NodeCount:             partitionInfo.GetTotalNodes(),
			RunningNodeCount:      runningNodes,
			IdleNodeCount:         idleNodeCount,
			NotAvailableNodeCount: partitionInfo.GetTotalNodes() - partitionInfo.GetAliveNodes(),
			CpuCoreCount:          uint32(TotalCpu),
			RunningCpuCount:       uint32(AllocCpu),
			IdleCpuCount:          uint32(IdleCpu),
			NotAvailableCpuCount:  uint32(NotAvailableCpu),
			GpuCoreCount:          TotalGpu,
			RunningGpuCount:       AllocGpu,
			IdleGpuCount:          IdleGpu,
			NotAvailableGpuCount:  NotAvailableGpu,
			JobCount:              uint32(runningJobNum) + uint32(pendingJobNum),
			RunningJobCount:       uint32(runningJobNum),
			PendingJobCount:       uint32(pendingJobNum),
			UsageRatePercentage:   uint32(percentage),
			PartitionStatus:       state,
		})

	}

	logrus.Tracef("GetClusterInfo Partitions info: %v", partitions)
	return &protos.GetClusterInfoResponse{ClusterName: client.CConfig.ClusterName, Partitions: partitions}, nil
}

func (s *ServerConfig) GetSummaryClusterInfo(ctx context.Context, in *protos.GetSummaryClusterInfoRequest) (*protos.GetSummaryClusterInfoResponse, error) {
	logrus.Tracef("Received request GetSummaryClusterInfo: %v", in)

	clusterName := client.CConfig.ClusterName

	authorizedPartitions, err := utils.GetAccountsAuthorizedPartitions(in.AccountNames)
	if err != nil {
		logrus.Errorf("GetSummaryClusterInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "GET_ACCOUNT_ALLOW_PARTITIONS_FAILED", err.Error())
	}

	if len(authorizedPartitions) == 0 {
		err = fmt.Errorf("the accounts without authorized partitions")
		logrus.Errorf("GetSummaryClusterInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_WITHOUT_ALLOW_PARTITIONS", err.Error())
	}

	// 获取整个集群的nodesInfo
	scni, err := utils.GetSummaryClusterNodesInfo(authorizedPartitions)
	if err != nil {
		logrus.Errorf("Failed Get Cluster Info, error: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	summaryPartitions, err := utils.GetSummaryPartitionsInfo(authorizedPartitions)
	if err != nil {
		logrus.Errorf("Failed Get Cluster Info, error: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	return &protos.GetSummaryClusterInfoResponse{
		ClusterName:           clusterName,
		Partitions:            summaryPartitions,
		NodeCount:             scni.NodeCount,
		RunningNodeCount:      scni.RunningNodeCount,
		IdleNodeCount:         scni.IdleNodeCount,
		NotAvailableNodeCount: scni.NotAvailableNodeCount,
		CpuCoreCount:          scni.CpuCoreCount,
		RunningCpuCount:       scni.RunningCpuCount,
		IdleCpuCount:          scni.IdleCpuCount,
		NotAvailableCpuCount:  scni.NotAvailableCpuCount,
		GpuCoreCount:          scni.GpuCoreCount,
		RunningGpuCount:       scni.RunningGpuCount,
		IdleGpuCount:          scni.IdleGpuCount,
		NotAvailableGpuCount:  scni.NotAvailableGpuCount,
		RunningJobCount:       scni.RunningJobCount,
		PendingJobCount:       scni.PendingJobCount,
		NodeUsage:             scni.NodeUsage,
		CpuUsage:              scni.CpuUsage,
		GpuUsage:              scni.GpuUsage,
	}, nil
}

func (s *ServerConfig) ListImplementedOptionalFeatures(ctx context.Context, in *protos.ListImplementedOptionalFeaturesRequest) (*protos.ListImplementedOptionalFeaturesResponse, error) {
	var features []protos.OptionalFeatures
	management := protos.OptionalFeatures_RESOURCE_MANAGEMENT

	features = append(features, management)

	return &protos.ListImplementedOptionalFeaturesResponse{Features: features}, nil
}
