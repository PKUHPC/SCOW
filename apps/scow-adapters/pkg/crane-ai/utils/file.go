package utils

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"sync"

	log "github.com/sirupsen/logrus"
)

var ErrJobInfoNotFound = errors.New("job info not found")

type SubmitJobInfo struct {
	JobName        string  `json:"new_job_name"`
	JobId          uint32  `json:"job_id"`
	JobType        string  `json:"job_type,omitempty"`
	ContainerPorts []int32 `json:"container_ports"`
}

// ServerSessionContent web json file
type ServerSessionContent struct {
	HOST     string `json:"HOST"`
	PORT     string `json:"PORT"`
	PASSWORD string `json:"PASSWORD"`
}

// JobManager 作业信息管理器（封装文件操作和并发锁）
type JobManager struct {
	filePath string       // 数据文件路径：/adapter/jobs/jobs.json
	mu       sync.RWMutex // 读写锁：读并发、写互斥，提升性能
}

// NewJobManager 创建作业管理器实例（初始化目录+文件）
func NewJobManager(filePath string) (*JobManager, error) {
	jm := &JobManager{
		filePath: filePath,
	}

	// 1. 确保父目录存在
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create parent dir %s failed: %w", dir, err)
	}

	// 2. 若文件不存在则创建空文件（避免首次读取报错）
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		f, err := os.Create(filePath)
		if err != nil {
			return nil, fmt.Errorf("create empty file %s failed: %w", filePath, err)
		}
		// 写入空数组，保证JSON格式合法
		emptyData := []byte("[]")
		if _, err := f.Write(emptyData); err != nil {
			f.Close()
			return nil, fmt.Errorf("write empty data to %s failed: %w", filePath, err)
		}
		f.Close()
		log.Infof("created empty job file: %s", filePath)
	} else if err != nil {
		return nil, fmt.Errorf("check file %s failed: %w", filePath, err)
	}

	return jm, nil
}

// SaveJobInfo 提交/更新作业信息（原子写入，并发安全）
// 存在相同JobId则覆盖，否则新增
func (jm *JobManager) SaveJobInfo(info *SubmitJobInfo) error {
	if info == nil || info.JobId == 0 {
		return fmt.Errorf("invalid job info: nil or jobId=0")
	}

	jm.mu.Lock()
	defer jm.mu.Unlock()

	// 1. 读取现有数据
	var jobList []*SubmitJobInfo
	data, err := os.ReadFile(jm.filePath)
	if err != nil {
		return fmt.Errorf("read job file failed: %w", err)
	}
	if err := json.Unmarshal(data, &jobList); err != nil {
		return fmt.Errorf("unmarshal job data failed: %w", err)
	}

	// 2. 去重/更新（按JobId唯一标识）
	found := false
	for i, job := range jobList {
		if job.JobId == info.JobId {
			jobList[i] = info // 覆盖现有作业信息
			found = true
			break
		}
	}
	if !found {
		jobList = append(jobList, info) // 新增作业
	}

	// 3. 原子写入（先写临时文件，再重命名）
	tempFile := jm.filePath + ".tmp"
	// 序列化数据（格式化，便于阅读）
	output, err := json.MarshalIndent(jobList, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal job data failed: %w", err)
	}
	// 写入临时文件
	if err := os.WriteFile(tempFile, output, 0644); err != nil {
		return fmt.Errorf("write temp file failed: %w", err)
	}
	// 原子替换原文件（rename是原子操作，避免文件损坏）
	if err := os.Rename(tempFile, jm.filePath); err != nil {
		// 失败时清理临时文件
		os.Remove(tempFile)
		return fmt.Errorf("rename temp file failed: %w", err)
	}

	log.Infof("submit job success: jobId=%d, jobName=%s", info.JobId, info.JobName)
	return nil
}

