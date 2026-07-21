package job

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"

	protos "scow-adapters/gen/go"
	"scow-adapters/pkg/crane-ai/utils"
)

// MountModel 复用统一挂载模型，保证训练入口和容器构建入口的 target 解析一致。
type MountModel = utils.MountModel

// TrainConfig 从ExtraOptions解析训练相关参数
type TrainConfig struct {
	ImageURL         string       // 镜像地址
	AlgorithmPath    string       // 算法版本地址
	DatasetPath      string       // 数据集版本地址
	ModelPath        string       // 模型路径
	RWVolumes        []MountModel // 可读可写挂载点
	GPUType          string       // GPU类型
	Framework        string       // AI训练框架
	ROVolumes        []string     // 只读挂载点
	WorkingDirectory string       // 工作目录，透传为容器环境变量 WORKING_DIRECTORY
}

// 解析ExtraOptions获取训练配置
func parseTrainConfig(extraOptions []string) (*TrainConfig, error) {
	if len(extraOptions) < 10 {
		return nil, fmt.Errorf("extra_options must have at least 10 elements for train type")
	}

	config := &TrainConfig{
		ImageURL:      extraOptions[2],
		AlgorithmPath: extraOptions[3],
		DatasetPath:   extraOptions[4],
		ModelPath:     extraOptions[5],
		GPUType:       extraOptions[7],
		Framework:     extraOptions[8],
	}

	// 解析可读可写挂载点
	if extraOptions[6] != "[]" {
		// 可读写挂载来自前端 MountModel JSON，支持容器内 target 与宿主机 path 不同。
		rwVolumes, err := utils.ParseMountModel(extraOptions[6])
		if err != nil {
			return nil, fmt.Errorf("failed to parse read-write mount points: %v", err)
		}
		config.RWVolumes = rwVolumes
	}

	// 解析只读挂载点
	if extraOptions[9] != "[]" {
		config.ROVolumes = strings.Split(extraOptions[9], ",")
	}

	return config, nil
}

func tensorBoardEnabled(req *protos.SubmitJobRequest) bool {
	return strings.TrimSpace(req.GetTensorBoardDataPath()) != ""
}

func trainingCoreCount(req *protos.SubmitJobRequest, rank uint32) (uint32, error) {
	if !tensorBoardEnabled(req) || rank != 0 {
		return req.CoreCount, nil
	}
	if req.CoreCount <= uint32(utils.TensorBoardCpu) {
		return 0, fmt.Errorf("enable TensorBoard requires more than %d CPU cores", utils.TensorBoardCpu)
	}
	return req.CoreCount - uint32(utils.TensorBoardCpu), nil
}

func trainingMemoryPerNodeMb(req *protos.SubmitJobRequest, rank uint32) (uint64, error) {
	if req.MemoryMb == nil {
		return 0, nil
	}
	nodeCount := req.NodeCount
	if nodeCount == 0 {
		nodeCount = 1
	}
	memoryPerNode := *req.MemoryMb / uint64(nodeCount)
	if !tensorBoardEnabled(req) || rank != 0 {
		return memoryPerNode, nil
	}
	if memoryPerNode <= uint64(utils.TensorBoardMemoryMb) {
		return 0, fmt.Errorf("enable TensorBoard requires more than %d MB memory per node", utils.TensorBoardMemoryMb)
	}
	return memoryPerNode - uint64(utils.TensorBoardMemoryMb), nil
}

func getAlgorithmDataSetModelInfo(algorithmPath, dataSetPath, modelPath string) ([]MountModel, []MountModel, []MountModel, error) {
	var algorithm, dataSet, model []MountModel
	var err error
	// algorithm
	if algorithmPath != "" {
		algorithm, err = parseMountModel(algorithmPath)
		if err != nil {
			logrus.Errorf("Failed parse algorithm path: %v", err)
			return nil, nil, nil, err
		}
	}

	// dataSet
	if dataSetPath != "" {
		dataSet, err = parseMountModel(dataSetPath)
		if err != nil {
			logrus.Errorf("Failed parse dataSet path: %v", err)
			return nil, nil, nil, err
		}
	}

	// model
	if modelPath != "" {
		model, err = parseMountModel(modelPath)
		if err != nil {
			logrus.Errorf("Failed parse model path: %v", err)
			return nil, nil, nil, err
		}
	}
	return algorithm, dataSet, model, nil
}

