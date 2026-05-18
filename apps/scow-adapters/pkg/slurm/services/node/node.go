package node

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/slurm/client"
	"scow-adapters/pkg/slurm/utils"
)

type ServerNode struct {
	pb.UnimplementedNodeServiceServer
}

var stateNameRe = regexp.MustCompile(`State=(\S+)`)

func (s *ServerNode) RemoveNodeFromCluster(ctx context.Context, req *pb.RemoveNodeFromClusterRequest) (*pb.RemoveNodeFromClusterResponse, error) {
	logrus.Infof("Start remove node from cluster, node name: %v", req.NodeName)
	exists, err := utils.CheckNodeExists(req.NodeName)
	if err != nil {
		logrus.Errorf("Remove node failed, error: %v", err)
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !exists {
		logrus.Errorf("Remove node failed, node %v not found", req.NodeName)
		return nil, status.Errorf(codes.NotFound, "node %s not found", req.NodeName)
	}

	if err = utils.DrainNode(req.NodeName); err != nil {
		logrus.Errorf("Remove node failed: %v", err)
		return nil, status.Errorf(codes.Internal, "remove node failed: %v", err)
	}

	hasJobs, err := utils.CheckRunningJobsOnNode(req.NodeName)
	if err != nil {
		logrus.Errorf("Remove node failed, get job error: %v", err)
		if err = utils.ResumeNode(req.NodeName); err != nil {
			logrus.Errorf("resume node failed: %v", err)
			return nil, status.Errorf(codes.Internal, "add node failed: %v", err)
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	if hasJobs {
		logrus.Errorf("Remove node failed, node %v have running job", req.NodeName)
		if err = utils.ResumeNode(req.NodeName); err != nil {
			logrus.Errorf("resume node failed: %v", err)
			return nil, status.Errorf(codes.Internal, "add node failed: %v", err)
		}
		return nil, status.Errorf(codes.FailedPrecondition, "node %s has running jobs", req.NodeName)
	}

	success := checkNodeState(5, req.NodeName, "DRAIN")
	if !success {
		err = fmt.Errorf("scontrol down node %s failed", req.NodeName)
		logrus.Errorf("Remove node failed: %v", err)
		return nil, status.Errorf(codes.Internal, "remove node failed: %v", err)
	}

	logrus.Infof("remove node success, node name: %v", req.NodeName)
	return &pb.RemoveNodeFromClusterResponse{}, nil
}

func (s *ServerNode) AddNodeToCluster(ctx context.Context, req *pb.AddNodeToClusterRequest) (*pb.AddNodeToClusterResponse, error) {
	logrus.Infof("Start add node to cluster, node name: %v", req.NodeName)
	exists, err := utils.CheckNodeExists(req.NodeName)
	if err != nil {
		logrus.Errorf("Add node failed, error: %v", err)
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !exists {
		logrus.Errorf("Add node failed, node %v not found", req.NodeName)
		return nil, status.Errorf(codes.NotFound, "node %s not found", req.NodeName)
	}

	if err = utils.ResumeNode(req.NodeName); err != nil {
		logrus.Errorf("Add node failed: %v", err)
		return nil, status.Errorf(codes.Internal, "add node failed: %v", err)
	}

	success := checkNodeState(5, req.NodeName, "IDLE")
	if !success {
		err = fmt.Errorf("scontrol resume node %s failed", req.NodeName)
		logrus.Errorf("add node failed: %v", err)
		return nil, status.Errorf(codes.Internal, "add node failed: %v", err)
	}

	logrus.Infof("add node success, node name: %v", req.NodeName)
	return &pb.AddNodeToClusterResponse{}, nil
}

func checkNodeState(maxAttempts int, nodeName, nodeState string) bool {
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		logrus.Tracef("check node status for the %v time", attempt)
		getNodesInfoCmd := client.SCONTROL + " show node " + nodeName + " --oneliner"
		output, err := utils.RunCommand(getNodesInfoCmd)
		if err != nil {
			return false
		}

		// 检查节点状态
		state := extractValue(output, stateNameRe)
		logrus.Tracef("current node status: %v", state)
		logrus.Tracef("The state of the node at the checkpoint: %v", nodeState)
		if strings.Contains(state, nodeState) && !strings.Contains(state, "NOT_RESPONDING") {
			return true
		}

		// 递增延迟
		delay := attempt
		time.Sleep(time.Duration(delay) * time.Second)
	}
	return false
}

// extractValue 使用预编译正则表达式提取值
func extractValue(input string, re *regexp.Regexp) string {
	matches := re.FindStringSubmatch(input)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}