// DeleteJobInfo 根据JobId删除作业信息（原子写入，并发安全）
func (jm *JobManager) DeleteJobInfo(jobId uint32) error {
	if jobId == 0 {
		return fmt.Errorf("invalid jobId: 0")
	}

	jm.mu.Lock()
	defer jm.mu.Unlock()

	// 1. 读取现有数据
	var jobList []*SubmitJobInfo
	data, err := os.ReadFile(jm.filePath)
	if err != nil {
		return fmt.Errorf("read job file failed: %w", err)
	}
	if err := json.Unmarshal(data, &jobList); err != nil {
		return fmt.Errorf("unmarshal job data failed: %w", err)
	}

	// 2. 过滤掉要删除的作业
	newJobList := make([]*SubmitJobInfo, 0, len(jobList))
	found := false
	for _, job := range jobList {
		if job.JobId != jobId {
			newJobList = append(newJobList, job)
		} else {
			found = true
		}
	}
	if !found {
		return fmt.Errorf("jobId %d not found", jobId)
	}

	// 3. 原子写入新数据
	tempFile := jm.filePath + ".tmp"
	output, err := json.MarshalIndent(newJobList, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal job data failed: %w", err)
	}
	if err := os.WriteFile(tempFile, output, 0644); err != nil {
		return fmt.Errorf("write temp file failed: %w", err)
	}
	if err := os.Rename(tempFile, jm.filePath); err != nil {
		os.Remove(tempFile)
		return fmt.Errorf("rename temp file failed: %w", err)
	}

	log.Infof("cancel job success: jobId=%d", jobId)
	return nil
}

// QueryJobInfo 根据JobName和JobId查询作业信息（并发安全，支持多条件）
func (jm *JobManager) QueryJobInfo(jobId uint32) (*SubmitJobInfo, error) {
	if jobId == 0 {
		return nil, fmt.Errorf("invalid query params: both jobName and jobId are empty")
	}

	jm.mu.RLock() // 读锁，支持并发读
	defer jm.mu.RUnlock()

	// 1. 读取数据
	var jobList []*SubmitJobInfo
	data, err := os.ReadFile(jm.filePath)
	if err != nil {
		return nil, fmt.Errorf("read job file failed: %w", err)
	}
	if err := json.Unmarshal(data, &jobList); err != nil {
		return nil, fmt.Errorf("unmarshal job data failed: %w", err)
	}

	// 2. 按条件查询
	for _, job := range jobList {
		if job.JobId == jobId {
			return job, nil
		}
	}

	return nil, fmt.Errorf("%w: jobId=%d", ErrJobInfoNotFound, jobId)
}

// SaveJobSubmitInfoToFile 将请求序列化为 JSON 并写入 /adapter/jobs/<jobName>
func SaveJobSubmitInfoToFile(info *SubmitJobInfo) error {
	// 确保目录存在
	parentDir := filepath.Dir(JobsInfos)
	// 检查并创建上级目录（仅当不存在时创建）
	if _, err := os.Stat(parentDir); os.IsNotExist(err) {
		if err := os.MkdirAll(parentDir, 0755); err != nil {
			return fmt.Errorf("create parent directory %s: %w", parentDir, err)
		}
	} else if err != nil {
		// 处理 stat 操作本身的错误（如权限不足）
		return fmt.Errorf("check parent directory %s: %w", parentDir, err)
	}

	path := filepath.Join(parentDir, info.JobName)
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create file %s: %w", path, err)
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(info); err != nil {
		return fmt.Errorf("encode json: %w", err)
	}
	return nil
}

// LoadJobSubmitInfoFromFile 从 /adapter/jobs/ 读取 JSON 并还原为 SubmitJobInfo
func LoadJobSubmitInfoFromFile(jobName string) (*SubmitJobInfo, error) {
	if jobName == "" {
		return nil, fmt.Errorf("newJobName is empty")
	}

	path := filepath.Join(filepath.Dir(JobsInfos), jobName)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read file %s: %w", path, err)
	}

	jobInfo := &SubmitJobInfo{}
	if err := json.Unmarshal(data, jobInfo); err != nil {
		return nil, fmt.Errorf("unmarshal json: %w", err)
	}

	return jobInfo, nil
}

// DeleteJobSubmitInfoFile 根据作业名删除对应文件
func DeleteJobSubmitInfoFile(jobName string) error {
	if jobName == "" {
		return fmt.Errorf("newJobName is empty")
	}

	parentDir := filepath.Dir(JobsInfos)

	path := filepath.Join(parentDir, jobName)
	if err := os.Remove(path); err != nil {
		return fmt.Errorf("delete file %s: %w", path, err)
	}
	return nil
}

// GetWebJobFileContent 获取web类应用文件内容
func GetWebJobFileContent(filePath string) (int, string, error) {
	var serverSessionContent ServerSessionContent
	fileContent, err := ioutil.ReadFile(filePath)
	if err != nil {
		return 0, "", err
	}
	err = json.Unmarshal(fileContent, &serverSessionContent)
	if err != nil {
		return 0, "", err
	}

	port, _ := strconv.Atoi(serverSessionContent.PORT)
	return port, serverSessionContent.PASSWORD, nil
}
