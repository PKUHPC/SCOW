#!/usr/bin/env bash

set -u
set -o pipefail

###############################################################################
# AI 公共资产迁移脚本草案
#
# 处理范围：
# - dataset / dataset_version
# - algorithm / algorithm_version
# - model / model_version
#
# 核心行为：
# - 只迁移当前处于 SHARED 状态的版本
# - 保留原用户主记录
# - 新建一套平台公共资产主记录和版本记录
# - 新平台主记录 is_shared = 1, is_platform_owned = 1
# - 新平台版本 private_path = path = 迁移后的公共目录路径
# - 原用户已分享版本回写为 UNSHARED，且 path = private_path
# - 单条失败继续执行，最后统一输出成功/失败清单
#
# 安全约束：
# - 默认 DRY_RUN=1，只预演不落库、不删旧目录
# - 正式执行前必须补齐数据库参数和 CLUSTER_PUBLIC_PATH_MAP
###############################################################################

: "${MYSQL_HOST:=127.0.0.1}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_USER:=root}"
: "${MYSQL_PASSWORD:=}"
: "${MYSQL_DATABASE:=scow_ai}"

# DRY_RUN=1 时只打印预演日志，不真正复制文件、不改数据库、不删除旧 shared 目录。
: "${DRY_RUN:=1}"
# 当 clusterPublicPath/Migration 已存在且希望本次强制落到新目录时，置为 1。
: "${FORCE_NEW_MIGRATION_ROOT:=0}"
: "${MIGRATION_ROOT_NAME:=Migration}"
# 成功/失败清单默认输出到 /tmp，运维可在执行前自行覆盖。
: "${SUCCESS_FILE:=/tmp/ai-public-asset-migration.success.tsv}"
: "${FAILURES_FILE:=/tmp/ai-public-asset-migration.failures.tsv}"

declare -A CLUSTER_PUBLIC_PATH_MAP=(
  # 这里填写各 cluster_id 对应的 clusterPublicPath。
  # 例如：["ai1"]="/data/.public"
  # ["ai1"]="/data/.public"
)

declare -A MIGRATION_ROOT_CACHE=()
declare -A RESERVED_DATASET_NAMES=()
declare -A RESERVED_ALGORITHM_NAMES=()
declare -A RESERVED_MODEL_NAMES=()

# 强制使用 utf8mb4，避免中文或特殊符号在 mysql 客户端读写过程中被写成乱码或 ??。
MYSQL_BIN=(mysql --default-character-set=utf8mb4 --batch --raw --skip-column-names -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER}")

mkdir -p "$(dirname "${SUCCESS_FILE}")" "$(dirname "${FAILURES_FILE}")"
: > "${SUCCESS_FILE}"
: > "${FAILURES_FILE}"
printf 'asset_type\tsource_id\tsource_name\ttarget_name\tcluster_id\ttarget_path\n' >> "${SUCCESS_FILE}"
printf 'asset_type\tsource_id\tsource_name\towner\tcluster_id\tstage\tmessage\n' >> "${FAILURES_FILE}"

log() {
  local level="$1"
  shift
  printf '[%s] [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${level}" "$*"
}

mysql_query() {
  local sql="$1"
  # 显式重定向 stdin 为 /dev/null，防止在 while 循环内调用时 mysql 客户端（或其 Docker wrapper）
  # 意外消费循环的管道输入，导致后续行丢失
  MYSQL_PWD="${MYSQL_PASSWORD}" "${MYSQL_BIN[@]}" "${MYSQL_DATABASE}" -e "${sql}" < /dev/null
}

mysql_exec_file() {
  local file="$1"
  MYSQL_PWD="${MYSQL_PASSWORD}" "${MYSQL_BIN[@]}" "${MYSQL_DATABASE}" < "${file}"
}

sanitize_field() {
  local value="$1"
  value="${value//$'\t'/ }"
  value="${value//$'\n'/ }"
  value="${value//$'\r'/ }"
  printf '%s' "${value}"
}

sql_escape() {
  local value="$1"
  value="$(sanitize_field "${value}")"
  value="${value//\\/\\\\}"
  value="${value//\'/\'\'}"
  printf '%s' "${value}"
}

sql_quote_nullable() {
  local value="$1"
  if [[ "${value}" == "\\N" ]]; then
    printf 'NULL'
  else
    printf "'%s'" "$(sql_escape "${value}")"
  fi
}

failure() {
  local type="$1"
  local id="$2"
  local name="$3"
  local owner="$4"
  local cluster_id="$5"
  local stage="$6"
  local message="$7"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "${type}" "${id}" "$(sanitize_field "${name}")" "${owner}" "${cluster_id}" "${stage}" "$(sanitize_field "${message}")" \
    >> "${FAILURES_FILE}"
  log ERROR "${type}#${id} ${stage}: ${message}"
}

success() {
  local type="$1"
  local id="$2"
  local source_name="$3"
  local target_name="$4"
  local cluster_id="$5"
  local target_path="$6"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
    "${type}" "${id}" "$(sanitize_field "${source_name}")" "$(sanitize_field "${target_name}")" "${cluster_id}" "$(sanitize_field "${target_path}")" \
    >> "${SUCCESS_FILE}"
  log INFO "${type}#${id} migrated: ${source_name} -> ${target_name} (${target_path})"
}

require_cluster_public_path() {
  local cluster_id="$1"
  local path="${CLUSTER_PUBLIC_PATH_MAP[${cluster_id}]:-}"
  if [[ -z "${path}" ]]; then
    return 1
  fi
  printf '%s' "${path}"
}

resolve_owner_group() {
  local cluster_public_path="$1"
  stat -c '%u:%g' "${cluster_public_path}"
}

