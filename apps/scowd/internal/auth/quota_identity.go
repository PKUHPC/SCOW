package auth

import (
	"fmt"
	"os/exec"
	"strings"
)

// ResolveUserID 将精确的登录用户名解析为本地文件系统配额工具所需的 UID。
// 对纯数字用户名必须校验名称，避免与 UID 产生歧义。
func ResolveUserID(username string) (string, error) {
	if isNumeric(username) {
		// 确保纯数字用户名一定是用户名
		resolvedName, err := getUsernameFromUsername(username)
		if err != nil || resolvedName != username {
			return "", fmt.Errorf("user %q was not resolved as an exact username", username)
		}
	}
	user, err := LookupUser(username)
	if err != nil {
		return "", err
	}
	if user.Username != username {
		return "", fmt.Errorf("resolved user %q does not match requested username %q", user.Username, username)
	}
	return user.UID, nil
}

// ResolveGroupID 解析配额接口传入的组标识。
// 非纯数字值按组名查询对应的 GID。
// 纯数字值由上游必须保证为 GID，SCOWD 当前实现无法优化处理纯数字 groupNames 的 gid 获取
func ResolveGroupID(groupNameOrGID string) (string, error) {
	if isNumeric(groupNameOrGID) {
		return groupNameOrGID, nil
	}
	group, err := lookupGroupWithGetent(groupNameOrGID)
	if err != nil {
		return "", err
	}
	return group.gid, nil
}

type groupIdentity struct {
	name string
	gid  string
}

func lookupGroupWithGetent(groupName string) (groupIdentity, error) {
	output, err := exec.Command("getent", "group", groupName).Output()
	if err != nil {
		return groupIdentity{}, fmt.Errorf("getent group command failed: %w", err)
	}

	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		group, err := parseGroupLine(line)
		if err != nil {
			continue
		}
		if group.name == groupName {
			return group, nil
		}
	}
	return groupIdentity{}, fmt.Errorf("group %q was not resolved as an exact group name", groupName)
}

func parseGroupLine(line string) (groupIdentity, error) {
	fields := strings.Split(line, ":")
	if len(fields) < 3 || fields[0] == "" || fields[2] == "" {
		return groupIdentity{}, fmt.Errorf("invalid group line format: %s", line)
	}
	return groupIdentity{name: fields[0], gid: fields[2]}, nil
}
