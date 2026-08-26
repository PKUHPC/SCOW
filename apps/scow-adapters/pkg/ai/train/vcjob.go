package train

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/codes"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/dynamic"
	k8sclient "k8s.io/client-go/kubernetes"
	volcanoclientset "volcano.sh/apis/pkg/client/clientset/versioned"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/config"
	"scow-adapters/pkg/ai/db/models"
	"scow-adapters/pkg/ai/resourcecleanup"
	"scow-adapters/pkg/ai/utils"
	ce "scow-adapters/pkg/common/error"
)

type VCJob struct {
	In                *pb.SubmitJobRequest
	K8sClient         k8sclient.Interface
	CrdClient         *dynamic.DynamicClient
	UserName          string
	JobName           string
	WorkDir           string
	MountPoints       map[bool][]string
	Namespace         string
	Partition         string
	NodeSelector      map[string]interface{}
	VolumesFinal      []interface{}
	VolumeMountsFinal []interface{}
	Env               []interface{}
	JobType           string
	Accelerator       string
	MetaDataLabel     map[string]interface{}
	TmpLabel          map[string]interface{}
	Annotations       map[string]string
	SecurityContext   corev1.SecurityContext
	DnsConfig         corev1.PodDNSConfig
	DnsPolicy         corev1.DNSPolicy
	// web应用需要的参数
	SvcPort  int
	HostName string
	// tensorboard 参数
	TensorboardLog string
	NodePort       int
	// dev Host 参数
	JupyterLabInfo
	VsCodeInfo
}

type JupyterLabInfo struct {
	Port      int
	ProxyPath string
}

type VsCodeInfo struct {
	BinPath string
	Port    int
}

type Option func(*VCJob)

func NewVCJob(options ...Option) (vcjob *VCJob) {
	dnsPolicy, dnsConfig := utils.GetDnsConfig()
	vcjob = &VCJob{
		DnsPolicy: dnsPolicy,
		DnsConfig: dnsConfig,
	}
	for _, opt := range options {
		opt(vcjob)
	}
	return vcjob
}

func WithSubmitJobRequest(in *pb.SubmitJobRequest) Option {
	return func(vj *VCJob) {
		vj.In = in
		vj.UserName = in.UserId
		vj.Namespace = in.Partition
		vj.Partition = in.Partition
		vj.Accelerator = in.ExtraOptions[7]
	}
}

func WithJobName(jobName string) Option {
	return func(vj *VCJob) {
		vj.JobName = jobName
	}
}

func WithWorkDir(workDir string) Option {
	return func(vj *VCJob) {
		vj.WorkDir = workDir
	}
}

func WithMountPoints(mountPoints map[bool][]string) Option {
	return func(vj *VCJob) {
		vj.MountPoints = mountPoints
	}
}

func WithNamespace(namespace string) Option {
	return func(vj *VCJob) {
		vj.Namespace = namespace
	}
}

func WithRDMA(partition string) Option {
	_, _, securityContext, annotations := utils.GetRDMAConfig(partition)
	return func(vj *VCJob) {
		vj.SecurityContext = securityContext
		vj.Annotations = annotations
	}
}

func WithPartition(partition string) Option {
	return func(vj *VCJob) {
		vj.Partition = partition
	}
}

func WithUserName(userName string) Option {
	return func(vj *VCJob) {
		vj.UserName = userName
	}
}

func WithJobType(jobType string) Option {
	return func(vj *VCJob) {
		vj.JobType = jobType
	}
}

func WithAccelerator(accelerator string) Option {
	return func(vj *VCJob) {
		vj.Accelerator = accelerator
	}
}

func WithTensorboardLog(log string) Option {
	return func(vj *VCJob) {
		vj.TensorboardLog = log
	}
}