get_migration_root() {
  local cluster_id="$1"
  local cluster_public_path="$2"
  local cache_key="${cluster_id}|${cluster_public_path}"
  local root="${MIGRATION_ROOT_CACHE[${cache_key}]:-}"
  local timestamp=""

  if [[ -n "${root}" ]]; then
    printf '%s' "${root}"
    return 0
  fi

  root="${cluster_public_path}/${MIGRATION_ROOT_NAME}"

  # 如果 Migration 已被文件占用，或者要求每次新建迁移根目录，
  # 则退化为 Migration_时间戳，避免和历史目录冲突。
  if [[ -e "${root}" && ! -d "${root}" ]]; then
    timestamp="$(date '+%Y%m%d%H%M%S')"
    root="${cluster_public_path}/${MIGRATION_ROOT_NAME}_${timestamp}"
  elif [[ -d "${root}" && "${FORCE_NEW_MIGRATION_ROOT}" == "1" ]]; then
    timestamp="$(date '+%Y%m%d%H%M%S')"
    root="${cluster_public_path}/${MIGRATION_ROOT_NAME}_${timestamp}"
  fi

  if [[ "${DRY_RUN}" == "0" ]]; then
    mkdir -p "${root}"
  fi

  MIGRATION_ROOT_CACHE["${cache_key}"]="${root}"
  printf '%s' "${root}"
}

build_timestamped_migration_root() {
  local cluster_public_path="$1"
  local timestamp root
  while true; do
    timestamp="$(date '+%Y%m%d%H%M%S')"
    root="${cluster_public_path}/${MIGRATION_ROOT_NAME}_${timestamp}"
    if [[ ! -e "${root}" ]]; then
      printf '%s' "${root}"
      return 0
    fi
    sleep 1
  done
}

switch_migration_root_for_cluster() {
  local cluster_id="$1"
  local cluster_public_path="$2"
  local cache_key="${cluster_id}|${cluster_public_path}"
  local root

  root="$(build_timestamped_migration_root "${cluster_public_path}")" || return 1

  if [[ "${DRY_RUN}" == "0" ]]; then
    mkdir -p "${root}"
  fi

  MIGRATION_ROOT_CACHE["${cache_key}"]="${root}"
  printf '%s' "${root}"
}

extract_shared_relative_path() {
  local shared_path="$1"
  if [[ "${shared_path}" != *"/.shared/"* ]]; then
    return 1
  fi
  # 直接保留 /.shared/ 之后的相对路径，后续整体平移到 clusterPublicPath/Migration 下。
  printf '%s' "${shared_path#*/.shared/}"
}

copy_shared_path() {
  local source_path="$1"
  local target_path="$2"
  local cluster_public_path="$3"
  local owner_group

  if [[ -e "${target_path}" ]]; then
    return 1
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    log INFO "DRY_RUN copy ${source_path} -> ${target_path}"
    return 0
  fi

  mkdir -p "$(dirname "${target_path}")"
  # 这里故意复制到 target_path 的父目录，而不是直接 cp 到 target_path。
  # 原因是 source_path 本身通常就是一个目录，当前写法与现有 share 实现一致：
  # cp -r src parent_dir  => 最终生成 parent_dir/$(basename src)，也就是 target_path。
  cp -r --preserve=links "${source_path}" "$(dirname "${target_path}")"
  # owner/group 不写死，直接对齐 clusterPublicPath 本身，避免在不同环境里写错账号。
  owner_group="$(resolve_owner_group "${cluster_public_path}")"
  chown -R "${owner_group}" "${target_path}"
  # 权限语义对齐当前用户分享实现，统一递归设为 555。
  chmod -R 555 "${target_path}"
}

should_switch_migration_root_for_conflict() {
  local source_path="$1"
  local target_path="$2"
  local source_mtime target_mtime

  # 只有目标路径已存在时才讨论是否切换 Migration_时间戳。
  [[ -e "${target_path}" ]] || return 1

  # 如果源路径都不存在，说明不是“用户重新分享生成了更新目录”的场景，
  # 后续应保持原 Migration 目录并显式报错，而不是切换到新批次目录。
  [[ -e "${source_path}" ]] || return 1

  source_mtime="$(stat -c '%Y' "${source_path}" 2>/dev/null)" || return 1
  target_mtime="$(stat -c '%Y' "${target_path}" 2>/dev/null)" || return 1

  # 只有当源 shared 路径明显比现有 Migration 目标更新时，
  # 才认为这是“用户再次分享导致的同路径冲突”，应切到 Migration_时间戳。
  [[ "${source_mtime}" -gt "${target_mtime}" ]]
}

maybe_switch_migration_root_for_asset_conflict() {
  local asset_type="$1"
  local asset_id="$2"
  local cluster_id="$3"
  local cluster_public_path="$4"
  local -n _shared_paths=$5
  local -n _target_paths=$6
  local conflict_idx rel
  local switched_root=""

  for conflict_idx in "${!_target_paths[@]}"; do
    if [[ ! -e "${_target_paths[conflict_idx]}" ]]; then
      continue
    fi

    if ! should_switch_migration_root_for_conflict "${_shared_paths[conflict_idx]}" "${_target_paths[conflict_idx]}"; then
      return 1
    fi

    switched_root="$(switch_migration_root_for_cluster "${cluster_id}" "${cluster_public_path}")" || return 2
    log WARN "${asset_type}#${asset_id}: existing target path looks older than current shared source, switch migration root to ${switched_root}"

    for conflict_idx in "${!_shared_paths[@]}"; do
      rel="$(extract_shared_relative_path "${_shared_paths[conflict_idx]}")" || return 2
      _target_paths[conflict_idx]="${switched_root}/${rel}"
    done
    return 0
  done

  return 1
}

compute_asset_shared_root() {
  # 输入示例：
  #   /data/.shared/demo_admin/dataset/dataset1/v1/dataset
  # 期望输出资产级 shared 根目录：
  #   /data/.shared/demo_admin/dataset/dataset1
  #
  # 当前 share 路径结构固定为：
  #   {sharedTopDir}/.shared/{userId}/{assetType}/{assetName}/{versionName}/{content}
  # 因此只取 /.shared/ 之后的前三段：
  #   userId / assetType / assetName
  local shared_path="$1"
  if [[ "${shared_path}" != *"/.shared/"* ]]; then
    return 1
  fi
  local prefix="${shared_path%%/.shared/*}"
  local after_shared="${shared_path#*/.shared/}"
  local seg1 seg2 seg3 remainder
  IFS='/' read -r seg1 seg2 seg3 remainder <<< "${after_shared}"
  if [[ -z "${seg1}" || -z "${seg2}" || -z "${seg3}" ]]; then
    return 1
  fi
  printf '%s/.shared/%s/%s/%s' "${prefix}" "${seg1}" "${seg2}" "${seg3}"
}

