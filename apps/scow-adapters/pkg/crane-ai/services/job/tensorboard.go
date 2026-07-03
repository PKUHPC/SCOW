package job

import (
	"os"
	"strings"

	"github.com/sirupsen/logrus"

	craneProtos "scow-adapters/gen/crane-ai"
	protos "scow-adapters/gen/go"
	"scow-adapters/pkg/crane-ai/utils"
)

func (s *ServerJob) getTensorBoardInfo(
	jobId uint32,
	status craneProtos.JobStatus,
	_ string,
	stepList []*craneProtos.StepInfo,
) *protos.JobInfo_TensorboardInfo {
	if s.JM == nil {
		return &protos.JobInfo_TensorboardInfo{}
	}
	info, err := s.JM.QueryJobInfo(jobId)
	if err != nil {
		logrus.Infof("[TensorBoard] no tensorboard info for job %d: %v", jobId, err)
		return &protos.JobInfo_TensorboardInfo{}
	}
	if strings.TrimSpace(info.TensorBoardLogPath) == "" {
		return &protos.JobInfo_TensorboardInfo{}
	}
	if status != craneProtos.JobStatus_Running {
		logrus.Infof("[TensorBoard] tensorboard is unavailable for main job %d: job status is %s", jobId, status.String())
		if err := utils.GlobalProxyManager.StopAndRemoveProxy(jobId); err != nil {
			logrus.Warnf("[TensorBoard] cleanup tensorboard proxy failed for main job %d: %v", jobId, err)
		}
		return &protos.JobInfo_TensorboardInfo{}
	}

	step := tensorBoardStep(stepList)
	if step == nil {
		logrus.Infof("[TensorBoard] tensorboard step not found for main job %d", jobId)
		return &protos.JobInfo_TensorboardInfo{}
	}
	node := stepExecutionNode(step)
	if node == "" {
		logrus.Infof("[TensorBoard] tensorboard node not found for main job %d", jobId)
		return &protos.JobInfo_TensorboardInfo{}
	}
	proxyInfo, err := utils.LoadJobProxyMetaByPort(jobId, utils.TensorBoardPort)
	if err != nil {
		logrus.Errorf("[TensorBoard] load proxy metadata failed for main job %d: %v", jobId, err)
		return &protos.JobInfo_TensorboardInfo{}
	}
	containerIP, err := utils.GetContainerIPByExec(jobId, step.GetStepId(), step.GetUid(), node)
	if err != nil {
		logrus.Errorf("[TensorBoard] get tensorboard container IP failed for main job %d step %d: %v", jobId, step.GetStepId(), err)
		return &protos.JobInfo_TensorboardInfo{}
	}
	proxyTargetChanged := tensorBoardProxyTargetChanged(proxyInfo, containerIP)
	if proxyInfo == nil || proxyTargetChanged || !utils.GlobalProxyManager.IsProxyRunning(proxyInfo) {
		proxyPort := info.TensorBoardPort
		if proxyInfo != nil && proxyInfo.ProxyPort > 0 {
			proxyPort = proxyInfo.ProxyPort
		}
		if proxyPort > 0 {
			if proxyTargetChanged {
				if err := utils.GlobalProxyManager.StopAndRemoveProxy(jobId); err != nil {
					logrus.Warnf("[TensorBoard] remove stale tensorboard proxy failed for main job %d: %v", jobId, err)
				}
			}
			if err := utils.GlobalProxyManager.CreateAndStartProxyWithPort(
				info.JobName, jobId, containerIP, utils.TensorBoardPort, proxyPort,
			); err != nil {
				logrus.Errorf("[TensorBoard] create tensorboard proxy failed for main job %d: %v", jobId, err)
				return &protos.JobInfo_TensorboardInfo{}
			}
		} else {
			proxy := &utils.SubmitJobProxyInfo{
				JobName: info.JobName,
				JobId:   jobId,
				ForwardInfo: []*utils.JobForwardInfo{
					{
						ExecutionNode: node,
						StepId:        step.GetStepId(),
						ContainerPort: utils.TensorBoardPort,
						ContainerIP:   containerIP,
					},
				},
			}
			if err := utils.GlobalProxyManager.CreateAndStartProxy(proxy); err != nil {
				logrus.Errorf("[TensorBoard] create tensorboard proxy failed for main job %d: %v", jobId, err)
				return &protos.JobInfo_TensorboardInfo{}
			}
		}

		proxyInfo, err = utils.LoadJobProxyMetaByPort(jobId, utils.TensorBoardPort)
		if err != nil {
			logrus.Errorf("[TensorBoard] reload proxy metadata failed for main job %d: %v", jobId, err)
			return &protos.JobInfo_TensorboardInfo{}
		}
	}
	if proxyInfo == nil || proxyInfo.ProxyPort == 0 {
		logrus.Errorf("[TensorBoard] tensorboard proxy metadata not found for main job %d", jobId)
		return &protos.JobInfo_TensorboardInfo{}
	}
	if info.TensorBoardPort != proxyInfo.ProxyPort {
		info.TensorBoardPort = proxyInfo.ProxyPort
		if err := s.JM.SaveJobInfo(info); err != nil {
			logrus.Warnf("[TensorBoard] save tensorboard proxy port failed for main job %d: %v", jobId, err)
		}
	}
	hostname, _ := os.Hostname()
	logrus.Infof("[TensorBoard] return tensorboard info for main job %d: node=%s port=%d", jobId, hostname, proxyInfo.ProxyPort)
	return &protos.JobInfo_TensorboardInfo{
		Node: hostname,
		Port: int32(proxyInfo.ProxyPort),
	}
}