func (vj *VCJob) GetUserName() string {
	return vj.UserName
}
func (vj *VCJob) GetJobName() string {
	return vj.JobName
}
func (vj *VCJob) GetWorkDir() string {
	return vj.WorkDir
}
func (vj *VCJob) GetMountPoints() map[bool][]string {
	return vj.MountPoints
}
func (vj *VCJob) GetNamespace() string {
	return vj.Namespace
}
func (vj *VCJob) GetNodeSelector() map[string]interface{} {
	return vj.NodeSelector
}
func (vj *VCJob) GetMetadataLabel() map[string]interface{} {
	return vj.MetaDataLabel
}
func (vj *VCJob) GetTmpLabel() map[string]interface{} {
	return vj.TmpLabel
}
func (vj *VCJob) GetEnv() []interface{} {
	return vj.Env
}
func (vj *VCJob) GetVolumesFinal() []interface{} {
	return vj.VolumesFinal
}
func (vj *VCJob) GetVolumeMountsFinal() []interface{} {
	return vj.VolumeMountsFinal
}
func (vj *VCJob) GetPriorityClass() string {
	return vj.In.GetQos()
}
func (vj *VCJob) GetPodPort() (PodPort int) {
	PodPort = 20000
	if vj.In.ExtraOptions[1] == "vnc" {
		PodPort = 6901
	}
	return PodPort
}

func (vj *VCJob) GetDevHostPort(mode string) (port int) {
	switch mode {
	case jupyterlab:
		return 20001
	case vscode:
		return 20002
	}
	return 20003
}

func (vj *VCJob) GetSvcPort() int {
	return vj.SvcPort
}

func (vj *VCJob) GetNodePort() int {
	return vj.NodePort
}

func (vj *VCJob) GetHostName() string {
	return vj.HostName
}

func (vj *VCJob) SetSvcPort(port int) {
	vj.SvcPort = port
}
func (vj *VCJob) SetJupyterLabInfo(info JupyterLabInfo) {
	vj.JupyterLabInfo = info
}

func (vj *VCJob) SetVsCodeInfo(info VsCodeInfo) {
	vj.VsCodeInfo = info
}

func (vj *VCJob) SetHostName(hostname string) {
	vj.HostName = hostname
}
func (vj *VCJob) SetVolumesFinal(volumesFinal []interface{}) {
	vj.VolumesFinal = volumesFinal
}
func (vj *VCJob) SetVolumeMountsFinal(volumeMountsFinal []interface{}) {
	vj.VolumeMountsFinal = volumeMountsFinal
}
func (vj *VCJob) SetNodePort(port int) {
	vj.NodePort = port
}

func (vj *VCJob) SetEnv(env []interface{}) {
	jobType := vj.In.ExtraOptions[8]
	logrus.Tracef("[SetEnv] job %s, jobType: %s", vj.JobName, jobType)
	switch jobType {
	case "pytorch":
		jobType = PyTorch
		vj.JobType = PyTorch
	case "mindspore":
		jobType = MindSpore
		vj.JobType = MindSpore
	case "mpi":
		jobType = MPI
		vj.JobType = MPI
	case "tensorflow":
		jobType = TensorFlow
		vj.JobType = TensorFlow
	case utils.DevHost:
		jobType = MindSpore
		vj.JobType = utils.DevHost
	// app应用的ExtraOptions与训练的对应不上，只能用default去处理
	default:
		jobType = MindSpore
	}
	logrus.Infof("[SetEnv] job %s type: %s", vj.JobName, vj.JobType)
	env = append(env, map[string]interface{}{
		"name":  "VC_GPU_NUM",
		"value": strconv.Itoa(int(vj.In.GpuCount)),
	})
	logrus.Tracef("job %s requested environment variables: %d", vj.JobName, len(vj.In.GetEnvVariables()))
	if vj.In.GetEnvVariables() != nil {
		for _, envMap := range vj.In.GetEnvVariables() {
			env = append(env, map[string]string{
				"name":  envMap.GetKey(),
				"value": envMap.GetValue(),
			})
		}
	}
	if vj.IsAscend() {
		env = append(env, map[string]string{
			"name":  "framework",
			"value": jobType,
		})
	}
	vj.Env = env
	logrus.Tracef("job %s environment variables configured: %d", vj.JobName, len(env))
}

func (vj *VCJob) SetMetadataLabel() {
	metadataLabels := map[string]interface{}{
		utils.Creator: vj.UserName,
	}
	if vj.IsAscend() {
		metadataLabels["ring-controller.atlas"] = "ascend-910"
		metadataLabels["fault-scheduling"] = "force"
	}
	vj.MetaDataLabel = metadataLabels
}

func (vj *VCJob) SetTmpLabel() {
	tmpLabels := map[string]interface{}{
		utils.Creator: vj.UserName,
	}
	if vj.IsAscend() {
		tmpLabels["ring-controller.atlas"] = "ascend-910"
	}
	vj.TmpLabel = tmpLabels
}

