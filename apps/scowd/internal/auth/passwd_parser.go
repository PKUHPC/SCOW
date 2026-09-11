package auth

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// UserInfo represents user information from /etc/passwd
type UserInfo struct {
	Username string
	UID      string
	GID      string
	HomeDir  string
}

// LookupUser looks up a user by username without using CGO
// 支持本地用户（/etc/passwd）和 LDAP 用户（通过 getent 命令）
func LookupUser(username string) (*UserInfo, error) {
	// 首先尝试使用 getent 命令，这能处理 LDAP、NIS 等外部认证系统
	if userInfo, err := lookupUserWithGetent(username); err == nil {
		return userInfo, nil
	}

	// 如果 getent 失败，回退到直接读取 /etc/passwd
	return lookupUserFromPasswd(username)
}

// lookupUserWithGetent 使用 getent 命令查找用户信息
func lookupUserWithGetent(username string) (*UserInfo, error) {
	// 如果用户名是纯数字，先使用 id 命令获取 UID，避免 getent 将其解释为 UID
	var lookupValue string
	if isNumeric(username) {
		// 使用 id 命令获取 UID
		uid, err := getUIDFromUsername(username)
		if err != nil {
			// 如果 id 命令失败，回退到直接使用用户名
			lookupValue = username
		} else {
			lookupValue = uid
		}
	} else {
		lookupValue = username
	}

	cmd := exec.Command("getent", "passwd", lookupValue)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("getent command failed: %w", err)
	}

	line := strings.TrimSpace(string(output))
	if line == "" {
		return nil, fmt.Errorf("user %s not found via getent", username)
	}

	return parsePasswdLine(line)
}

// isNumeric 检查字符串是否为纯数字
// 不使用正则只做轻量检查
func isNumeric(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func getUsernameFromUsername(username string) (string, error) {
	cmd := exec.Command("id", "-un", username)
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("id command failed: %w", err)
	}
	return strings.TrimSpace(string(output)), nil
}

// getUIDFromUsername 使用 id 命令获取用户的 UID
func getUIDFromUsername(username string) (string, error) {
	cmd := exec.Command("id", "-u", username)
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("id command failed: %w", err)
	}

	uid := strings.TrimSpace(string(output))
	if uid == "" {
		return "", fmt.Errorf("failed to get UID for user %s", username)
	}

	return uid, nil
}

// lookupUserFromPasswd 从 /etc/passwd 文件查找用户信息
func lookupUserFromPasswd(username string) (*UserInfo, error) {
	file, err := os.Open("/etc/passwd")
	if err != nil {
		return nil, fmt.Errorf("failed to open /etc/passwd: %w", err)
	}
	defer func() {
		_ = file.Close()
	}()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}

		fields := strings.Split(line, ":")
		if len(fields) < 6 {
			continue
		}

		if fields[0] == username {
			return parsePasswdLine(line)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading /etc/passwd: %w", err)
	}

	return nil, fmt.Errorf("user %s not found", username)
}

// parsePasswdLine 解析 passwd 格式的行
func parsePasswdLine(line string) (*UserInfo, error) {
	fields := strings.Split(line, ":")
	if len(fields) < 6 {
		return nil, fmt.Errorf("invalid passwd line format: %s", line)
	}

	return &UserInfo{
		Username: fields[0],
		UID:      fields[2],
		GID:      fields[3],
		HomeDir:  fields[5],
	}, nil
}

// LookupUserByID looks up a user by UID without using CGO
// 支持本地用户（/etc/passwd）和 LDAP 用户（通过 getent 命令）
func LookupUserByID(uid string) (*UserInfo, error) {
	// 首先尝试使用 getent 命令
	if userInfo, err := lookupUserByIDWithGetent(uid); err == nil {
		return userInfo, nil
	}

	// 如果 getent 失败，回退到直接读取 /etc/passwd
	return lookupUserByIDFromPasswd(uid)
}

// lookupUserByIdWithGetent 使用 getent 命令通过 UID 查找用户信息
func lookupUserByIDWithGetent(uid string) (*UserInfo, error) {
	cmd := exec.Command("getent", "passwd", uid)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("getent command failed: %w", err)
	}

	line := strings.TrimSpace(string(output))
	if line == "" {
		return nil, fmt.Errorf("user with UID %s not found via getent", uid)
	}

	return parsePasswdLine(line)
}

// lookupUserByIDFromPasswd 从 /etc/passwd 文件通过 UID 查找用户信息
func lookupUserByIDFromPasswd(uid string) (*UserInfo, error) {
	file, err := os.Open("/etc/passwd")
	if err != nil {
		return nil, fmt.Errorf("failed to open /etc/passwd: %w", err)
	}
	defer func() {
		_ = file.Close()
	}()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}

		fields := strings.Split(line, ":")
		if len(fields) < 6 {
			continue
		}

		if fields[2] == uid {
			return parsePasswdLine(line)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading /etc/passwd: %w", err)
	}

	return nil, fmt.Errorf("user with UID %s not found", uid)
}

// GetUserGroupIds gets all group IDs for a user without using CGO
// 支持本地组（/etc/group）和 LDAP 组（通过 getent 和 id 命令）
func GetUserGroupIds(username string) ([]string, error) {
	// 首先尝试使用 id 命令获取用户的所有组ID，这能处理 LDAP 等外部认证系统
	if groupIds, err := getUserGroupIdsWithID(username); err == nil {
		return groupIds, nil
	}

	// 如果 id 命令失败，回退到读取 /etc/group
	return getUserGroupIdsFromGroup(username)
}

// getUserGroupIdsWithId 使用 id 命令获取用户的所有组ID
func getUserGroupIdsWithID(username string) ([]string, error) {
	cmd := exec.Command("id", "-G", username)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("id command failed: %w", err)
	}

	line := strings.TrimSpace(string(output))
	if line == "" {
		return []string{}, nil
	}

	// id -G 返回空格分隔的组ID列表
	groupIds := strings.Fields(line)
	return groupIds, nil
}

// getUserGroupIdsFromGroup 从 /etc/group 文件获取用户的组ID
func getUserGroupIdsFromGroup(username string) ([]string, error) {
	file, err := os.Open("/etc/group")
	if err != nil {
		return nil, fmt.Errorf("failed to open /etc/group: %w", err)
	}
	defer func() {
		_ = file.Close()
	}()

	var groupIds []string
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}

		fields := strings.Split(line, ":")
		if len(fields) < 4 {
			continue
		}

		groupID := fields[2]
		members := fields[3]

		// Check if user is in this group's member list
		if members != "" {
			memberList := strings.Split(members, ",")
			for _, member := range memberList {
				if strings.TrimSpace(member) == username {
					groupIds = append(groupIds, groupID)
					break
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading /etc/group: %w", err)
	}

	return groupIds, nil
}
