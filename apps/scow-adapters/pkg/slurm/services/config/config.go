package config

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"

	pb "scow-adapters/gen/go"
	ce "scow-adapters/pkg/common/error"
	"scow-adapters/pkg/slurm/config"
	"scow-adapters/pkg/slurm/slurm_config_cache"
	"scow-adapters/pkg/slurm/utils"
)

type ServerConfig struct {
	pb.UnimplementedConfigServiceServer
	SlurmConfCache *slurm_config_cache.System
}

func (s *ServerConfig) GetClusterConfig(ctx context.Context, in *pb.GetClusterConfigRequest) (*pb.GetClusterConfigResponse, error) {
	logrus.Tracef("Received request GetClusterConfig: %v", in)

	parts, err := s.SlurmConfCache.GetPartitions(nil)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	logrus.Tracef("GetClusterConfig: %v", &pb.GetClusterConfigResponse{Partitions: parts, SchedulerName: "slurm"})
	return &pb.GetClusterConfigResponse{Partitions: parts, SchedulerName: "slurm"}, nil
}

func (s *ServerConfig) GetAvailablePartitions(ctx context.Context, in *pb.GetAvailablePartitionsRequest) (*pb.GetAvailablePartitionsResponse, error) {
	logrus.Tracef("Received request GetAvailablePartitions: %v", in)

	var (
		parts              []*pb.Partition
		whitelistPartition []string
	)
	// 检查用户名中是否包含大写字母
	if err := utils.CheckUser(in.UserId); err != nil {
		logrus.Errorf("GetAvailablePartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "USER_CONTAIN_ILLEGAL_CHARACTERS", err.Error())
	}

	// 检查账号名是否在slurm中
	exist, err := utils.SelectAccountExists(in.AccountName)
	if err != nil {
		logrus.Errorf("GetAvailablePartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("account %s not found", in.AccountName)
		logrus.Errorf("GetAvailablePartitions failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "ACCOUNT_NOT_FOUND", err.Error())
	}

	// 检查用户名是否在slurm中
	exist, err = utils.SelectUserExists(in.UserId)
	if err != nil {
		logrus.Errorf("GetAvailablePartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}
	if !exist {
		err = fmt.Errorf("user %s not found", in.UserId)
		logrus.Errorf("GetAvailablePartitions failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_NOT_FOUND", err.Error())
	}

	// 检查账户和用户之间是否存在关联关系，不存在直接退出，存在则进行下面的获取partition信息的步骤
	if err := utils.CheckUserAndAccountAssociate(in.UserId, in.AccountName); err != nil {
		logrus.Errorf("GetAvailablePartitions failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "USER_ACCOUNT_NOT_FOUND", err.Error())
	}

	// 这里只按资源授权过滤分区。账户欠费封锁只限制提交和运行，不能隐藏用户已有权限的资源。
	whitelistPartition, err = utils.GetAccountAuthorizedPartitionsInDatabase(in.AccountName)
	if err != nil {
		logrus.Errorf("GetAvailablePartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if whitelistPartition == nil {
		return &pb.GetAvailablePartitionsResponse{Partitions: nil}, nil
	}

	// assoc_table 中分区名为小写，需还原为 scontrol 中的真实大小写
	whitelistPartition, err = utils.NormalizePartitionNames(whitelistPartition)
	if err != nil {
		logrus.Errorf("GetAvailablePartitions failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	parts, err = s.SlurmConfCache.GetPartitions(whitelistPartition)
	if err != nil {
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	logrus.Tracef("GetAvailablePartitions for account %s: %v", in.AccountName, &pb.GetAvailablePartitionsResponse{Partitions: parts})
	return &pb.GetAvailablePartitionsResponse{Partitions: parts}, nil
}

func (s *ServerConfig) GetClusterNodesInfo(ctx context.Context, in *pb.GetClusterNodesInfoRequest) (*pb.GetClusterNodesInfoResponse, error) {
	logrus.Tracef("Received request GetClusterNodesInfo: %v", in)

	var (
		nodesResult string
		nodesInfo   []*pb.NodeInfo
		err         error
	)

	if len(in.NodeNames) != 0 {
		loginNodes, err := utils.GetLoginNodesInfo()
		if err != nil {
			logrus.Errorf("GetClusterNodesInfo get login node failed: %v", err)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}

		for _, nodeName := range in.NodeNames {
			if utils.Contains(loginNodes, nodeName) {
				err = fmt.Errorf("node %v not found", nodeName)
				logrus.Errorf("get node failed: %v", err)
				return nil, ce.RichError(codes.NotFound, "NODE_NOT_FOUND", err.Error())
			}
			exists, err := utils.CheckNodeExists(nodeName)
			if err != nil {
				logrus.Errorf("get node failed, error: %v", err)
				return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
			}
			if !exists {
				err = fmt.Errorf("node %v not found", nodeName)
				logrus.Errorf("get node failed: %v", err)
				return nil, ce.RichError(codes.NotFound, "NODE_NOT_FOUND", err.Error())
			}
		}
	}

	info, err := utils.GetNodesJsonInfo(in.NodeNames)
	if err == nil && config.SlurmValue.Json.Enabled {
		logrus.Tracef("parse node information using JSON parsing")
		jsonData := []byte(info)
		var nodesJson *utils.NodesJson
		if err := json.Unmarshal(jsonData, &nodesJson); err != nil {
			logrus.Errorf("GetClusterNodesInfo unmarshal nodes failed: %v", err)
			return nil, ce.RichError(codes.Internal, "UNMARSHAL_NODES_FAILED", err.Error())
		}

		nodesInfo = utils.GetClusterNodeByJsonConcurrently(nodesJson)
	} else {
		logrus.Tracef("parse node information using command-line parsing")
		nodesResult, err = utils.GetNodesInfo(in.NodeNames)
		if err != nil {
			logrus.Errorf("GetClusterNodesInfo failed: %v", err)
			return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
		}

		nodesInfo = utils.GetClusterNodeConcurrently(nodesResult)
	}

	logrus.Tracef("GetClusterNodesInfo finished, nodes count: %d", len(nodesInfo))
	return &pb.GetClusterNodesInfoResponse{Nodes: nodesInfo}, nil
}

func (s *ServerConfig) GetClusterInfo(ctx context.Context, in *pb.GetClusterInfoRequest) (*pb.GetClusterInfoResponse, error) {
	logrus.Tracef("Received request GetClusterInfo: %v", in)
	clusterName := config.SlurmValue.MySQLConfig.ClusterName

	// 获取partitionInfo
	parts, err := utils.GetPartitionsInfoBySInfo()
	if err != nil {
		logrus.Errorf("GetClusterInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	// 获取整个集群的nodesInfo
	cni, err := utils.GetClusterNodesInfo(parts)
	if err != nil {
		logrus.Errorf("Failed Get Cluster Info, error: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	return &pb.GetClusterInfoResponse{
		ClusterName:           clusterName,
		Partitions:            parts,
		NodeCount:             cni.NodeCount,
		RunningNodeCount:      cni.RunningNodeCount,
		IdleNodeCount:         cni.IdleNodeCount,
		NotAvailableNodeCount: cni.NotAvailableNodeCount,
		CpuCoreCount:          cni.CpuCoreCount,
		RunningCpuCount:       cni.RunningCpuCount,
		IdleCpuCount:          cni.IdleCpuCount,
		NotAvailableCpuCount:  cni.NotAvailableCpuCount,
		GpuCoreCount:          cni.GpuCoreCount,
		RunningGpuCount:       cni.RunningGpuCount,
		IdleGpuCount:          cni.IdleGpuCount,
		NotAvailableGpuCount:  cni.NotAvailableGpuCount,
		JobCount:              cni.JobCount,
		RunningJobCount:       cni.RunningJobCount,
		PendingJobCount:       cni.PendingJobCount,
	}, nil
}

func (s *ServerConfig) GetSummaryClusterInfo(ctx context.Context, in *pb.GetSummaryClusterInfoRequest) (*pb.GetSummaryClusterInfoResponse, error) {
	logrus.Tracef("Received request GetSummaryClusterInfo: %v", in)

	clusterName := config.SlurmValue.MySQLConfig.ClusterName

	// 仪表盘只按资源授权关系筛选分区，整体欠费封锁账户仍参与授权分区并集和资源统计。
	accountPartitionBlockInfo, err := utils.GetAccountAuthorizedPartitionByAssociation()
	if err != nil {
		logrus.Errorf("GetSummaryClusterInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	// 对请求中的所有账户取分区并集
	seen := make(map[string]struct{})
	for _, acct := range in.AccountNames {
		for _, p := range accountPartitionBlockInfo[acct].AllowedPartitions {
			seen[p] = struct{}{}
		}
	}
	authorizedPartitions := make([]string, 0, len(seen))
	for p := range seen {
		authorizedPartitions = append(authorizedPartitions, p)
	}
	if len(authorizedPartitions) == 0 {
		err = fmt.Errorf("the accounts without authorized partitions")
		logrus.Errorf("GetSummaryClusterInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_WITHOUT_ALLOW_PARTITIONS", err.Error())
	}

	// assoc_table 中分区名可能滞后于 Slurm，需还原真实大小写并丢弃已不存在的分区。
	authorizedPartitions, err = utils.NormalizeExistingPartitionNames(authorizedPartitions)
	if err != nil {
		logrus.Errorf("GetSummaryClusterInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}
	if len(authorizedPartitions) == 0 {
		err = fmt.Errorf("the accounts without existing authorized partitions")
		logrus.Errorf("GetSummaryClusterInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "ACCOUNT_WITHOUT_ALLOW_PARTITIONS", err.Error())
	}

	authorizedPartitionsNodes, err := utils.GetAuthorizedPartitionsNodes(authorizedPartitions)
	if err != nil {
		logrus.Errorf("GetSummaryClusterInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	// 获取partitionInfo
	parts, err := utils.GetPartitionsInfoBySInfo()
	if err != nil {
		logrus.Errorf("GetSummaryClusterInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	// 获取整个集群的nodesInfo
	scni, err := utils.GetSummaryClusterNodesInfo(parts, authorizedPartitionsNodes, authorizedPartitions)
	if err != nil {
		logrus.Errorf("Failed Get Cluster Info, error: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	summaryPartitions := utils.GetSummaryPartitionInfo(parts, authorizedPartitions)

	logrus.Tracef("GetSummaryClusterInfo finished, nodes: %d, partitions: %d", scni.NodeCount, len(summaryPartitions))
	return &pb.GetSummaryClusterInfoResponse{
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

func (s *ServerConfig) ListImplementedOptionalFeatures(ctx context.Context, in *pb.ListImplementedOptionalFeaturesRequest) (*pb.ListImplementedOptionalFeaturesResponse, error) {
	var features []pb.OptionalFeatures
	management := pb.OptionalFeatures_RESOURCE_MANAGEMENT

	features = append(features, management)

	return &pb.ListImplementedOptionalFeaturesResponse{Features: features}, nil
}