compute_and_verify_shared_root() {
  # 遍历同一资产下所有 SHARED 版本的 shared path，逐条计算资产级 shared 根目录，
  # 只有全部结果一致时才允许后续 rm -rf 清理旧 shared 目录。
  local -n _paths=$1
  local root="" current
  local idx
  for idx in "${!_paths[@]}"; do
    current="$(compute_asset_shared_root "${_paths[idx]}")" || return 1
    if [[ -z "${root}" ]]; then
      root="${current}"
    elif [[ "${current}" != "${root}" ]]; then
      return 1
    fi
  done
  if [[ -z "${root}" ]]; then
    return 1
  fi
  printf '%s' "${root}"
}

cleanup_old_shared_root() {
  local shared_root="$1"
  if [[ "${DRY_RUN}" == "1" ]]; then
    log INFO "DRY_RUN cleanup ${shared_root}"
    return 0
  fi
  # 这里只清理旧的用户分享目录，不动原私有目录。
  rm -rf -- "${shared_root}"
}

name_exists_in_db() {
  local table="$1"
  local candidate="$2"
  local sql
  sql="SELECT COUNT(1) FROM ${table} WHERE is_platform_owned = 1 AND name = $(sql_quote_nullable "${candidate}");"
  [[ "$(mysql_query "${sql}")" != "0" ]]
}

reserve_name() {
  local type="$1"
  local candidate="$2"
  case "${type}" in
    dataset) RESERVED_DATASET_NAMES["${candidate}"]=1 ;;
    algorithm) RESERVED_ALGORITHM_NAMES["${candidate}"]=1 ;;
    model) RESERVED_MODEL_NAMES["${candidate}"]=1 ;;
  esac
}

name_reserved() {
  local type="$1"
  local candidate="$2"
  case "${type}" in
    dataset) [[ -n "${RESERVED_DATASET_NAMES[${candidate}]:-}" ]] ;;
    algorithm) [[ -n "${RESERVED_ALGORITHM_NAMES[${candidate}]:-}" ]] ;;
    model) [[ -n "${RESERVED_MODEL_NAMES[${candidate}]:-}" ]] ;;
    *) return 1 ;;
  esac
}

pick_target_name() {
  local type="$1"
  local table="$2"
  local source_name="$3"
  local owner="$4"
  local source_id="$5"
  local candidate base_candidate suffix=1

  for candidate in "${source_name}" "${source_name}(${owner})"; do
    if name_reserved "${type}" "${candidate}"; then
      continue
    fi
    if name_exists_in_db "${table}" "${candidate}"; then
      continue
    fi
    reserve_name "${type}" "${candidate}"
    printf '%s' "${candidate}"
    return 0
  done

  # 从 原名称(用户ID-原记录ID) 开始兜底；若仍冲突，则继续按
  # 原名称(用户ID-原记录ID-1)、原名称(用户ID-原记录ID-2) 依次递增，直到找到可用名称。
  # 这样即使测试环境中同一来源资产被重复迁移多次，也仍能稳定找到可用名称。
  base_candidate="${source_name}(${owner}-${source_id}"

  candidate="${base_candidate})"
  while true; do
    if ! name_reserved "${type}" "${candidate}" && ! name_exists_in_db "${table}" "${candidate}"; then
      reserve_name "${type}" "${candidate}"
      printf '%s' "${candidate}"
      return 0
    fi

    candidate="${base_candidate}-${suffix})"
    suffix=$((suffix + 1))
  done
}

dataset_source_row_by_id() {
  local dataset_id="$1"
  mysql_query "
    SELECT
      d.id,
      REPLACE(REPLACE(REPLACE(d.name, '\t', ' '), '\n', ' '), '\r', ' '),
      d.owner,
      d.type,
      d.scene,
      REPLACE(REPLACE(REPLACE(COALESCE(d.description, '\\N'), '\t', ' '), '\n', ' '), '\r', ' '),
      d.cluster_id,
      DATE_FORMAT(d.create_time, '%Y-%m-%d %H:%i:%s'),
      DATE_FORMAT(d.update_time, '%Y-%m-%d %H:%i:%s')
    FROM dataset d
    WHERE d.id = ${dataset_id}
      AND d.is_shared = 1
      AND d.is_platform_owned = 0
      AND EXISTS (
        SELECT 1 FROM dataset_version dv
        WHERE dv.dataset_id = d.id
          AND dv.shared_status = 'SHARED'
      )
      AND NOT EXISTS (
        SELECT 1 FROM dataset_version dv
        WHERE dv.dataset_id = d.id
          AND dv.shared_status IN ('SHARING', 'UNSHARING')
      );
  "
}

algorithm_source_row_by_id() {
  local algorithm_id="$1"
  mysql_query "
    SELECT
      a.id,
      REPLACE(REPLACE(REPLACE(a.name, '\t', ' '), '\n', ' '), '\r', ' '),
      a.owner,
      a.framework,
      REPLACE(REPLACE(REPLACE(COALESCE(a.description, '\\N'), '\t', ' '), '\n', ' '), '\r', ' '),
      a.cluster_id,
      DATE_FORMAT(a.create_time, '%Y-%m-%d %H:%i:%s'),
      DATE_FORMAT(a.update_time, '%Y-%m-%d %H:%i:%s')
    FROM algorithm a
    WHERE a.id = ${algorithm_id}
      AND a.is_shared = 1
      AND a.is_platform_owned = 0
      AND EXISTS (
        SELECT 1 FROM algorithm_version av
        WHERE av.algorithm_id = a.id
          AND av.shared_status = 'SHARED'
      )
      AND NOT EXISTS (
        SELECT 1 FROM algorithm_version av
        WHERE av.algorithm_id = a.id
          AND av.shared_status IN ('SHARING', 'UNSHARING')
      );
  "
}