func parseMountModel(mount string) ([]MountModel, error) {
	info, err := utils.ParseMountModel(mount)
	if err != nil {
		logrus.Errorf("Parse mount model failed: %v", err)
		return info, err
	}
	return info, nil
}

// 组装挂载参数
func buildMountArgs(rwVolumes []MountModel, roVolumes []string, script, workingDirectory, algorithmPath, datasetPath, modelPath string) []string {
	var mountArgs []string

	err := utils.CheckAndAddExecPermission(utils.GetDirPathWithSlash(script))
	if err != nil {
		logrus.Errorf("file %v add exec permission error: %v", script, err)
	}

	mountArgs = append(mountArgs,
		"-v", fmt.Sprintf("%s:%s", utils.GetDirPathWithSlash(script), utils.ContainerScriptDir))

	if strings.TrimSpace(workingDirectory) != "" {
		mountArgs = append(mountArgs, "-v", fmt.Sprintf("%s:%s", workingDirectory, workingDirectory))
	}

	algorithm, dataSet, model, err := getAlgorithmDataSetModelInfo(algorithmPath, datasetPath, modelPath)
	if err != nil {
		logrus.Warnf("buildMountArgs: failed to parse algorithm/dataset/model paths: %v", err)
	}
	// 添加算法路径挂载
	for _, m := range algorithm {
		// path 是宿主机路径，target 是容器内路径；target 为空时解析阶段会回退到 path。
		mountArgs = append(mountArgs, "-v", fmt.Sprintf("%s:%s", m.Path, m.Target))
	}

	// 添加数据集路径挂载
	for _, m := range dataSet {
		mountArgs = append(mountArgs, "-v", fmt.Sprintf("%s:%s", m.Path, m.Target))
	}

	// 添加模型路径挂载
	for _, m := range model {
		mountArgs = append(mountArgs, "-v", fmt.Sprintf("%s:%s", m.Path, m.Target))
	}

	// 添加可读可写挂载点
	for _, mount := range rwVolumes {
		// 跳过空字符串
		if strings.TrimSpace(mount.Path) == "" {
			continue
		}
		mountArgs = append(mountArgs, "-v", fmt.Sprintf("%s:%s", mount.Path, mount.Target))
	}

	// 添加只读挂载点
	for _, volume := range roVolumes {
		// 跳过空字符串
		if strings.TrimSpace(volume) == "" {
			continue
		}
		// 挂载为只读
		mountArgs = append(mountArgs, "-v", fmt.Sprintf("%s:%s", volume, volume))
	}

	return mountArgs
}

func setEnvByAddition(algorithm, dataSet, model []MountModel) []string {
	var env []string
	// algorithm
	if algorithm != nil {
		paths := make([]string, len(algorithm))
		for i, mount := range algorithm {
			paths[i] = mount.Target
		}
		algorithmValue := strings.Join(paths, ":")
		env = append(env,
			"-e", fmt.Sprintf("%s=%s", utils.ContainerEnvPrefix+utils.AlgorithmPathEnv, algorithmValue))
	}

	// dataSet
	if dataSet != nil {
		paths := make([]string, len(dataSet))
		for i, mount := range dataSet {
			paths[i] = mount.Target
		}
		dataSetValue := strings.Join(paths, ":")
		env = append(env,
			"-e", fmt.Sprintf("%s=%s", utils.ContainerEnvPrefix+utils.DataSetPathEnv, dataSetValue))
	}

	// model
	if model != nil {
		paths := make([]string, len(model))
		for i, mount := range model {
			paths[i] = mount.Target
		}
		modelValue := strings.Join(paths, ":")
		env = append(env,
			"-e", fmt.Sprintf("%s=%s", utils.ContainerEnvPrefix+utils.ModelPathEnv, modelValue))
	}
	return env
}

