#!/bin/bash

# -------------------------------------------------------
# entry.sh - 支持 --key=value 或 --key value 传参
# 模式: jupyterlab / vscode / both
# -------------------------------------------------------

function get_password {
  local password=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c$1)
  echo $password
}

function get_jupyter_password_hash {
  local password=$1
  local python_cmd=$2

  PASSWORD="$password" "$python_cmd" - <<'PY'
from __future__ import print_function
import os

try:
    from jupyter_server.auth import passwd
except ImportError:
    try:
        from notebook.auth import passwd
    except ImportError:
        from IPython.lib.security import passwd

print(passwd(os.environ["PASSWORD"], algorithm="sha1"))
PY
}

function pip_install_with_fallback {
  local python_cmd=$1
  shift

  local -a pip_common_args=()
  if "${python_cmd}" -m pip install --help 2>/dev/null | grep -q -- '--default-timeout'; then
    pip_common_args+=(--default-timeout 15)
  fi
  if "${python_cmd}" -m pip install --help 2>/dev/null | grep -q -- '--retries'; then
    pip_common_args+=(--retries 1)
  fi

  local -a pypi_sources=(
    "https://mirrors.aliyun.com/pypi/simple/"
    "https://mirrors.pku.edu.cn/pypi/web/simple/"
    "https://pypi.tuna.tsinghua.edu.cn/simple/"
    "https://mirrors.ustc.edu.cn/pypi/simple/"
  )

  local pypi_source
  for pypi_source in "${pypi_sources[@]}"; do
    echo "[INFO] 使用 PyPI 源: ${pypi_source}" >>/tmp/jupyterlab.log
    if "${python_cmd}" -m pip install "${pip_common_args[@]}" "$@" -i "${pypi_source}" >>/tmp/jupyterlab.log 2>&1; then
      return 0
    fi
    echo "[WARN] 当前 PyPI 源安装失败: ${pypi_source}" >>/tmp/jupyterlab.log
  done

  return 1
}

function is_system_python {
  local python_cmd=$1
  local python_path

  python_path=$("${python_cmd}" -c 'import os, sys; print(os.path.realpath(sys.executable))' 2>/dev/null) || return 1
  case "$python_path" in
    /usr/bin/python|/usr/bin/python[0-9]*) return 0 ;;
    *) return 1 ;;
  esac
}

function install_pip_with_package_manager {
  if [ "$(id -u)" -ne 0 ]; then
    echo "[WARN] 当前用户不是 root，跳过系统包管理器安装 pip" >>/tmp/jupyterlab.log
    return 1
  fi

  if command -v apt-get >/dev/null 2>&1; then
    if ! DEBIAN_FRONTEND=noninteractive apt-get \
      -o Acquire::http::Timeout=30 \
      -o Acquire::https::Timeout=30 \
      -o Acquire::Retries=1 update >>/tmp/jupyterlab.log 2>&1 || \
      ! DEBIAN_FRONTEND=noninteractive apt-get \
      -o Acquire::http::Timeout=30 \
      -o Acquire::https::Timeout=30 \
      -o Acquire::Retries=1 install -y python3-pip >>/tmp/jupyterlab.log 2>&1; then
      echo "[WARN] apt-get 安装 python3-pip 失败" >>/tmp/jupyterlab.log
      return 1
    fi
  elif command -v apk >/dev/null 2>&1; then
    if ! apk --timeout 30 add --no-cache py3-pip >>/tmp/jupyterlab.log 2>&1; then
      echo "[WARN] apk 安装 py3-pip 失败" >>/tmp/jupyterlab.log
      return 1
    fi
  elif command -v dnf >/dev/null 2>&1; then
    if ! dnf --setopt=timeout=30 --setopt=retries=1 install -y python3-pip >>/tmp/jupyterlab.log 2>&1; then
      echo "[WARN] dnf 安装 python3-pip 失败" >>/tmp/jupyterlab.log
      return 1
    fi
  elif command -v yum >/dev/null 2>&1; then
    if ! yum --setopt=timeout=30 --setopt=retries=1 install -y python3-pip >>/tmp/jupyterlab.log 2>&1; then
      echo "[WARN] yum 安装 python3-pip 失败" >>/tmp/jupyterlab.log
      return 1
    fi
  else
    echo "[WARN] 未找到支持的系统包管理器（apt-get/apk/dnf/yum）" >>/tmp/jupyterlab.log
    return 1
  fi

  return 0
}