func (vj *VCJob) SetNodeSelector() {
	nodeSelector := map[string]interface{}{
		fmt.Sprintf("queue-%s", vj.In.Partition): "true",
	}
	if vj.IsAscend() {
		nodeSelector["host-arch"] = "huawei-arm"
	}
	vj.NodeSelector = nodeSelector
}

func (vj *VCJob) SetArgs() error { //初始化 k8s clientSet
	k8sClient, err := utils.GetK8sClient()
	if err != nil {
		logrus.Errorf("failed to build k8s client: %v", err)
		return ce.RichError(codes.Internal, "NEW_K8S_CLIENT_FAILED", err.Error())
	}
	vj.K8sClient = k8sClient
	exist, err := utils.CheckNameSpace(vj.GetNamespace(), k8sClient)
	if err != nil {
		logrus.Errorf("check namespace failed: %v", err)
		return err
	}
	// ns 不存在的时候创建ns
	if !exist {
		_, err = utils.CreateNameSpace(vj.GetNamespace(), k8sClient)
		if err != nil {
			logrus.Errorf("create namespace failed: %v", err)
			return err
		}
	}
	crdClient, err := utils.GetCrdClient()
	if err != nil {
		logrus.Errorf("failed to build volcano client: %v", err)
		return ce.RichError(codes.Internal, "NEW_VOLCANO_CLIENT_FAILED", err.Error())
	}
	vj.CrdClient = crdClient
	return nil
}

func (vj *VCJob) GetGVR() (gvr schema.GroupVersionResource) {
	gvr = schema.GroupVersionResource{
		Group:    "batch.volcano.sh",
		Version:  "v1alpha1",
		Resource: "jobs",
	}
	return gvr
}
func (vj *VCJob) GetResource(gpu bool) (resources map[string]interface{}) {
	gpuCount := vj.In.GpuCount
	logrus.Infof("cpu;%d, mem: %d, gpu: %d, nodeCount: %d", vj.In.CoreCount, vj.In.MemoryMb, gpuCount, int(vj.In.NodeCount))
	resources = map[string]interface{}{
		"requests": map[string]interface{}{
			"cpu":    vj.In.CoreCount,
			"memory": strconv.Itoa(int(*vj.In.MemoryMb)/int(vj.In.NodeCount)) + "Mi",
		},
		"limits": map[string]interface{}{
			"cpu":    vj.In.CoreCount,
			"memory": strconv.Itoa(int(*vj.In.MemoryMb)/int(vj.In.NodeCount)) + "Mi",
		},
	}

	resourceName, resourceQuantity, _, _ := utils.GetRDMAConfig(vj.Partition)
	if resourceName != "" && resourceQuantity > 0 {
		logrus.Infof("job %s rdma type: %s", vj.GetJobName(), resourceName)
		resources["limits"].(map[string]interface{})[resourceName] = resourceQuantity
		resources["requests"].(map[string]interface{})[resourceName] = resourceQuantity
	}

	if !gpu || gpuCount == 0 {
		return resources
	}
	logrus.Tracef("job %s gpu type: %s", vj.GetJobName(), vj.Accelerator)
	resources["limits"].(map[string]interface{})[vj.Accelerator] = vj.In.GpuCount
	resources["requests"].(map[string]interface{})[vj.Accelerator] = vj.In.GpuCount
	if config.Value.VGPU.Enabled && vj.Accelerator == utils.VGPUNum {
		cores := config.Value.VGPU.Cores / config.Value.VGPU.Number
		memory := config.Value.VGPU.Memory / config.Value.VGPU.Number
		resources["limits"].(map[string]interface{})[utils.VGPUCore] = cores
		resources["requests"].(map[string]interface{})[utils.VGPUCore] = cores
		resources["limits"].(map[string]interface{})[utils.VGPUMem] = memory
		resources["requests"].(map[string]interface{})[utils.VGPUMem] = memory
	}
	logrus.Infof("job %s GPU resources configured: %v", vj.GetJobName(), resources)
	return resources
}

func (vj *VCJob) IsAscend() bool {
	return strings.Contains(vj.Accelerator, utils.HuaweiAscend)
}