model_source_row_by_id() {
  local model_id="$1"
  mysql_query "
    SELECT
      m.id,
      REPLACE(REPLACE(REPLACE(m.name, '\t', ' '), '\n', ' '), '\r', ' '),
      m.owner,
      COALESCE(m.algorithm_framework, '\\N'),
      COALESCE(m.algorithm_name, '\\N'),
      REPLACE(REPLACE(REPLACE(COALESCE(m.description, '\\N'), '\t', ' '), '\n', ' '), '\r', ' '),
      m.cluster_id,
      DATE_FORMAT(m.create_time, '%Y-%m-%d %H:%i:%s'),
      DATE_FORMAT(m.update_time, '%Y-%m-%d %H:%i:%s')
    FROM model m
    WHERE m.id = ${model_id}
      AND m.is_shared = 1
      AND m.is_platform_owned = 0
      AND EXISTS (
        SELECT 1 FROM model_version mv
        WHERE mv.model_id = m.id
          AND mv.shared_status = 'SHARED'
      )
      AND NOT EXISTS (
        SELECT 1 FROM model_version mv
        WHERE mv.model_id = m.id
          AND mv.shared_status IN ('SHARING', 'UNSHARING')
      );
  "
}

dataset_shared_versions() {
  local dataset_id="$1"
  mysql_query "
    SELECT
      dv.id,
      REPLACE(REPLACE(REPLACE(dv.version_name, '\t', ' '), '\n', ' '), '\r', ' '),
      REPLACE(REPLACE(REPLACE(COALESCE(dv.version_description, '\\N'), '\t', ' '), '\n', ' '), '\r', ' '),
      dv.private_path,
      dv.path,
      DATE_FORMAT(dv.create_time, '%Y-%m-%d %H:%i:%s'),
      DATE_FORMAT(dv.update_time, '%Y-%m-%d %H:%i:%s')
    FROM dataset_version dv
    WHERE dv.dataset_id = ${dataset_id}
      AND dv.shared_status = 'SHARED'
    ORDER BY dv.id;
  "
}

algorithm_shared_versions() {
  local algorithm_id="$1"
  mysql_query "
    SELECT
      av.id,
      REPLACE(REPLACE(REPLACE(av.version_name, '\t', ' '), '\n', ' '), '\r', ' '),
      REPLACE(REPLACE(REPLACE(COALESCE(av.version_description, '\\N'), '\t', ' '), '\n', ' '), '\r', ' '),
      av.private_path,
      av.path,
      DATE_FORMAT(av.create_time, '%Y-%m-%d %H:%i:%s'),
      DATE_FORMAT(av.update_time, '%Y-%m-%d %H:%i:%s')
    FROM algorithm_version av
    WHERE av.algorithm_id = ${algorithm_id}
      AND av.shared_status = 'SHARED'
    ORDER BY av.id;
  "
}

model_shared_versions() {
  local model_id="$1"
  mysql_query "
    SELECT
      mv.id,
      REPLACE(REPLACE(REPLACE(mv.version_name, '\t', ' '), '\n', ' '), '\r', ' '),
      REPLACE(REPLACE(REPLACE(COALESCE(mv.version_description, '\\N'), '\t', ' '), '\n', ' '), '\r', ' '),
      COALESCE(mv.algorithm_version, '\\N'),
      mv.private_path,
      mv.path,
      DATE_FORMAT(mv.create_time, '%Y-%m-%d %H:%i:%s'),
      DATE_FORMAT(mv.update_time, '%Y-%m-%d %H:%i:%s')
    FROM model_version mv
    WHERE mv.model_id = ${model_id}
      AND mv.shared_status = 'SHARED'
    ORDER BY mv.id;
  "
}

list_dataset_assets() {
  mysql_query "
    SELECT
      d.id,
      REPLACE(REPLACE(REPLACE(d.name, '\t', ' '), '\n', ' '), '\r', ' '),
      d.owner,
      d.type,
      d.scene,
      REPLACE(REPLACE(REPLACE(COALESCE(d.description, '\\N'), '\t', ' '), '\n', ' '), '\r', ' '),
      d.cluster_id,
      DATE_FORMAT(d.create_time, '%Y-%m-%d %H:%i:%s'),
      DATE_FORMAT(d.update_time, '%Y-%m-%d %H:%i:%s')
    FROM dataset d
    WHERE d.is_shared = 1
      AND d.is_platform_owned = 0
      AND EXISTS (
        SELECT 1 FROM dataset_version dv
        WHERE dv.dataset_id = d.id
          AND dv.shared_status = 'SHARED'
      )
      AND NOT EXISTS (
        SELECT 1 FROM dataset_version dv
        WHERE dv.dataset_id = d.id
          AND dv.shared_status IN ('SHARING', 'UNSHARING')
      )
    ORDER BY d.id;
  "
}

list_algorithm_assets() {
  mysql_query "
    SELECT
      a.id,
      REPLACE(REPLACE(REPLACE(a.name, '\t', ' '), '\n', ' '), '\r', ' '),
      a.owner,
      a.framework,
      REPLACE(REPLACE(REPLACE(COALESCE(a.description, '\\N'), '\t', ' '), '\n', ' '), '\r', ' '),
      a.cluster_id,
      DATE_FORMAT(a.create_time, '%Y-%m-%d %H:%i:%s'),
      DATE_FORMAT(a.update_time, '%Y-%m-%d %H:%i:%s')
    FROM algorithm a
    WHERE a.is_shared = 1
      AND a.is_platform_owned = 0
      AND EXISTS (
        SELECT 1 FROM algorithm_version av
        WHERE av.algorithm_id = a.id
          AND av.shared_status = 'SHARED'
      )
      AND NOT EXISTS (
        SELECT 1 FROM algorithm_version av
        WHERE av.algorithm_id = a.id
          AND av.shared_status IN ('SHARING', 'UNSHARING')
      )
    ORDER BY a.id;
  "
}

list_model_assets() {
  mysql_query "
    SELECT
      m.id,
      REPLACE(REPLACE(REPLACE(m.name, '\t', ' '), '\n', ' '), '\r', ' '),
      m.owner,
      COALESCE(m.algorithm_framework, '\\N'),
      COALESCE(m.algorithm_name, '\\N'),
      REPLACE(REPLACE(REPLACE(COALESCE(m.description, '\\N'), '\t', ' '), '\n', ' '), '\r', ' '),
      m.cluster_id,
      DATE_FORMAT(m.create_time, '%Y-%m-%d %H:%i:%s'),
      DATE_FORMAT(m.update_time, '%Y-%m-%d %H:%i:%s')
    FROM model m
    WHERE m.is_shared = 1
      AND m.is_platform_owned = 0
      AND EXISTS (
        SELECT 1 FROM model_version mv
        WHERE mv.model_id = m.id
          AND mv.shared_status = 'SHARED'
      )
      AND NOT EXISTS (
        SELECT 1 FROM model_version mv
        WHERE mv.model_id = m.id
          AND mv.shared_status IN ('SHARING', 'UNSHARING')
      )
    ORDER BY m.id;
  "
}

