package auth

import (
	"fmt"
	"strconv"

	"github.com/sirupsen/logrus"
)

func GetUserInfo(userName string) (uint32, uint32, []int, error) {
	// 查找用户信息
	u, err := LookupUser(userName)
	if err != nil {
		return 0, 0, nil, fmt.Errorf("lookup user %q: %w", userName, err)
	}

	// 解析 UID
	uid, err := strconv.ParseUint(u.UID, 10, 32)
	if err != nil {
		return 0, 0, nil, fmt.Errorf("parse UID %q for user %q: %w", u.UID, userName, err)
	}

	// 解析 GID
	gid, err := strconv.ParseUint(u.GID, 10, 32)
	if err != nil {
		return 0, 0, nil, fmt.Errorf("parse GID %q for user %q: %w", u.GID, userName, err)
	}

	// 获取用户的所有组ID
	groupIds, err := GetUserGroupIds(userName)
	if err != nil {
		return 0, 0, nil, fmt.Errorf("get group IDs for user %q: %w", userName, err)
	}

	// 转换组ID为整数切片
	var groups []int
	for _, groupIDStr := range groupIds {
		groupID, err := strconv.Atoi(groupIDStr)
		if err != nil {
			logrus.Warnf("GetUserInfo: 跳过无法解析的组 ID %q (用户 %q): %v", groupIDStr, userName, err)
			continue
		}
		groups = append(groups, groupID)
	}

	logrus.Debugf("GetUserInfo: user=%q uid=%d gid=%d groups=%v", userName, uid, gid, groups)

	return uint32(uid), uint32(gid), groups, nil
}