func (vj *VCJob) DeleteResource() {
	// 解析失败，需要清理资源
	wg := sync.WaitGroup{}
	wg.Add(4)
	go func() { //删除ascend configmap
		defer wg.Done()
		if vj.IsAscend() {
			vj.DeleteVcjobConfigMap()
		}
	}()
	go func() { // 删除 app service
		defer wg.Done()
		if vj.JobType == APP || vj.JobType == utils.DevHost {
			vj.DeleteService()
		}
	}()
	go func() { // 删除tensorboard
		defer wg.Done()
		if vj.TensorboardLog != "" {
			vj.DeleteTensorboard()
		}
	}()
	go func() { // 删除secret
		defer wg.Done()
		if err := utils.DeleteImageRegistrySecretWithClient(vj.Namespace, vj.JobName, vj.K8sClient); err != nil {
			resourcecleanup.RecordFailure(resourcecleanup.ResourceKindSecret, vj.Namespace, vj.JobName, err)
		}
	}()
	wg.Wait()
	logrus.Infof("[DeleteResource] cleanup vcjob %s resources completed", vj.GetJobName())
}

func (vj *VCJob) CreateJob() error { // create volcano job
	if vj.IsAscend() {
		configmap := vj.GetAscendConfigmap()
		_, err := vj.K8sClient.CoreV1().ConfigMaps(vj.GetNamespace()).Create(context.TODO(), configmap, metav1.CreateOptions{})
		if err != nil {
			logrus.Errorf("create configmap failed, job: %v, error: %v", vj.GetJobName(), err)
			return ce.RichError(codes.Internal, "CREATE_CONFIGMAP_FAILED", err.Error())
		}
		logrus.Infof("create configmap %s successful", vj.JobName)
	}
	volcanoJob, err := vj.GetUnstructured()
	if err != nil || volcanoJob == nil {
		logrus.Errorf("get volcano unstructured failed, %v", err)
		return ce.RichError(codes.Internal, "GET_VOLCANO_UNSTRUCTURED_FAILED", err.Error())
	}
	if err := vj.CreateSecret(); err != nil {
		return ce.RichError(codes.Internal, "CREATE_SECRET_FAILED", err.Error())
	}
	go utils.SaveJobInfoToFile(volcanoJob, vj.GetJobName()) // save job info to yaml
	_, err = vj.CrdClient.Resource(vj.GetGVR()).Namespace(vj.GetNamespace()).Create(context.TODO(), volcanoJob, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("create volcanoJob failed, job: %v, error: %v", vj.GetJobName(), err)
		return ce.RichError(codes.Internal, "SUBMIT_VCJOB_FAILED", err.Error())
	}
	go func() { // 创建tensorboard 资源
		if vj.TensorboardLog == "" {
			logrus.Tracef("%s tensorboard log is null", vj.GetJobName())
			return
		}
		err = vj.CreateTensorboard()
		if err != nil {
			logrus.Errorf("create tensorboard failed, job: %v, error: %v", vj.GetJobName(), err)
		}
	}()
	return nil
}

func (vj *VCJob) DeleteVcjobConfigMap() {
	configmapName := fmt.Sprintf("rings-config-%s", vj.GetJobName())
	err := utils.DeleteConfigmap(configmapName, vj.GetNamespace(), vj.K8sClient)
	if err != nil {
		resourcecleanup.RecordFailure(resourcecleanup.ResourceKindConfigMap, vj.GetNamespace(), configmapName, err)
		logrus.Errorf("vcjob delete configmap %s failed due to %v", vj.GetJobName(), err)
		return
	}
	logrus.Infof("vcjob delete configmap %s successful", configmapName)
}

func (vj *VCJob) Delete() error { // delete volcano job
	volcanoClient, err := utils.GetVolcanoClient()
	if err != nil {
		logrus.Errorf("failed to build volcano client: %v", err)
		return err
	}
	return vj.delete(volcanoClient)
}

func (vj *VCJob) delete(volcanoClient volcanoclientset.Interface) error {
	err := volcanoClient.BatchV1alpha1().Jobs(vj.GetNamespace()).Delete(context.TODO(), vj.GetJobName(), metav1.DeleteOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			err = nil
		} else {
			return err
		}
	}
	vj.DeleteResource()
	return nil
}

