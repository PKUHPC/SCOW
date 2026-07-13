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
  local pip_cmd=$1
  shift

  local -a pip_common_args=()
  if "${pip_cmd}" install --help 2>/dev/null | grep -q -- '--default-timeout'; then
    pip_common_args+=(--default-timeout 15)
  fi
  if "${pip_cmd}" install --help 2>/dev/null | grep -q -- '--retries'; then
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
    if "${pip_cmd}" install "${pip_common_args[@]}" "$@" -i "${pypi_source}" >>/tmp/jupyterlab.log 2>&1; then
      return 0
    fi
    echo "[WARN] 当前 PyPI 源安装失败: ${pypi_source}" >>/tmp/jupyterlab.log
  done

  return 1
}

function get_pip_break_system_packages_arg {
  local pip_cmd=$1

  if "${pip_cmd}" install --help 2>/dev/null | grep -q -- '--break-system-packages'; then
    echo "--break-system-packages"
  fi
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

  if ! command -v jupyter-lab >/dev/null 2>&1; then
    echo "[INFO] jupyter-lab is not installed, installing..." >>/tmp/jupyterlab.log

    PY_VERSION=$($PYTHON_CMD -c "import sys; print(sys.version_info[0])" 2>/dev/null)
    if [ "$PY_VERSION" = "3" ]; then
      echo "[INFO] Python3 detected, installing with pip3" >>/tmp/jupyterlab.log
      if command -v pip3 >/dev/null 2>&1; then
        pip_install_with_fallback pip3 --upgrade pip
        local BREAK_SYSTEM_PACKAGES_ARG=$(get_pip_break_system_packages_arg pip3)
        if ! pip_install_with_fallback pip3 ${BREAK_SYSTEM_PACKAGES_ARG} ipykernel jupyterlab; then
          echo "[ERROR] pip3 install jupyterlab failed" >>/tmp/jupyterlab.log
          return 1
        fi
        echo "[INFO] jupyterlab installed with pip3" >>/tmp/jupyterlab.log
      else
        echo "[ERROR] pip3 does not exist, please check Python3 environment" >>/tmp/jupyterlab.log
        return 1
      fi
    else
      echo "[INFO] Python2/default Python detected, installing with pip" >>/tmp/jupyterlab.log
      if command -v pip >/dev/null 2>&1; then
        pip_install_with_fallback pip --upgrade pip
        if ! pip_install_with_fallback pip ipykernel jupyterlab; then
          echo "[ERROR] pip install jupyterlab failed" >>/tmp/jupyterlab.log
          return 1
        fi
        echo "[INFO] jupyterlab installed with pip" >>/tmp/jupyterlab.log
      else
        echo "[ERROR] pip does not exist, please check Python environment" >>/tmp/jupyterlab.log
        return 1
      fi
    fi
  else
    echo "[INFO] jupyter-lab is already installed" >>/tmp/jupyterlab.log
  fi

  local HASHED_PASSWORD
  if ! HASHED_PASSWORD="$(get_jupyter_password_hash "$PASSWORD" "$PYTHON_CMD")" || [ -z "$HASHED_PASSWORD" ]; then
    echo "[ERROR] JupyterLab password hash generation failed. Please check if jupyter_server/notebook/IPython is installed" >>/tmp/jupyterlab.log
    return 1
  fi

  echo -e "{\"HOST\":\"$HOST\",\"PORT\":\"$SVCPORT\",\"PASSWORD\":\"$PASSWORD\"}" >$SERVER_SESSION_INFO

  jupyter-lab \
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