func tensorBoardProxyTargetChanged(proxyInfo *utils.ProxyMeta, containerIP string) bool {
	if proxyInfo == nil {
		return false
	}
	targetIP, _, err := utils.ParseTargetAddr(proxyInfo.TargetAddr)
	if err != nil {
		logrus.Warnf("[TensorBoard] parse tensorboard proxy target %s failed: %v", proxyInfo.TargetAddr, err)
		return true
	}
	return strings.TrimSpace(targetIP) != strings.TrimSpace(containerIP)
}

func tensorBoardStep(stepList []*craneProtos.StepInfo) *craneProtos.StepInfo {
	for _, step := range stepList {
		if isTensorBoardStep(step) {
			return step
		}
	}
	return nil
}

func stepExecutionNode(step *craneProtos.StepInfo) string {
	if step == nil {
		return ""
	}
	if nodes := step.GetExecutionNode(); len(nodes) > 0 {
		return strings.TrimSpace(nodes[0])
	}
	return firstNodeFromNodeList(step.GetCranedList())
}

func isTensorBoardStep(step *craneProtos.StepInfo) bool {
	if step == nil {
		return false
	}
	if containerMeta := step.GetContainerMeta(); containerMeta != nil {
		if image := containerMeta.GetImage(); image != nil && image.GetImage() == utils.TensorboardImage {
			return true
		}
		if strings.Contains(strings.Join(containerMeta.GetArgs(), " "), utils.TensorBoardEntryScript) {
			return true
		}
	}
	cmdLine := step.GetCmdLine()
	return strings.Contains(cmdLine, utils.TensorboardImage) ||
		strings.Contains(cmdLine, utils.TensorBoardEntryScript)
}

func firstNodeFromNodeList(nodeList string) string {
	nodeList = strings.TrimSpace(nodeList)
	if nodeList == "" {
		return ""
	}
	fields := strings.FieldsFunc(nodeList, func(r rune) bool {
		return r == ',' || r == ' ' || r == '\n' || r == '\t'
	})
	if len(fields) == 0 {
		return ""
	}
	return strings.TrimSpace(fields[0])
}