func DeleteVCJobResources(job *models.JobTable, cli k8sclient.Interface, volcanoClient volcanoclientset.Interface) error {
	if job == nil {
		return fmt.Errorf("job is nil")
	}
	if cli == nil {
		return fmt.Errorf("k8s client is nil")
	}
	if volcanoClient == nil {
		return fmt.Errorf("volcano client is nil")
	}

	vcjob := NewVCJob(
		WithJobName(job.NewJobName),
		WithUserName(job.UserName),
		WithNamespace(job.Partition),
		WithAccelerator(job.GpuType),
		WithJobType(job.JobType),
		WithTensorboardLog(job.TensorboardLogPath),
	)
	vcjob.K8sClient = cli
	if job.JupyterLabProxyPath != "" {
		vcjob.SetJupyterLabInfo(JupyterLabInfo{ProxyPath: job.JupyterLabProxyPath})
	}
	if job.VscodeBinPath != "" {
		vcjob.SetVsCodeInfo(VsCodeInfo{BinPath: job.VscodeBinPath})
	}
	return vcjob.delete(volcanoClient)
}

func (vj *VCJob) GetUnstructured() (volcanoJob *unstructured.Unstructured, err error) {
	var (
		volumesFinal      []interface{}
		volumeMountsFinal []interface{}
		env               []interface{}
	)
	if vj.In.NodeCount < 1 {
		return nil, fmt.Errorf("node count must be greater than zero")
	}
	workDir := vj.GetWorkDir()
	mountPoints := vj.GetMountPoints()
	jobName := vj.GetJobName()
	vj.In.JobName = jobName
	if vj.IsAscend() {
		// 获取 Job 挂载信息
		volumesFinal, volumeMountsFinal, err = utils.SetAscendVcjobMountPoints(mountPoints, workDir, vj.In)
		if err != nil {
			logrus.Errorf("set mount point failed, job: %v, error: %v", jobName, err)
			return nil, err
		}
		// 获取 Job 的环境变量
		env, err = utils.SetAscendContainerEnv(vj.GetWorkDir(), vj.In)
		if err != nil {
			logrus.Errorf("set container env failed, job: %v, error: %v", vj.GetJobName(), err)
			return nil, err
		}
	} else {
		// 获取 Job 挂载信息
		volumesFinal, volumeMountsFinal, err = utils.SetMountPoints(mountPoints, workDir, vj.In)
		if err != nil {
			logrus.Errorf("set mount point failed, job: %v, error: %v", jobName, err)
			return nil, err
		}
		// 获取 Job 的环境变量
		env, err = utils.SetContainerEnv(vj.GetWorkDir(), vj.In)
		if err != nil {
			logrus.Errorf("set container env failed, job: %v, error: %v", jobName, err)
			return nil, err
		}
	}
	vj.SetVolumesFinal(volumesFinal)
	vj.SetVolumeMountsFinal(volumeMountsFinal)
	// 根据nvidia或者ascend的GPU卡,  set 的参数不一致
	vj.SetEnv(env)
	vj.SetMetadataLabel()
	vj.SetTmpLabel()
	vj.SetNodeSelector()
	logrus.Infof("vcjob %s train framework: %s", vj.GetJobName(), vj.JobType)
	logrus.Infof("vcjob %s configured, volumes: %v, mounts: %v, env count: %d, metadata labels: %v, task labels: %v",
		vj.GetJobName(), vj.VolumesFinal, vj.VolumeMountsFinal, len(vj.Env), vj.MetaDataLabel, vj.TmpLabel)

	// 获取不同任务类型的Unstructured
	switch vj.JobType {
	case PyTorch:
		volcanoJob = vj.GetPyTorchUnstructured()
	case TensorFlow:
		volcanoJob = vj.GetTensorFlowUnstructured()
	case MindSpore:
		if vj.In.NodeCount == 1 {
			volcanoJob = vj.GetMindSporeUnstructured()
		} else {
			//nvidia mindspore 多机用的是MPI框架
			volcanoJob = vj.GetMPIUnstructured()
		}
	case MPI:
		volcanoJob = vj.GetMPIUnstructured()
	case APP: // 应用app，独立处理
		volcanoJob = vj.GetAppUnstructured()
	case utils.DevHost: //开发机 vcjob
		volcanoJob = vj.GetDevHostUnstructured()
	default:
		volcanoJob = vj.GetMindSporeUnstructured()
	}
	logrus.Tracef("vcjob %s Volcano job object built, framework: %s", vj.GetJobName(), vj.JobType)
	return volcanoJob, nil
}