process_dataset_asset() {
  local dataset_id="$1"
  local source_name="$2"
  local owner="$3"
  local dataset_type="$4"
  local scene="$5"
  local description="$6"
  local cluster_id="$7"
  local create_time="$8"
  local update_time="$9"

  local cluster_public_path migration_root target_name initial_main current_main
  local initial_versions current_versions
  local -a version_lines=() version_ids=() version_names=() version_descriptions=()
  local -a version_private_paths=() version_shared_paths=() version_target_paths=()
  local -a version_create_times=() version_update_times=()
  local idx rel old_shared_root sql_file

  cluster_public_path="$(require_cluster_public_path "${cluster_id}")" || {
    failure "dataset" "${dataset_id}" "${source_name}" "${owner}" "${cluster_id}" "resolve_cluster_public_path" \
      "clusterPublicPath is not configured in CLUSTER_PUBLIC_PATH_MAP"
    return
  }

  migration_root="$(get_migration_root "${cluster_id}" "${cluster_public_path}")" || {
    failure "dataset" "${dataset_id}" "${source_name}" "${owner}" "${cluster_id}" "prepare_migration_root" \
      "failed to create migration root"
    return
  }

  target_name="$(pick_target_name "dataset" "dataset" "${source_name}" "${owner}" "${dataset_id}")" || {
    failure "dataset" "${dataset_id}" "${source_name}" "${owner}" "${cluster_id}" "pick_target_name" \
      "unable to allocate a unique platform dataset name"
    return
  }

  initial_main="$(dataset_source_row_by_id "${dataset_id}")"
  initial_versions="$(dataset_shared_versions "${dataset_id}")"

  mapfile -t version_lines < <(printf '%s\n' "${initial_versions}")
  if [[ "${#version_lines[@]}" -eq 0 || -z "${version_lines[0]}" ]]; then
    failure "dataset" "${dataset_id}" "${source_name}" "${owner}" "${cluster_id}" "load_versions" \
      "no SHARED dataset version found"
    return
  fi

  for idx in "${!version_lines[@]}"; do
    IFS=$'\t' read -r version_id version_name version_description private_path shared_path version_create_time version_update_time <<< "${version_lines[idx]}"
    rel="$(extract_shared_relative_path "${shared_path}")" || {
      failure "dataset" "${dataset_id}" "${source_name}" "${owner}" "${cluster_id}" "extract_shared_relative_path" \
        "shared path does not contain /.shared/: ${shared_path}"
      return
    }
    version_ids[idx]="${version_id}"
    version_names[idx]="${version_name}"
    version_descriptions[idx]="${version_description}"
    version_private_paths[idx]="${private_path}"
    version_shared_paths[idx]="${shared_path}"
    version_target_paths[idx]="${migration_root}/${rel}"
    version_create_times[idx]="${version_create_time}"
    version_update_times[idx]="${version_update_time}"
  done

  maybe_switch_migration_root_for_asset_conflict "dataset" "${dataset_id}" "${cluster_id}" "${cluster_public_path}" version_shared_paths version_target_paths
  case $? in
    0) ;;
    1) ;;
    *)
      failure "dataset" "${dataset_id}" "${source_name}" "${owner}" "${cluster_id}" "prepare_migration_root" \
        "failed to switch migration root after detecting target path conflict"
      return
      ;;
  esac

  for idx in "${!version_target_paths[@]}"; do
    copy_shared_path "${version_shared_paths[idx]}" "${version_target_paths[idx]}" "${cluster_public_path}" || {
      failure "dataset" "${dataset_id}" "${source_name}" "${owner}" "${cluster_id}" "copy_shared_path" \
        "failed to copy ${version_shared_paths[idx]} to ${version_target_paths[idx]}"
      return
    }
  done

  current_main="$(dataset_source_row_by_id "${dataset_id}")"
  current_versions="$(dataset_shared_versions "${dataset_id}")"
  if [[ "${initial_main}" != "${current_main}" || "${initial_versions}" != "${current_versions}" ]]; then
    failure "dataset" "${dataset_id}" "${source_name}" "${owner}" "${cluster_id}" "revalidate_before_commit" \
      "source dataset changed during migration window"
    return
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    success "dataset" "${dataset_id}" "${source_name}" "${target_name}" "${cluster_id}" "${version_target_paths[0]}"
    return
  fi

  sql_file="$(mktemp)"
  {
    echo "START TRANSACTION;"
    printf "INSERT INTO dataset (name, owner, type, is_shared, scene, description, cluster_id, create_time, update_time, is_platform_owned)\n"
    printf "VALUES (%s, %s, %s, 1, %s, %s, %s, %s, %s, 1);\n" \
      "$(sql_quote_nullable "${target_name}")" \
      "$(sql_quote_nullable "${owner}")" \
      "$(sql_quote_nullable "${dataset_type}")" \
      "$(sql_quote_nullable "${scene}")" \
      "$(sql_quote_nullable "${description}")" \
      "$(sql_quote_nullable "${cluster_id}")" \
      "$(sql_quote_nullable "${create_time}")" \
      "$(sql_quote_nullable "${update_time}")"
    echo "SET @new_dataset_id := LAST_INSERT_ID();"
    for idx in "${!version_ids[@]}"; do
      printf "INSERT INTO dataset_version (version_name, version_description, private_path, path, create_time, update_time, shared_status, dataset_id)\n"
      printf "VALUES (%s, %s, %s, %s, %s, %s, 'SHARED', @new_dataset_id);\n" \
        "$(sql_quote_nullable "${version_names[idx]}")" \
        "$(sql_quote_nullable "${version_descriptions[idx]}")" \
        "$(sql_quote_nullable "${version_target_paths[idx]}")" \
        "$(sql_quote_nullable "${version_target_paths[idx]}")" \
        "$(sql_quote_nullable "${version_create_times[idx]}")" \
        "$(sql_quote_nullable "${version_update_times[idx]}")"
    done
    printf "UPDATE dataset SET is_shared = 0 WHERE id = %s AND is_shared = 1 AND is_platform_owned = 0;\n" "${dataset_id}"
    printf "UPDATE dataset_version SET shared_status = 'UNSHARED', path = private_path WHERE id IN (%s);\n" \
      "$(IFS=,; echo "${version_ids[*]}")"
    echo "COMMIT;"
  } > "${sql_file}"

  if ! mysql_exec_file "${sql_file}"; then
    rm -f "${sql_file}"
    # 文件已复制但事务提交失败时，不自动回删 Migration 下的新文件。
    # 这里优先保证“不丢数据”，由运维按失败清单决定是否人工清理孤儿目录。
    log WARN "dataset#${dataset_id}: DB commit failed but files were already copied to migration root. Orphan files may exist under: ${migration_root}/"
    failure "dataset" "${dataset_id}" "${source_name}" "${owner}" "${cluster_id}" "database_commit" \
      "mysql transaction failed; copied files under ${migration_root}/ may need manual cleanup"
    return
  fi
  rm -f "${sql_file}"

  old_shared_root="$(compute_and_verify_shared_root version_shared_paths)" || {
    failure "dataset" "${dataset_id}" "${source_name}" "${owner}" "${cluster_id}" "compute_asset_shared_root" \
      "database committed but shared root inconsistent across versions or unable to compute"
    return
  }
  if ! cleanup_old_shared_root "${old_shared_root}"; then
    failure "dataset" "${dataset_id}" "${source_name}" "${owner}" "${cluster_id}" "cleanup_old_shared_root" \
      "database committed but failed to cleanup ${old_shared_root}"
    return
  fi

  success "dataset" "${dataset_id}" "${source_name}" "${target_name}" "${cluster_id}" "${version_target_paths[0]}"
}