// buildContainerCommandWithAddr builds a ccon run command with a specified MASTER_ADDR string.
// Crane scheduling flags (account, partition, qos, cpu, gres, mem) are placed between 'ccon' and 'run'
// as required by the ccon CLI: ccon [crane-flags] run [container-flags] IMAGE [CMD].
func buildContainerCommandWithAddr(req *protos.SubmitJobRequest, config *TrainConfig, rank, worldSize uint32, masterAddr string) (string, error) {
	var cmdParts []string
	cmdParts = append(cmdParts, "ccon")

	// CPU：每容器核数
	coreCount, err := trainingCoreCount(req, rank)
	if err != nil {
		return "", err
	}
	cmdParts = append(cmdParts, "-c", strconv.Itoa(int(coreCount)))
	// GPU：每容器 GPU 数量（若有）
	if req.GpuCount > 0 {
		deviceType, err := utils.GetPartitionDeviceType(req.Partition)
		if err != nil {
			return "", fmt.Errorf("get partition device type failed: %w", err)
		}
		cmdParts = append(cmdParts, "--gres", fmt.Sprintf("%s:%d", deviceType, req.GpuCount))
	}
	// Memory：每容器内存（单位 MB）
	if req.MemoryMb != nil {
		mem, err := trainingMemoryPerNodeMb(req, rank)
		if err != nil {
			return "", err
		}
		cmdParts = append(cmdParts, "--mem", fmt.Sprintf("%dM", mem))
	}

	// === Container run flags ===
	cmdParts = append(cmdParts, "run", "-i -t -d")

	mountArgs := buildMountArgs(config.RWVolumes, config.ROVolumes,
		req.Script, config.WorkingDirectory, config.AlgorithmPath, config.DatasetPath, config.ModelPath)
	cmdParts = append(cmdParts, mountArgs...)

	envArgs := buildEnvArgsWithMasterAddr(req.NodeCount, rank, worldSize, masterAddr, config.WorkingDirectory,
		req.EnvVariables, config.AlgorithmPath, config.DatasetPath, config.ModelPath)
	cmdParts = append(cmdParts, envArgs...)

	cmdParts = append(cmdParts, config.ImageURL)
	cmdParts = append(cmdParts, "bash", utils.ContainerEntryScript)

	return strings.Join(cmdParts, " "), nil
}

func buildTensorBoardCommand(req *protos.SubmitJobRequest, _ *TrainConfig, tensorBoardProxyPort int) (string, error) {
	var cmdParts []string
	if tensorBoardProxyPort < utils.MinPort {
		return "", fmt.Errorf("invalid tensorboard proxy port %d: expected a proxy port >= %d",
			tensorBoardProxyPort, utils.MinPort)
	}
	adapterHostname, err := os.Hostname()
	if err != nil {
		return "", fmt.Errorf("get adapter hostname failed: %w", err)
	}
	pathPrefix, err := buildTensorBoardPathPrefix(req, adapterHostname, tensorBoardProxyPort)
	if err != nil {
		return "", err
	}

	cmdParts = append(cmdParts,
		"ccon",
		"-c", strconv.Itoa(utils.TensorBoardCpu),
		"--mem", fmt.Sprintf("%dM", utils.TensorBoardMemoryMb),
		"run", "-i -t -d",
	)

	cmdParts = append(cmdParts,
		"-v", fmt.Sprintf("%s:%s", req.GetTensorBoardDataPath(), utils.TensorBoardLogMountDir),
		utils.TensorboardImage,
		"tensorboard",
		"--logdir", utils.TensorBoardLogMountDir,
		"--host", "0.0.0.0",
		"--path_prefix", pathPrefix,
	)

	return strings.Join(cmdParts, " "), nil
}