func (vj *VCJob) CreateDevHostService() (err error) {
	// vscode port 20000
	// jupyterlab port 20001
	SvcInfo := map[string]string{}
	if vj.VsCodeInfo.BinPath != "" {
		SvcInfo[vscode] = fmt.Sprintf("%s-%s", vscode, vj.JobName)
	}
	if vj.JupyterLabInfo.ProxyPath != "" {
		SvcInfo[jupyterlab] = fmt.Sprintf("%s-%s", jupyterlab, vj.JobName)
	}
	for mode, name := range SvcInfo {
		nodePort, err := utils.GenerateNodePort(vj.K8sClient) // 生成端口 svcport
		if err != nil {
			logrus.Errorf("GenerateNodePort %s failed %v", name, err)
			continue
		}
		// 写入port信息
		switch mode {
		case jupyterlab:
			vj.JupyterLabInfo.Port = nodePort
		case vscode:
			vj.VsCodeInfo.Port = nodePort
		}
		service := &corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name: name,
			},
			Spec: corev1.ServiceSpec{
				Type: corev1.ServiceTypeNodePort,
				Ports: []corev1.ServicePort{
					{
						Port:       80,
						TargetPort: intstr.FromInt32(int32(vj.GetDevHostPort(mode))),
						NodePort:   int32(nodePort),
					},
				},
				Selector: map[string]string{
					"volcano.sh/job-name": vj.GetJobName(),
				},
			},
		}
		_, err = vj.K8sClient.CoreV1().Services(vj.GetNamespace()).Create(context.Background(), service, metav1.CreateOptions{})
		if err != nil {
			logrus.Errorf("create service failed, service name: %v, error: %v", name, err)
			continue
		}
		logrus.Infof("create service %s successful", name)
	}
	return nil
}

// create app nodePort

func (vj *VCJob) CreateService() (err error) {
	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name: vj.GetJobName(),
		},
		Spec: corev1.ServiceSpec{
			Type: corev1.ServiceTypeNodePort,
			Ports: []corev1.ServicePort{
				{
					Port:       80,
					TargetPort: intstr.FromInt32(int32(vj.GetPodPort())),
					NodePort:   int32(vj.SvcPort),
				},
			},
			Selector: map[string]string{
				"volcano.sh/job-name": vj.GetJobName(),
			},
		},
	}
	_, err = vj.K8sClient.CoreV1().Services(vj.GetNamespace()).Create(context.Background(), service, metav1.CreateOptions{})
	if err != nil {
		logrus.Errorf("create service failed, service name: %v, error: %v", vj.GetJobName(), err)
		return err
	}
	logrus.Infof("create service %s successful", vj.GetJobName())
	return nil
}

func (vj *VCJob) DeleteService() {
	SvcList := []string{vj.JobName}
	if vj.VsCodeInfo.BinPath != "" {
		SvcList = append(SvcList, fmt.Sprintf("%s-%s", vscode, vj.JobName))
	}
	if vj.JupyterLabInfo.ProxyPath != "" {
		SvcList = append(SvcList, fmt.Sprintf("%s-%s", jupyterlab, vj.JobName))
	}
	for _, name := range SvcList {
		err := utils.DeleteService(name, vj.GetNamespace(), vj.K8sClient)
		if err != nil {
			resourcecleanup.RecordFailure(resourcecleanup.ResourceKindService, vj.GetNamespace(), name, err)
			logrus.Errorf("delete vcjob service %s failed, err: %v", name, err)
			continue
		}
		logrus.Infof("delete vcjob service %s successful", vj.GetJobName())
	}
	return
}

func (vj *VCJob) IsPrivateImageRegistry() bool {
	c := vj.In.PrivateImageRepositoryCredentials
	return c != nil && c.UserName != "" && c.Password != ""
}

func (vj *VCJob) CreateSecret() error {
	if !vj.IsPrivateImageRegistry() {
		return nil
	}
	if len(vj.In.ExtraOptions[2]) == 0 {
		return fmt.Errorf("image address is null")
	}
	registry := strings.Split(vj.In.ExtraOptions[2], ":")[0]
	err := utils.CreateImageRegistrySecretWithClient(
		vj.GetNamespace(),
		vj.JobName,
		registry,
		vj.In.PrivateImageRepositoryCredentials.UserName,
		vj.In.PrivateImageRepositoryCredentials.Password,
		vj.K8sClient,
	)
	if err != nil {
		return err
	}
	return nil
}