process_algorithm_asset() {
  local algorithm_id="$1"
  local source_name="$2"
  local owner="$3"
  local framework="$4"
  local description="$5"
  local cluster_id="$6"
  local create_time="$7"
  local update_time="$8"

  local cluster_public_path migration_root target_name initial_main current_main
  local initial_versions current_versions
  local -a version_lines=() version_ids=() version_names=() version_descriptions=()
  local -a version_private_paths=() version_shared_paths=() version_target_paths=()
  local -a version_create_times=() version_update_times=()
  local idx rel old_shared_root sql_file

  cluster_public_path="$(require_cluster_public_path "${cluster_id}")" || {
    failure "algorithm" "${algorithm_id}" "${source_name}" "${owner}" "${cluster_id}" "resolve_cluster_public_path" \
      "clusterPublicPath is not configured in CLUSTER_PUBLIC_PATH_MAP"
    return
  }

  migration_root="$(get_migration_root "${cluster_id}" "${cluster_public_path}")" || {
    failure "algorithm" "${algorithm_id}" "${source_name}" "${owner}" "${cluster_id}" "prepare_migration_root" \
      "failed to create migration root"
    return
  }

  target_name="$(pick_target_name "algorithm" "algorithm" "${source_name}" "${owner}" "${algorithm_id}")" || {
    failure "algorithm" "${algorithm_id}" "${source_name}" "${owner}" "${cluster_id}" "pick_target_name" \
      "unable to allocate a unique platform algorithm name"
    return
  }

  initial_main="$(algorithm_source_row_by_id "${algorithm_id}")"
  initial_versions="$(algorithm_shared_versions "${algorithm_id}")"

  mapfile -t version_lines < <(printf '%s\n' "${initial_versions}")
  if [[ "${#version_lines[@]}" -eq 0 || -z "${version_lines[0]}" ]]; then
    failure "algorithm" "${algorithm_id}" "${source_name}" "${owner}" "${cluster_id}" "load_versions" \
      "no SHARED algorithm version found"
    return
  fi

  for idx in "${!version_lines[@]}"; do
    IFS=$'\t' read -r version_id version_name version_description private_path shared_path version_create_time version_update_time <<< "${version_lines[idx]}"
    rel="$(extract_shared_relative_path "${shared_path}")" || {
      failure "algorithm" "${algorithm_id}" "${source_name}" "${owner}" "${cluster_id}" "extract_shared_relative_path" \
        "shared path does not contain /.shared/: ${shared_path}"
      return
    }
    version_ids[idx]="${version_id}"
    version_names[idx]="${version_name}"
    version_descriptions[idx]="${version_description}"
    version_private_paths[idx]="${private_path}"
    version_shared_paths[idx]="${shared_path}"
    version_target_paths[idx]="${migration_root}/${rel}"
    version_create_times[idx]="${version_create_time}"
    version_update_times[idx]="${version_update_time}"
  done

  maybe_switch_migration_root_for_asset_conflict "algorithm" "${algorithm_id}" "${cluster_id}" "${cluster_public_path}" version_shared_paths version_target_paths
  case $? in
    0) ;;
    1) ;;
    *)
      failure "algorithm" "${algorithm_id}" "${source_name}" "${owner}" "${cluster_id}" "prepare_migration_root" \
        "failed to switch migration root after detecting target path conflict"
      return
      ;;
  esac

  for idx in "${!version_target_paths[@]}"; do
    copy_shared_path "${version_shared_paths[idx]}" "${version_target_paths[idx]}" "${cluster_public_path}" || {
      failure "algorithm" "${algorithm_id}" "${source_name}" "${owner}" "${cluster_id}" "copy_shared_path" \
        "failed to copy ${version_shared_paths[idx]} to ${version_target_paths[idx]}"
      return
    }
  done

  current_main="$(algorithm_source_row_by_id "${algorithm_id}")"
  current_versions="$(algorithm_shared_versions "${algorithm_id}")"
  if [[ "${initial_main}" != "${current_main}" || "${initial_versions}" != "${current_versions}" ]]; then
    failure "algorithm" "${algorithm_id}" "${source_name}" "${owner}" "${cluster_id}" "revalidate_before_commit" \
      "source algorithm changed during migration window"
    return
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    success "algorithm" "${algorithm_id}" "${source_name}" "${target_name}" "${cluster_id}" "${version_target_paths[0]}"
    return
  fi

  sql_file="$(mktemp)"
  {
    echo "START TRANSACTION;"
    printf "INSERT INTO algorithm (name, owner, framework, is_shared, description, cluster_id, create_time, update_time, is_platform_owned)\n"
    printf "VALUES (%s, %s, %s, 1, %s, %s, %s, %s, 1);\n" \
      "$(sql_quote_nullable "${target_name}")" \
      "$(sql_quote_nullable "${owner}")" \
      "$(sql_quote_nullable "${framework}")" \
      "$(sql_quote_nullable "${description}")" \
      "$(sql_quote_nullable "${cluster_id}")" \
      "$(sql_quote_nullable "${create_time}")" \
      "$(sql_quote_nullable "${update_time}")"
    echo "SET @new_algorithm_id := LAST_INSERT_ID();"
    for idx in "${!version_ids[@]}"; do
      printf "INSERT INTO algorithm_version (version_name, version_description, private_path, path, create_time, update_time, shared_status, algorithm_id)\n"
      printf "VALUES (%s, %s, %s, %s, %s, %s, 'SHARED', @new_algorithm_id);\n" \
        "$(sql_quote_nullable "${version_names[idx]}")" \
        "$(sql_quote_nullable "${version_descriptions[idx]}")" \
        "$(sql_quote_nullable "${version_target_paths[idx]}")" \
        "$(sql_quote_nullable "${version_target_paths[idx]}")" \
        "$(sql_quote_nullable "${version_create_times[idx]}")" \
        "$(sql_quote_nullable "${version_update_times[idx]}")"
    done
    printf "UPDATE algorithm SET is_shared = 0 WHERE id = %s AND is_shared = 1 AND is_platform_owned = 0;\n" "${algorithm_id}"
    printf "UPDATE algorithm_version SET shared_status = 'UNSHARED', path = private_path WHERE id IN (%s);\n" \
      "$(IFS=,; echo "${version_ids[*]}")"
    echo "COMMIT;"
  } > "${sql_file}"

  if ! mysql_exec_file "${sql_file}"; then
    rm -f "${sql_file}"
    # 文件已复制但事务提交失败时，不自动回删 Migration 下的新文件。
    # 这里优先保证“不丢数据”，由运维按失败清单决定是否人工清理孤儿目录。
    log WARN "algorithm#${algorithm_id}: DB commit failed but files were already copied to migration root. Orphan files may exist under: ${migration_root}/"
    failure "algorithm" "${algorithm_id}" "${source_name}" "${owner}" "${cluster_id}" "database_commit" \
      "mysql transaction failed; copied files under ${migration_root}/ may need manual cleanup"
    return
  fi
  rm -f "${sql_file}"

  old_shared_root="$(compute_and_verify_shared_root version_shared_paths)" || {
    failure "algorithm" "${algorithm_id}" "${source_name}" "${owner}" "${cluster_id}" "compute_asset_shared_root" \
      "database committed but shared root inconsistent across versions or unable to compute"
    return
  }
  if ! cleanup_old_shared_root "${old_shared_root}"; then
    failure "algorithm" "${algorithm_id}" "${source_name}" "${owner}" "${cluster_id}" "cleanup_old_shared_root" \
      "database committed but failed to cleanup ${old_shared_root}"
    return
  fi

  success "algorithm" "${algorithm_id}" "${source_name}" "${target_name}" "${cluster_id}" "${version_target_paths[0]}"
}

