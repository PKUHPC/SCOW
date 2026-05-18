#!/bin/bash

# 远程节点执行的部署脚本

# 配置部分
ADAPTER_BIN="/tmp/scow-crane-adapter"                       # 传输的二进制文件位置
ADAPTER_SERVICE="/tmp/adapter.service"                    # 传输的服务文件位置
ADAPTER_CONFIG="/tmp/config.yaml"                         # 传输的配置文件位置
TARGET_BIN="/adapter/scow-crane-adapter"                    # 目标安装路径
TARGET_SERVICE="/usr/lib/systemd/system/adapter.service"  # 服务配置路径
TARGET_CONFIG="/adapter/config/config.yaml"               # 目标配置文件位置

LOG_FILE="/tmp/deploy_adapter_remote.log"

# 记录日志
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========== 开始安装 adapter =========="

# 1. 检查并停止旧服务
if systemctl is-active --quiet adapter; then
    log "停止运行中的 adapter 服务..."
    systemctl stop adapter 2>&1 | tee -a "$LOG_FILE"
    systemctl disable adapter 2>&1 | tee -a "$LOG_FILE"
fi

# 2. 替换文件
log "安装新版本文件..."
install -Dm 755 "$ADAPTER_BIN" "$TARGET_BIN" 2>&1 | tee -a "$LOG_FILE"

# 检查目标服务文件是否存在，不存在则安装
if [ ! -f "$TARGET_SERVICE" ]; then
    install -Dm 644 "$ADAPTER_SERVICE" "$TARGET_SERVICE" 2>&1 | tee -a "$LOG_FILE"
else
    echo "文件已存在，跳过安装: $TARGET_SERVICE" | tee -a "$LOG_FILE"
fi

# 检查目标配置文件是否存在，不存在则安装
if [ ! -f "$TARGET_CONFIG" ]; then
    install -Dm 755 "$ADAPTER_CONFIG" "$TARGET_CONFIG" 2>&1 | tee -a "$LOG_FILE"
else
    echo "文件已存在，跳过安装: $TARGET_CONFIG" | tee -a "$LOG_FILE"
fi

# 3. 启动服务
log "重新加载服务配置..."
systemctl daemon-reload 2>&1 | tee -a "$LOG_FILE"

log "启动 adapter 服务..."
systemctl enable --now adapter 2>&1 | tee -a "$LOG_FILE"

# 4. 验证状态
if systemctl is-active --quiet adapter; then
    log "[SUCCESS] adapter 服务已正常运行"
    log "$(systemctl status adapter | head -n 5)"
else
    log "[ERROR] adapter 服务启动失败"
    log "错误详情：$(systemctl status adapter)"
    exit 1
fi

log "========== 安装完成 =========="