func buildTensorBoardPathPrefix(req *protos.SubmitJobRequest, hostname string, tensorBoardProxyPort int) (string, error) {
	pathPrefix := ""
	if req != nil {
		pathPrefix = req.GetTensorboardProxyPathPrefix()
	}
	if strings.TrimSpace(pathPrefix) == "" {
		return "", fmt.Errorf("tensorboard proxy path prefix is empty")
	}
	if !strings.HasSuffix(pathPrefix, "/") {
		pathPrefix += "/"
	}
	return fmt.Sprintf("%s%s/%d/", pathPrefix, hostname, tensorBoardProxyPort), nil
}

// buildEnvArgsWithMasterAddr builds env args using an explicit masterAddr string (can be a shell variable).
func buildEnvArgsWithMasterAddr(nNodes, rank, worldSize uint32, masterAddr, workingDirectory string,
	envVariables []*protos.EnvVariable, algorithmPath, datasetPath, modelPath string) []string {
	var envArgs []string

	envArgs = append(envArgs, "-e", fmt.Sprintf("MASTER_ADDR=%s", masterAddr))
	envArgs = append(envArgs,
		"-e", fmt.Sprintf("N_NODES=%d", nNodes),
		"-e", "MASTER_PORT=29500",
		"-e", fmt.Sprintf("RANK=%d", rank),
		"-e", fmt.Sprintf("WORLD_SIZE=%d", worldSize),
		"-e", "NCCL_DEBUG=INFO",
		"-e", "GLOO_SOCKET_IFNAME=eth0",
	)

	// 工作目录透传给容器内脚本
	if workingDirectory != "" {
		envArgs = append(envArgs, "-e", fmt.Sprintf("WORKING_DIRECTORY=%s", workingDirectory))
	}

	for _, env := range envVariables {
		envArgs = append(envArgs, "-e", fmt.Sprintf("%s=%s", env.Key, env.Value))
	}

	algorithm, dataSet, model, err := getAlgorithmDataSetModelInfo(algorithmPath, datasetPath, modelPath)
	if err != nil {
		logrus.Warnf("buildEnvArgsWithMasterAddr: failed to parse algorithm/dataset/model paths: %v", err)
	}
	envArgs = append(envArgs, setEnvByAddition(algorithm, dataSet, model)...)
	return envArgs
}

// multiNodeHelperFunctions contains reusable bash functions injected at the top of the script body.
const multiNodeHelperFunctions = `
# ===== Helper Functions =====

cleanup_tensorboard() {
    if [ -n "$tensorboard_container_id" ]; then
        echo "清理 TensorBoard 容器 $tensorboard_container_id"
        ccon stop "$tensorboard_container_id" 2>/dev/null ||
            ccon cancel "$tensorboard_container_id" 2>/dev/null ||
            ccon rm -f "$tensorboard_container_id" 2>/dev/null ||
            true
    fi
}

# wait_for_container: 等待容器就绪（status=1）。
#   $1 - 容器 ID（jobId.stepId）
#   $2 - "true" 表示失败时退出整个作业，否则只打印警告
wait_for_container() {
    local container_id="$1"
    local fatal="$2"
    local max_retries=20
    local retry_interval=1
    local retry_count=0
    local ready=false

    while [ $retry_count -lt $max_retries ]; do
        echo "尝试 $((retry_count+1))/$max_retries: 检查容器 $container_id 状态"
        local status=$(ccon inspect "$container_id" 2>/dev/null | jq -r '.status' 2>/dev/null)

        if [ $? -eq 0 ] && [ -n "$status" ]; then
            echo "容器状态: $status"
            if [ "$status" = "1" ]; then
                echo "容器 $container_id 已就绪"
                ready=true
                break
            elif [ "$status" = "0" ]; then
                echo "容器 $container_id 未就绪，等待..."
            elif [ "$status" = "-1" ]; then
                echo "错误: 容器 $container_id 启动失败"
                if [ "$fatal" = "true" ]; then exit 1; fi
                break
            else
                echo "未知状态: $status，等待..."
            fi
        else
            echo "无法获取容器状态，等待..."
        fi

        retry_count=$((retry_count + 1))
        sleep $retry_interval
    done

    if [ "$ready" = false ]; then
        if [ "$fatal" = "true" ]; then
            echo "错误: 容器 $container_id 在 ${max_retries} 次重试后仍未就绪"
            exit 1
        else
            echo "警告: 容器 $container_id 在 ${max_retries} 次重试后仍未就绪，将继续..."
        fi
    fi
}

# parse_container_id: 从 ccon run 输出中解析 "jobId.stepId"，结果输出到 stdout。
#   $1 - ccon run 的完整输出文本
parse_container_id() {
    local output="$1"
    local result=""

    if echo "$output" | grep -q "Container submitted successfully"; then
        local job_id=$(echo "$output" | grep -oP 'Job ID: \K\d+')
        local step_id=$(echo "$output" | grep -oP 'Step ID: \K\d+')
        if [ -n "$job_id" ] && [ -n "$step_id" ]; then
            result="${job_id}.${step_id}"
        fi
    fi

    echo "$result"
}
# ===== End Helper Functions =====
`