process_model_asset() {
  local model_id="$1"
  local source_name="$2"
  local owner="$3"
  local algorithm_framework="$4"
  local algorithm_name="$5"
  local description="$6"
  local cluster_id="$7"
  local create_time="$8"
  local update_time="$9"

  local cluster_public_path migration_root target_name initial_main current_main
  local initial_versions current_versions
  local -a version_lines=() version_ids=() version_names=() version_descriptions=()
  local -a version_algorithm_versions=()
  local -a version_private_paths=() version_shared_paths=() version_target_paths=()
  local -a version_create_times=() version_update_times=()
  local idx rel old_shared_root sql_file

  cluster_public_path="$(require_cluster_public_path "${cluster_id}")" || {
    failure "model" "${model_id}" "${source_name}" "${owner}" "${cluster_id}" "resolve_cluster_public_path" \
      "clusterPublicPath is not configured in CLUSTER_PUBLIC_PATH_MAP"
    return
  }

  migration_root="$(get_migration_root "${cluster_id}" "${cluster_public_path}")" || {
    failure "model" "${model_id}" "${source_name}" "${owner}" "${cluster_id}" "prepare_migration_root" \
      "failed to create migration root"
    return
  }

  target_name="$(pick_target_name "model" "model" "${source_name}" "${owner}" "${model_id}")" || {
    failure "model" "${model_id}" "${source_name}" "${owner}" "${cluster_id}" "pick_target_name" \
      "unable to allocate a unique platform model name"
    return
  }

  initial_main="$(model_source_row_by_id "${model_id}")"
  initial_versions="$(model_shared_versions "${model_id}")"

  mapfile -t version_lines < <(printf '%s\n' "${initial_versions}")
  if [[ "${#version_lines[@]}" -eq 0 || -z "${version_lines[0]}" ]]; then
    failure "model" "${model_id}" "${source_name}" "${owner}" "${cluster_id}" "load_versions" \
      "no SHARED model version found"
    return
  fi

  for idx in "${!version_lines[@]}"; do
    IFS=$'\t' read -r version_id version_name version_description algorithm_version_val private_path shared_path version_create_time version_update_time <<< "${version_lines[idx]}"
    rel="$(extract_shared_relative_path "${shared_path}")" || {
      failure "model" "${model_id}" "${source_name}" "${owner}" "${cluster_id}" "extract_shared_relative_path" \
        "shared path does not contain /.shared/: ${shared_path}"
      return
    }
    version_ids[idx]="${version_id}"
    version_names[idx]="${version_name}"
    version_descriptions[idx]="${version_description}"
    version_algorithm_versions[idx]="${algorithm_version_val}"
    version_private_paths[idx]="${private_path}"
    version_shared_paths[idx]="${shared_path}"
    version_target_paths[idx]="${migration_root}/${rel}"
    version_create_times[idx]="${version_create_time}"
    version_update_times[idx]="${version_update_time}"
  done

  maybe_switch_migration_root_for_asset_conflict "model" "${model_id}" "${cluster_id}" "${cluster_public_path}" version_shared_paths version_target_paths
  case $? in
    0) ;;
    1) ;;
    *)
      failure "model" "${model_id}" "${source_name}" "${owner}" "${cluster_id}" "prepare_migration_root" \
        "failed to switch migration root after detecting target path conflict"
      return
      ;;
  esac

  for idx in "${!version_target_paths[@]}"; do
    copy_shared_path "${version_shared_paths[idx]}" "${version_target_paths[idx]}" "${cluster_public_path}" || {
      failure "model" "${model_id}" "${source_name}" "${owner}" "${cluster_id}" "copy_shared_path" \
        "failed to copy ${version_shared_paths[idx]} to ${version_target_paths[idx]}"
      return
    }
  done

  current_main="$(model_source_row_by_id "${model_id}")"
  current_versions="$(model_shared_versions "${model_id}")"
  if [[ "${initial_main}" != "${current_main}" || "${initial_versions}" != "${current_versions}" ]]; then
    failure "model" "${model_id}" "${source_name}" "${owner}" "${cluster_id}" "revalidate_before_commit" \
      "source model changed during migration window"
    return
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    success "model" "${model_id}" "${source_name}" "${target_name}" "${cluster_id}" "${version_target_paths[0]}"
    return
  fi

  sql_file="$(mktemp)"
  {
    echo "START TRANSACTION;"
    printf "INSERT INTO model (name, owner, algorithm_framework, algorithm_name, is_shared, description, cluster_id, create_time, update_time, is_platform_owned)\n"
    printf "VALUES (%s, %s, %s, %s, 1, %s, %s, %s, %s, 1);\n" \
      "$(sql_quote_nullable "${target_name}")" \
      "$(sql_quote_nullable "${owner}")" \
      "$(sql_quote_nullable "${algorithm_framework}")" \
      "$(sql_quote_nullable "${algorithm_name}")" \
      "$(sql_quote_nullable "${description}")" \
      "$(sql_quote_nullable "${cluster_id}")" \
      "$(sql_quote_nullable "${create_time}")" \
      "$(sql_quote_nullable "${update_time}")"
    echo "SET @new_model_id := LAST_INSERT_ID();"
    for idx in "${!version_ids[@]}"; do
      printf "INSERT INTO model_version (version_name, version_description, algorithm_version, private_path, path, create_time, update_time, shared_status, model_id)\n"
      printf "VALUES (%s, %s, %s, %s, %s, %s, %s, 'SHARED', @new_model_id);\n" \
        "$(sql_quote_nullable "${version_names[idx]}")" \
        "$(sql_quote_nullable "${version_descriptions[idx]}")" \
        "$(sql_quote_nullable "${version_algorithm_versions[idx]}")" \
        "$(sql_quote_nullable "${version_target_paths[idx]}")" \
        "$(sql_quote_nullable "${version_target_paths[idx]}")" \
        "$(sql_quote_nullable "${version_create_times[idx]}")" \
        "$(sql_quote_nullable "${version_update_times[idx]}")"
    done
    printf "UPDATE model SET is_shared = 0 WHERE id = %s AND is_shared = 1 AND is_platform_owned = 0;\n" "${model_id}"
    printf "UPDATE model_version SET shared_status = 'UNSHARED', path = private_path WHERE id IN (%s);\n" \
      "$(IFS=,; echo "${version_ids[*]}")"
    echo "COMMIT;"
  } > "${sql_file}"

  if ! mysql_exec_file "${sql_file}"; then
    rm -f "${sql_file}"
    # 文件已复制但事务提交失败时，不自动回删 Migration 下的新文件。
    # 这里优先保证“不丢数据”，由运维按失败清单决定是否人工清理孤儿目录。
    log WARN "model#${model_id}: DB commit failed but files were already copied to migration root. Orphan files may exist under: ${migration_root}/"
    failure "model" "${model_id}" "${source_name}" "${owner}" "${cluster_id}" "database_commit" \
      "mysql transaction failed; copied files under ${migration_root}/ may need manual cleanup"
    return
  fi
  rm -f "${sql_file}"

  old_shared_root="$(compute_and_verify_shared_root version_shared_paths)" || {
    failure "model" "${model_id}" "${source_name}" "${owner}" "${cluster_id}" "compute_asset_shared_root" \
      "database committed but shared root inconsistent across versions or unable to compute"
    return
  }
  if ! cleanup_old_shared_root "${old_shared_root}"; then
    failure "model" "${model_id}" "${source_name}" "${owner}" "${cluster_id}" "cleanup_old_shared_root" \
      "database committed but failed to cleanup ${old_shared_root}"
    return
  fi

  success "model" "${model_id}" "${source_name}" "${target_name}" "${cluster_id}" "${version_target_paths[0]}"
}

