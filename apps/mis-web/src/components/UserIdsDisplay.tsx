import { Tooltip } from "antd";
import React from "react";

interface Props {
  userIds: string[];
}

export const UserIdsDisplay: React.FC<Props> = ({ userIds }) => {
  // 确保userIds是一个数组
  if (!userIds || userIds.length === 0) {
    return null;
  }

  // 取前三个用户ID
  const displayUsers = userIds.slice(0, 3);
  // 剩余的用户ID数量
  const remainingCount = userIds.length - 3;

  return (
    <span>
      {displayUsers.join(", ")}
      {remainingCount > 0 && (
        <>
          {", "}
          <Tooltip
            title={
              <div>
                {userIds.slice(3).map((userId, index) => (
                  <div key={index}>{userId}</div>
                ))}
              </div>
            }
          >
            <span style={{ cursor: "pointer", textDecoration: "underline" }}>等{remainingCount}个</span>
          </Tooltip>
        </>
      )}
    </span>
  );
};

export default UserIdsDisplay;