function ensure_pip {
  local python_cmd=$1

  if "${python_cmd}" -m pip --version >/dev/null 2>&1; then
    return 0
  fi

  echo "[INFO] pip 模块未安装，尝试使用 ensurepip 安装" >>/tmp/jupyterlab.log
  if "${python_cmd}" -m ensurepip --upgrade >>/tmp/jupyterlab.log 2>&1 && \
    "${python_cmd}" -m pip --version >/dev/null 2>&1; then
    return 0
  fi

  echo "[WARN] ensurepip 不可用，尝试使用系统包管理器安装 pip" >>/tmp/jupyterlab.log
  if ! is_system_python "$python_cmd"; then
    echo "[INFO] 当前 Python 不是发行版 Python，跳过系统包管理器安装 pip" >>/tmp/jupyterlab.log
    return 1
  fi
  if install_pip_with_package_manager && \
    "${python_cmd}" -m pip --version >/dev/null 2>&1; then
    echo "[INFO] 使用系统包管理器安装 pip 完成" >>/tmp/jupyterlab.log
    return 0
  fi

  echo "[ERROR] pip、ensurepip 和系统包管理器均不可用，无法安装 pip" >>/tmp/jupyterlab.log
  return 1
}

function pip_supports_break_system_packages {
  local python_cmd=$1

  "${python_cmd}" -m pip install --help 2>/dev/null | grep -q -- '--break-system-packages'
}

function start_jupyterlab {
  local PORT=$1
  local HOST=$2
  local SVCPORT=$3
  local PROXY_BASE_PATH=$4
  local SERVER_SESSION_INFO=/tmp/server_session_jupyterlab.json
  local PASSWORD=$(get_password 12)
  local PYTHON_CMD
  local PY_VERSION

  if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD=python3
  elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD=python
  else
    echo "[ERROR] python3 和 python 均不存在，请检查 Python 环境" >>/tmp/jupyterlab.log
    return 1
  fi

  PY_VERSION=$("$PYTHON_CMD" -c "import sys; print(sys.version_info[0])" 2>/dev/null)
  if [ "$PY_VERSION" != "3" ]; then
    echo "[ERROR] JupyterLab 需要 Python3 环境" >>/tmp/jupyterlab.log
    return 1
  fi

  if ! "${PYTHON_CMD}" -m jupyterlab --version >/dev/null 2>&1; then
    echo "[INFO] jupyter-lab is not installed, installing..." >>/tmp/jupyterlab.log

    if ! ensure_pip "$PYTHON_CMD"; then
      return 1
    fi

    local -a PIP_SYSTEM_PACKAGE_ARGS=()
    if pip_supports_break_system_packages "$PYTHON_CMD"; then
      PIP_SYSTEM_PACKAGE_ARGS+=(--break-system-packages)
    fi

    if ! pip_install_with_fallback "$PYTHON_CMD" "${PIP_SYSTEM_PACKAGE_ARGS[@]}" --upgrade pip; then
      echo "[WARN] pip 升级失败，继续使用当前版本安装 JupyterLab" >>/tmp/jupyterlab.log
    fi
    if ! pip_install_with_fallback "$PYTHON_CMD" "${PIP_SYSTEM_PACKAGE_ARGS[@]}" ipykernel jupyterlab; then
      echo "[ERROR] 使用 ${PYTHON_CMD} -m pip 安装 jupyterlab 失败" >>/tmp/jupyterlab.log
      return 1
    fi
    echo "[INFO] 使用 ${PYTHON_CMD} -m pip 安装 jupyterlab 完成" >>/tmp/jupyterlab.log
  else
    echo "[INFO] jupyter-lab is already installed" >>/tmp/jupyterlab.log
  fi

  local HASHED_PASSWORD
  if ! HASHED_PASSWORD="$(get_jupyter_password_hash "$PASSWORD" "$PYTHON_CMD")" || [ -z "$HASHED_PASSWORD" ]; then
    echo "[ERROR] JupyterLab password hash generation failed. Please check if jupyter_server/notebook/IPython is installed" >>/tmp/jupyterlab.log
    return 1
  fi

  echo -e "{\"HOST\":\"$HOST\",\"PORT\":\"$SVCPORT\",\"PASSWORD\":\"$PASSWORD\"}" >$SERVER_SESSION_INFO

  "${PYTHON_CMD}" -m jupyterlab \
    --ServerApp.ip='0.0.0.0' \
    --ServerApp.port=${PORT} \
    --ServerApp.port_retries=0 \
    --ServerApp.password="${HASHED_PASSWORD}" \
    --ServerApp.open_browser=False \
    --ServerApp.base_url="${PROXY_BASE_PATH}/${HOST}/${SVCPORT}/" \
    --ServerApp.allow_origin='*' \
    --ServerApp.disable_check_xsrf=True \
    --allow-root >>/tmp/jupyterlab.log 2>&1
}