main() {
  if [[ -z "${MYSQL_PASSWORD}" ]]; then
    log WARN "MYSQL_PASSWORD is empty. Make sure this is intended for your database."
  fi

  if [[ "${#CLUSTER_PUBLIC_PATH_MAP[@]}" -eq 0 ]]; then
    log ERROR "CLUSTER_PUBLIC_PATH_MAP is empty. Fill clusterPublicPath values before execution."
    exit 1
  fi

  log INFO "Start migration. DRY_RUN=${DRY_RUN}"

  while IFS=$'\t' read -r dataset_id name owner dataset_type scene description cluster_id create_time update_time; do
    [[ -z "${dataset_id}" ]] && continue
    process_dataset_asset "${dataset_id}" "${name}" "${owner}" "${dataset_type}" "${scene}" "${description}" \
      "${cluster_id}" "${create_time}" "${update_time}"
  done < <(list_dataset_assets)

  while IFS=$'\t' read -r algorithm_id name owner framework description cluster_id create_time update_time; do
    [[ -z "${algorithm_id}" ]] && continue
    process_algorithm_asset "${algorithm_id}" "${name}" "${owner}" "${framework}" "${description}" \
      "${cluster_id}" "${create_time}" "${update_time}"
  done < <(list_algorithm_assets)

  while IFS=$'\t' read -r model_id name owner algorithm_framework algorithm_name description cluster_id create_time update_time; do
    [[ -z "${model_id}" ]] && continue
    process_model_asset "${model_id}" "${name}" "${owner}" "${algorithm_framework}" "${algorithm_name}" "${description}" \
      "${cluster_id}" "${create_time}" "${update_time}"
  done < <(list_model_assets)

  log INFO "Migration finished. Success file: ${SUCCESS_FILE}"
  log INFO "Migration finished. Failure file: ${FAILURES_FILE}"
}

main "$@"
