#!/bin/bash
# 脚本名称：deploy_adapter.sh
# 功能：将部署文件传输到远程节点并执行部署脚本
# 用法：./deploy_adapter.sh

# 配置部分
REMOTE_NODE="crane01"            # 目标节点（可修改为IP）
REMOTE_USER="root"               # 远程登录用户
LOCAL_FILES=("deploy_adapter.sh" "scow-crane-adapter" "config.yaml" "adapter.service")  # 待传输文件列表
LOG_FILE="deploy_$(date +%Y%m%d_%H%M%S).log"  # 日志文件

# 函数：记录日志（带时间戳）
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 主流程
log "========== 开始部署 crane01 adapter 服务 =========="

# 第一阶段：文件传输
log "开始向节点 $REMOTE_NODE 传输文件..."
for file in "${LOCAL_FILES[@]}"; do
    if [ ! -f "/tmp/$file" ]; then
        log "[ERROR] 本地文件 /tmp/$file 不存在！"
        exit 1
    fi

    log "传输文件 /tmp/$file ..."
    scp -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
        "/tmp/$file" "${REMOTE_USER}@${REMOTE_NODE}:/tmp/" 2>&1 | tee -a "$LOG_FILE"

    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        log "[ERROR] 文件 /tmp/$file 传输失败"
        exit 1
    fi
done
log "[SUCCESS] 所有文件传输完成"

# 第二阶段：远程部署
log "在节点 $REMOTE_NODE 执行部署脚本..."
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 \
    "${REMOTE_USER}@${REMOTE_NODE}" "bash /tmp/deploy_adapter.sh" 2>&1 | tee -a "$LOG_FILE"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    log "[SUCCESS] 节点 $REMOTE_NODE 部署完成"
else
    log "[ERROR] 节点 $REMOTE_NODE 部署失败"
    exit 1
fi

log "========== 部署 crane01 结束 =========="