function start_vscode {
  local PORT=$1
  local HOST=$2
  local SVCPORT=$3
  local VSCODE=$4
  local SERVER_SESSION_INFO=/tmp/server_session_vscode.json
  local PASSWORD=$(get_password 12)

  echo -e "{\"HOST\":\"$HOST\",\"PORT\":\"$SVCPORT\",\"PASSWORD\":\"$PASSWORD\"}" >$SERVER_SESSION_INFO
  PASSWORD=$PASSWORD ${VSCODE} -vvv --bind-addr 0.0.0.0:$PORT --auth password >>/tmp/vscode.log 2>&1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --mode=*) MODE="${1#*=}"; shift ;;
    --mode) MODE="$2"; shift 2 ;;
    --jupyter-port=*) JUPYTER_PORT="${1#*=}"; shift ;;
    --jupyter-port) JUPYTER_PORT="$2"; shift 2 ;;
    --host=*) HOST="${1#*=}"; shift ;;
    --host) HOST="$2"; shift 2 ;;
    --jupyter-svcport=*) JUPYTER_SVCPORT="${1#*=}"; shift ;;
    --jupyter-svcport) JUPYTER_SVCPORT="$2"; shift 2 ;;
    --jupyter-proxy=*) JUPYTER_PROXY="${1#*=}"; shift ;;
    --jupyter-proxy) JUPYTER_PROXY="$2"; shift 2 ;;
    --vscode-port=*) VSCODE_PORT="${1#*=}"; shift ;;
    --vscode-port) VSCODE_PORT="$2"; shift 2 ;;
    --vscode-svcport=*) VSCODE_SVCPORT="${1#*=}"; shift ;;
    --vscode-svcport) VSCODE_SVCPORT="$2"; shift 2 ;;
    --vscode-bin=*) VSCODE_BIN="${1#*=}"; shift ;;
    --vscode-bin) VSCODE_BIN="$2"; shift 2 ;;
    *) echo "[WARN] Unknown option $1"; shift ;;
  esac
done

function main {
  local startup='tail -f /dev/null'
  case "$MODE" in
    jupyterlab)
      start_jupyterlab "$JUPYTER_PORT" "$HOST" "$JUPYTER_SVCPORT" "$JUPYTER_PROXY" &
      ${startup}
      ;;
    vscode)
      start_vscode "$VSCODE_PORT" "$HOST" "$VSCODE_SVCPORT" "$VSCODE_BIN" &
      ${startup}
      ;;
    both)
      start_jupyterlab "$JUPYTER_PORT" "$HOST" "$JUPYTER_SVCPORT" "$JUPYTER_PROXY" &
      PID1=$!
      start_vscode "$VSCODE_PORT" "$HOST" "$VSCODE_SVCPORT" "$VSCODE_BIN" &
      PID2=$!
      echo "[INFO] JupyterLab PID: $PID1, VSCode PID: $PID2"
      ${startup}
      ;;
    *)
      echo "Usage: $0 --mode=(jupyterlab|vscode|both) [options...]"
      ${startup}
      ;;
  esac
}

main "$@"