// GenerateMultiNodeTrainScript generates a complete bash script body for container training.
// Returns the script body (after CBATCH headers) as a string.
func GenerateMultiNodeTrainScript(req *protos.SubmitJobRequest, tensorBoardProxyPort int) (string, error) {
	config, err := parseTrainConfig(req.ExtraOptions)
	if err != nil {
		return "", err
	}
	// WorkingDirectory 不在 extraOptions 中，直接从请求字段注入
	config.WorkingDirectory = req.WorkingDirectory

	nodeCount := req.NodeCount
	tensorBoard := tensorBoardEnabled(req)
	if tensorBoard && tensorBoardProxyPort < utils.MinPort {
		return "", fmt.Errorf("invalid tensorboard proxy port %d: expected a proxy port >= %d",
			tensorBoardProxyPort, utils.MinPort)
	}

	// Master: MASTER_ADDR=127.0.0.1，主节点监听本地地址
	masterCmd, err := buildContainerCommandWithAddr(req, config, 0, nodeCount, "127.0.0.1")
	if err != nil {
		return "", fmt.Errorf("failed to build master command: %v", err)
	}

	// Workers: MASTER_ADDR=$first_master_addr，该变量由脚本运行时通过 ccon inspect 动态确定
	type workerCmd struct {
		rank uint32
		cmd  string
	}
	var workers []workerCmd
	for i := uint32(1); i < nodeCount; i++ {
		cmd, err := buildContainerCommandWithAddr(req, config, i, nodeCount, "$first_master_addr")
		if err != nil {
			return "", fmt.Errorf("failed to build worker %d command: %v", i, err)
		}
		workers = append(workers, workerCmd{rank: i, cmd: cmd})
	}

	var sb strings.Builder

	// Inject helper functions
	sb.WriteString(multiNodeHelperFunctions)
	sb.WriteString("\n")
	if tensorBoard {
		sb.WriteString("tensorboard_container_id=\"\"\n")
	}
	sb.WriteString("echo \"Job started on $(hostname)\"\n\n")

	// === Master container ===
	sb.WriteString("# 运行主节点容器\n")
	sb.WriteString("echo \"===== 启动主节点容器 =====\"\n")
	sb.WriteString(fmt.Sprintf("first_container_output=$(%s)\n", masterCmd))
	sb.WriteString("echo \"主节点容器输出:\"\n")
	sb.WriteString("echo \"$first_container_output\"\n\n")

	// Parse master container ID
	sb.WriteString("# 解析主节点容器ID\n")
	sb.WriteString("echo \"===== 解析主节点容器ID =====\"\n")
	sb.WriteString("first_container_id=$(parse_container_id \"$first_container_output\")\n")
	sb.WriteString("if [ -z \"$first_container_id\" ]; then\n")
	sb.WriteString("    echo \"错误: 无法解析主节点容器ID\"\n")
	sb.WriteString("    exit 1\n")
	sb.WriteString("fi\n")
	sb.WriteString("echo \"主节点容器ID: $first_container_id\"\n\n")

	// Wait for master container
	sb.WriteString("# 等待主节点容器就绪\n")
	sb.WriteString("echo \"===== 等待主节点容器就绪 =====\"\n")
	sb.WriteString("wait_for_container \"$first_container_id\" \"true\"\n\n")

	// Get master container's craned node → compute first_master_addr
	sb.WriteString("# 获取主节点容器的运行节点，拼接 MASTER_ADDR 供工作节点使用\n")
	sb.WriteString("echo \"===== 获取主节点运行节点 =====\"\n")
	sb.WriteString("first_job_id=$(echo \"$first_container_id\" | cut -d'.' -f1)\n")
	sb.WriteString("craned_node=$(ccon inspect \"$first_container_id\" 2>/dev/null | jq -r '.craned_list' 2>/dev/null)\n")
	sb.WriteString("if [ -z \"$craned_node\" ] || [ \"$craned_node\" = \"null\" ]; then\n")
	sb.WriteString("    echo \"错误: 无法获取主节点的运行节点\"\n")
	sb.WriteString("    exit 1\n")
	sb.WriteString("fi\n")
	sb.WriteString("first_master_addr=\"job-${first_job_id}-${craned_node}\"\n")
	sb.WriteString("echo \"主节点地址 (MASTER_ADDR): $first_master_addr\"\n\n")

	if tensorBoard {
		tensorBoardCmd, err := buildTensorBoardCommand(req, config, tensorBoardProxyPort)
		if err != nil {
			return "", err
		}
		sb.WriteString("# 启动 TensorBoard 容器\n")
		sb.WriteString("echo \"===== 启动 TensorBoard 容器 =====\"\n")
		sb.WriteString(fmt.Sprintf("tensorboard_output=$(%s)\n", tensorBoardCmd))
		sb.WriteString("echo \"TensorBoard 容器输出:\"\n")
		sb.WriteString("echo \"$tensorboard_output\"\n")
		sb.WriteString("tensorboard_container_id=$(parse_container_id \"$tensorboard_output\")\n")
		sb.WriteString("if [ -n \"$tensorboard_container_id\" ]; then\n")
		sb.WriteString("    echo \"TensorBoard 容器ID: $tensorboard_container_id\"\n")
		sb.WriteString("    wait_for_container \"$tensorboard_container_id\" \"false\"\n")
		sb.WriteString("else\n")
		sb.WriteString("    echo \"警告: 无法解析 TensorBoard 容器ID\"\n")
		sb.WriteString("fi\n\n")
	}

	// === Worker containers ===
	if len(workers) > 0 {
		sb.WriteString("# 启动工作节点容器\n")
		sb.WriteString("echo \"===== 启动工作节点容器 =====\"\n")
		sb.WriteString("declare -a worker_container_ids=()\n\n")

		for idx, w := range workers {
			workerNum := idx + 1
			outputVar := fmt.Sprintf("worker_%d_output", workerNum)
			idVar := fmt.Sprintf("worker_%d_id", workerNum)

			sb.WriteString(fmt.Sprintf("# 工作节点 %d (RANK=%d)\n", workerNum, w.rank))
			sb.WriteString(fmt.Sprintf("echo \"启动工作节点 %d (RANK=%d)...\"\n", workerNum, w.rank))
			sb.WriteString("echo \"传递环境变量 MASTER_ADDR=$first_master_addr\"\n")
			sb.WriteString(fmt.Sprintf("%s=$(%s)\n", outputVar, w.cmd))
			sb.WriteString(fmt.Sprintf("echo \"工作节点 %d 输出:\"\n", workerNum))
			sb.WriteString(fmt.Sprintf("echo \"$%s\"\n\n", outputVar))

			sb.WriteString(fmt.Sprintf("# 解析工作节点 %d 容器ID\n", workerNum))
			sb.WriteString(fmt.Sprintf("echo \"===== 解析工作节点 %d 容器ID =====\"\n", workerNum))
			sb.WriteString(fmt.Sprintf("%s=$(parse_container_id \"$%s\")\n", idVar, outputVar))
			sb.WriteString(fmt.Sprintf("if [ -n \"$%s\" ]; then\n", idVar))
			sb.WriteString(fmt.Sprintf("    echo \"工作节点 %d 容器ID: $%s\"\n", workerNum, idVar))
			sb.WriteString(fmt.Sprintf("    worker_container_ids+=(\"$%s\")\n", idVar))
			sb.WriteString("else\n")
			sb.WriteString(fmt.Sprintf("    echo \"警告: 无法解析工作节点 %d 容器ID\"\n", workerNum))
			sb.WriteString("fi\n\n")
		}

		// Wait for worker containers
		sb.WriteString("# 等待工作节点容器就绪\n")
		sb.WriteString("echo \"===== 等待工作节点容器就绪 =====\"\n")
		sb.WriteString("for wid in \"${worker_container_ids[@]}\"; do\n")
		sb.WriteString("    echo \"等待工作节点容器 $wid 就绪...\"\n")
		sb.WriteString("    wait_for_container \"$wid\" \"false\"\n")
		sb.WriteString("done\n\n")
	}

	// === Summary ===
	sb.WriteString("# 容器信息汇总\n")
	sb.WriteString("echo \"===== 容器信息汇总 =====\"\n")
	sb.WriteString("echo \"主节点容器 ID: $first_container_id\"\n")
	sb.WriteString("echo \"主节点 MASTER_ADDR: $first_master_addr\"\n")
	if tensorBoard {
		sb.WriteString("echo \"TensorBoard 容器 ID: $tensorboard_container_id\"\n")
		sb.WriteString(fmt.Sprintf("echo \"TensorBoard 容器端口: %d\"\n", utils.TensorBoardPort))
		sb.WriteString(fmt.Sprintf("echo \"TensorBoard 代理端口: %d\"\n", tensorBoardProxyPort))
	}
	if len(workers) > 0 {
		sb.WriteString("echo \"工作节点容器 IDs: ${worker_container_ids[@]}\"\n")
	}
	sb.WriteString("\n")

	// === Monitor loop ===
	sb.WriteString("# 监控所有容器状态，直到全部结束\n")
	sb.WriteString("declare -a all_container_ids=(\"$first_container_id\"")
	if len(workers) > 0 {
		sb.WriteString(" \"${worker_container_ids[@]}\"")
	}
	sb.WriteString(")\n")
	sb.WriteString(`
check_interval=10
monitor_count=0

while true; do
    monitor_count=$((monitor_count + 1))
    echo ""
    echo "===== 监控周期 $monitor_count ====="

    all_done=true
    for cid in "${all_container_ids[@]}"; do
        if [ -z "$cid" ]; then continue; fi
        status=$(ccon inspect "$cid" 2>/dev/null | jq -r '.status' 2>/dev/null)
        if [ $? -eq 0 ] && [ -n "$status" ]; then
            if [ "$status" = "1" ]; then
                echo "容器 $cid 状态: 运行中"
                all_done=false
                echo "容器 $cid 日志最后几行:"
                ccon logs --tail=3 "$cid" 2>/dev/null || echo "无法获取容器 $cid 日志"
            elif [ "$status" = "0" ]; then
                echo "容器 $cid 状态: 已停止"
            elif [ "$status" = "-1" ]; then
                echo "容器 $cid 状态: 启动失败"
            else
                echo "容器 $cid 状态: 未知 ($status)"
                all_done=false
            fi
        else
            echo "容器 $cid 状态: 无法获取，可能已结束"
        fi
    done

    if [ "$all_done" = true ]; then
        echo "所有容器都已结束，作业完成"
        cleanup_tensorboard
        break
    fi

    sleep $check_interval
done

echo "Job completed"
`)

	return sb.String(), nil
}
