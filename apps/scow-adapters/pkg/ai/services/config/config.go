package config

import (
	"context"
	"fmt"
	"strings"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	"k8s.io/utils/strings/slices"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/config"
	"scow-adapters/pkg/ai/utils"
	ce "scow-adapters/pkg/common/error"
)

type ServerConfig struct {
	pb.UnimplementedConfigServiceServer
}

func (s *ServerConfig) GetClusterConfig(ctx context.Context, in *pb.GetClusterConfigRequest) (*pb.GetClusterConfigResponse, error) {
	var (
		parts []*pb.Partition // 定义返回的类型
	)
	logrus.Infof("Received request GetClusterConfig: %v", in)

	k8sClient, err := utils.GetK8sClient()
	if err != nil {
		logrus.Errorf("failed to build k8s client: %v", err)
		return nil, ce.RichError(codes.Internal, "NEW_K8S_CLIENT_FAILED", err.Error())
	}

	queues, err := utils.GetQueueList()
	if err != nil {
		logrus.Errorf("Get queue list failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "GET_QUEUE_FAILED", err.Error())
	}

	queueNodes, err := utils.GetQueueNodes(k8sClient)
	if err != nil {
		logrus.Errorf("GetClusterConfig failed: %v", err)
		return nil, ce.RichError(codes.Internal, "GET_NODE_FAILED", err.Error())
	}
	for _, queue := range queues {
		nodes := queueNodes[queue.Name]
		gpuType := queue.Type
		vm := uint64(queue.VramMb)
		parts = append(parts, &pb.Partition{
			Name:                    queue.Name,
			Cores:                   uint32(*queue.CPUCap),
			Nodes:                   uint32(len(nodes)),
			Gpus:                    uint32(*queue.GPUCap),
			MemMb:                   uint64(*queue.MemCap),
			Qos:                     utils.QosList,
			GpuType:                 &gpuType,
			AcceleratorDescriptions: strings.Split(queue.AcceleratorDescriptions, ","),
			GpuModel:                &queue.GPUModel,
			VramMb:                  &vm,
			MaxAcceleratorsPerPod:   &queue.MaxAcceleratorsPerPod,
			CpuModel:                &queue.CPUModel,
		})
	}
	logrus.Infof("GetClusterConfig response: %v", parts)
	return &pb.GetClusterConfigResponse{Partitions: parts, SchedulerName: "volcano"}, nil
}

func (s *ServerConfig) GetAvailablePartitions(ctx context.Context, in *pb.GetAvailablePartitionsRequest) (*pb.GetAvailablePartitionsResponse, error) {
	var (
		parts []*pb.Partition // 定义返回的类型
	)
	logrus.Infof("Received request GetAvailablePartitions: %v", in)

	k8sClient, err := utils.GetK8sClient()
	if err != nil {
		logrus.Errorf("failed to build k8s client: %v", err)
		return nil, ce.RichError(codes.Internal, "NEW_K8S_CLIENT_FAILED", err.Error())
	}

	// 检查账号名是否存在
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

	// 检查用户名是否存在
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

	queues, err := utils.GetQueueList()
	if err != nil {
		logrus.Errorf("GetAvailablePartitions failed: %v", err)
		return nil, ce.RichError(codes.NotFound, "GET_QUEUE_FAILED", err.Error())
	}

	queueNodes, err := utils.GetQueueNodes(k8sClient)
	if err != nil {
		logrus.Errorf("GetClusterConfig failed: %v", err)
		return nil, ce.RichError(codes.Internal, "GET_NODE_FAILED", err.Error())
	}

	account, err := utils.GetAccountByName(in.AccountName)
	if err != nil {
		logrus.Errorf("GetClusterConfig query account %s failed: %v", in.AccountName, err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	if len(account.Partitions) == 0 {
		logrus.Infof("account %s has no authorized partitions", in.AccountName)
		return &pb.GetAvailablePartitionsResponse{}, nil
	}

	for _, queue := range queues {
		if account.Partitions != "" && !slices.Contains(strings.Split(account.Partitions, ","), queue.Name) {
			continue
		}
		nodes := queueNodes[queue.Name]
		gpuType := queue.Type
		vm := uint64(queue.VramMb)
		parts = append(parts, &pb.Partition{
			Name:                    queue.Name,
			Cores:                   uint32(*queue.CPUCap),
			Gpus:                    uint32(*queue.GPUCap),
			MemMb:                   uint64(*queue.MemCap),
			Nodes:                   uint32(len(nodes)),
			Qos:                     utils.QosList,
			GpuType:                 &gpuType,
			AcceleratorDescriptions: strings.Split(queue.AcceleratorDescriptions, ","),
			GpuModel:                &queue.GPUModel,
			VramMb:                  &vm,
			MaxAcceleratorsPerPod:   &queue.MaxAcceleratorsPerPod,
			CpuModel:                &queue.CPUModel,
		})
	}
	logrus.Tracef("GetAvailablePartitions response: %v", parts)
	return &pb.GetAvailablePartitionsResponse{Partitions: parts}, nil
}

func (s *ServerConfig) GetClusterNodesInfo(ctx context.Context, in *pb.GetClusterNodesInfoRequest) (*pb.GetClusterNodesInfoResponse, error) {
	logrus.Infof("Received request GetClusterNodesInfo: %v", in)

	k8sClient, err := utils.GetK8sClient()
	if err != nil {
		logrus.Errorf("failed to build k8s client: %v", err)
		return nil, ce.RichError(codes.Internal, "NEW_K8S_CLIENT_FAILED", err.Error())
	}

	if len(in.NodeNames) != 0 {
		for _, nodeName := range in.NodeNames {
			node, err := utils.GetNodeByName(k8sClient, nodeName)
			if err != nil {
				logrus.Errorf("get node failed, error: %v", err)
				return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
			}
			if node == nil {
				err = fmt.Errorf("node %v not found", nodeName)
				logrus.Errorf("get node failed: %v", err)
				return nil, ce.RichError(codes.NotFound, "NODE_NOT_FOUND", err.Error())
			}
		}
	}

	nodesInfo, err := utils.GetNodesInfo(k8sClient, in.NodeNames)
	if err != nil {
		logrus.Errorf("GetClusterNodesInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	logrus.Debugf("GetClusterNodesInfo Response: %v", nodesInfo)
	return &pb.GetClusterNodesInfoResponse{Nodes: nodesInfo}, nil
}

func (s *ServerConfig) GetClusterInfo(ctx context.Context, in *pb.GetClusterInfoRequest) (*pb.GetClusterInfoResponse, error) {
	logrus.Infof("Received request GetClusterInfo: %v", in)
	k8sClient, err := utils.GetK8sClient()
	if err != nil {
		logrus.Errorf("failed to build k8s client: %v", err)
		return nil, ce.RichError(codes.Internal, "NEW_K8S_CLIENT_FAILED", err.Error())
	}

	allPods, err := utils.AllActivePods(k8sClient)
	if err != nil {
		logrus.Errorf("GetAllActivePods failed: %v", err)
		return nil, err
	}

	clusterName := config.Value.ClusterName
	totalNodes, runningNodes, idleNodes, notAvailableNodes, err := utils.GetClusterNodesStatus(k8sClient, nil, allPods)
	logrus.Debugf("GetPartitionsInfo totalNodes: %v, runningNodes: %v, idleNodes: %v, notAvailableNodes: %v", totalNodes, runningNodes, idleNodes, notAvailableNodes)
	if err != nil {
		return nil, fmt.Errorf("failed get nodes: %v", err)
	}

	// 获取partitionInfo
	parts, err := utils.GetPartitionsInfo(k8sClient, allPods)
	if err != nil {
		logrus.Debugf("GetClusterInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "SQL_QUERY_FAILED", err.Error())
	}

	// 获取整个集群的nodesInfo
	cni, err := utils.GetClusterNodesInfo(k8sClient, parts, allPods, totalNodes, runningNodes, idleNodes, notAvailableNodes)
	if err != nil {
		logrus.Errorf("Failed Get Cluster Info, error: %v", err)
		return nil, ce.RichError(codes.Internal, "K8S_QUERY_FAILED", err.Error())
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

	k8sClient, err := utils.GetK8sClient()
	if err != nil {
		logrus.Errorf("failed to build k8s client: %v", err)
		return nil, ce.RichError(codes.Internal, "NEW_K8S_CLIENT_FAILED", err.Error())
	}

	authorizedPartitions, err := utils.GetAccountsAuthorizedPartitions(in.AccountNames)
	if err != nil {
		logrus.Errorf("GetSummaryClusterInfo failed: %v", err)
		return nil, ce.RichError(codes.Internal, "GET_ACCOUNT_ALLOW_PARTITIONS_FAILED", err.Error())
	}

	if len(authorizedPartitions) == 0 {
		err = fmt.Errorf("the accounts without authorized partitions")
		logrus.Warnf("GetSummaryClusterInfo failed: %v", err)
		return &pb.GetSummaryClusterInfoResponse{}, nil
	}

	// 获取整个集群的nodesInfo
	scni, err := utils.GetSummaryClusterNodesInfo(k8sClient, authorizedPartitions)
	if err != nil {
		logrus.Errorf("Failed Get Cluster Info, error: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	summaryPartitions, err := utils.GetSummaryPartitionsInfo(k8sClient, authorizedPartitions)
	if err != nil {
		logrus.Errorf("Failed Get Cluster Info, error: %v", err)
		return nil, ce.RichError(codes.Internal, "COMMAND_EXECUTE_FAILED", err.Error())
	}

	return &pb.GetSummaryClusterInfoResponse{
		ClusterName:           config.Value.ClusterName,
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
