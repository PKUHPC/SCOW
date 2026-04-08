#!/usr/bin/env bash

set -u
set -o pipefail

###############################################################################
# AI 公共镜像迁移脚本草案
#
# 处理范围：
# - image
#
# 核心行为：
# - 只迁移当前 is_shared=1 且 status=CREATED 的用户镜像
# - 先插入平台临时记录（CREATING, is_shared=0）
# - 再通过 Harbor API 将 artifact 从 u_<owner> 复制到 admin_public_asset
# - Harbor 成功后再将新平台记录切为 CREATED + is_shared=1
# - 同时把原用户镜像记录回写为 is_shared=0
# - 单条失败继续执行，最后统一输出成功/失败清单
#
# 安全约束：
# - 默认 DRY_RUN=1，只预演不落库、不调用 Harbor API
# - 正式执行前必须补齐数据库参数和 Harbor 参数
###############################################################################

: "${MYSQL_HOST:=127.0.0.1}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_USER:=root}"
: "${MYSQL_PASSWORD:=}"
: "${MYSQL_DATABASE:=scow_ai}"

: "${HARBOR_PROTOCOL:=http}"
: "${HARBOR_URL:=}"
: "${HARBOR_API_PROTOCOL:=${HARBOR_PROTOCOL}}"
: "${HARBOR_API_URL:=${HARBOR_URL}}"
: "${HARBOR_REGISTRY_URL:=${HARBOR_URL}}"
: "${HARBOR_USER:=admin}"
: "${HARBOR_PASSWORD:=}"
: "${HARBOR_PLATFORM_PROJECT:=admin_public_asset}"

: "${DRY_RUN:=1}"
: "${SUCCESS_FILE:=/tmp/ai-public-image-migration.success.tsv}"
: "${FAILURES_FILE:=/tmp/ai-public-image-migration.failures.tsv}"

TSV_NULL_PLACEHOLDER="__NULL__"
TSV_EMPTY_PLACEHOLDER="__EMPTY__"

MYSQL_BIN=(mysql --default-character-set=utf8mb4 --batch --raw --skip-column-names -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER}")
HARBOR_API_BASE="${HARBOR_API_PROTOCOL}://${HARBOR_API_URL}/api/v2.0"

declare -A RESERVED_IMAGE_KEYS=()

mkdir -p "$(dirname "${SUCCESS_FILE}")" "$(dirname "${FAILURES_FILE}")"
: > "${SUCCESS_FILE}"
: > "${FAILURES_FILE}"
printf 'asset_type\tsource_id\tsource_name\tsource_tag\ttarget_name\ttarget_tag\tcluster_id\ttarget_path\ttemp_record_id\n' >> "${SUCCESS_FILE}"
printf 'asset_type\tsource_id\tsource_name\tsource_tag\towner\tcluster_id\tstage\tmessage\ttemp_record_id\n' >> "${FAILURES_FILE}"

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
  if [[ "${value}" == "${TSV_NULL_PLACEHOLDER}" ]]; then
    printf 'NULL'
  elif [[ "${value}" == "${TSV_EMPTY_PLACEHOLDER}" ]]; then
    printf "''"
  else
    printf "'%s'" "$(sql_escape "${value}")"
  fi
}

failure() {
  local id="$1"
  local name="$2"
  local tag="$3"
  local owner="$4"
  local cluster_id="$5"
  local stage="$6"
  local message="$7"
  local temp_record_id="${8:-}"
  printf 'image\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "${id}" "$(sanitize_field "${name}")" "$(sanitize_field "${tag}")" "${owner}" "${cluster_id}" "${stage}" "$(sanitize_field "${message}")" "${temp_record_id}" \
    >> "${FAILURES_FILE}"
  log ERROR "image#${id} ${stage}: ${message}"
}

success() {
  local id="$1"
  local source_name="$2"
  local source_tag="$3"
  local target_name="$4"
  local target_tag="$5"
  local cluster_id="$6"
  local target_path="$7"
  local temp_record_id="$8"
  printf 'image\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "${id}" "$(sanitize_field "${source_name}")" "$(sanitize_field "${source_tag}")" "$(sanitize_field "${target_name}")" "$(sanitize_field "${target_tag}")" "${cluster_id}" "$(sanitize_field "${target_path}")" "${temp_record_id}" \
    >> "${SUCCESS_FILE}"
  log INFO "image#${id} migrated: ${source_name}:${source_tag} -> ${target_name}:${target_tag}"
}

require_harbor_config() {
  [[ -n "${HARBOR_API_URL}" && -n "${HARBOR_REGISTRY_URL}" && -n "${HARBOR_USER}" && -n "${HARBOR_PASSWORD}" ]]
}

url_encode() {
  local input="$1"
  local output="" i ch hex
  for ((i=0; i<${#input}; i++)); do
    ch="${input:i:1}"
    case "${ch}" in
      [a-zA-Z0-9.~_-]) output+="${ch}" ;;
      *)
        printf -v hex '%%%02X' "'${ch}"
        output+="${hex}"
        ;;
    esac
  done
  printf '%s' "${output}"
}

double_url_encode() {
  local once
  once="$(url_encode "$1")"
  url_encode "${once}"
}

harbor_request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local tmp_body http_code
  tmp_body="$(mktemp)"

  if [[ -n "${body}" ]]; then
    http_code="$(curl -sS -u "${HARBOR_USER}:${HARBOR_PASSWORD}" \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/json' \
      -X "${method}" "${url}" \
      -d "${body}" \
      -o "${tmp_body}" -w '%{http_code}')"
  else
    http_code="$(curl -sS -u "${HARBOR_USER}:${HARBOR_PASSWORD}" \
      -H 'Accept: application/json' \
      -X "${method}" "${url}" \
      -o "${tmp_body}" -w '%{http_code}')"
  fi

  printf '%s\t%s\n' "${http_code}" "${tmp_body}"
}

ensure_harbor_project_exists() {
  local project="$1"
  local result http_code body_file

  result="$(harbor_request GET "${HARBOR_API_BASE}/projects/${project}")" || return 1
  http_code="${result%%$'\t'*}"
  body_file="${result#*$'\t'}"

  if [[ "${http_code}" == "200" ]]; then
    rm -f "${body_file}"
    return 0
  fi

  if [[ "${http_code}" == "404" ]]; then
    rm -f "${body_file}"
    result="$(harbor_request POST "${HARBOR_API_BASE}/projects" "{\"project_name\":\"${project}\",\"public\":true}")" || return 1
    http_code="${result%%$'\t'*}"
    body_file="${result#*$'\t'}"
    if [[ "${http_code}" == "201" || "${http_code}" == "409" ]]; then
      rm -f "${body_file}"
      return 0
    fi
  fi

  cat "${body_file}" >&2
  rm -f "${body_file}"
  return 1
}

copy_harbor_artifact() {
  local src_project="$1"
  local src_repo="$2"
  local src_tag="$3"
  local dest_project="$4"
  local dest_repo="$5"
  local encoded_dest_repo from_ref result http_code body_file

  # dest_repo 作为路径参数，Harbor nginx 路由层会解码一次，应用层再解码一次，故需要双重编码（对齐 harbor.ts doubleEncode）
  encoded_dest_repo="$(double_url_encode "${dest_repo}")"
  # from 作为 query string 值，Harbor 直接按原始字符串解析（不经过额外解码），故不做 percent-encode
  from_ref="${src_project}/${src_repo}:${src_tag}"
  result="$(harbor_request POST "${HARBOR_API_BASE}/projects/${dest_project}/repositories/${encoded_dest_repo}/artifacts?from=${from_ref}")" || return 1
  http_code="${result%%$'\t'*}"
  body_file="${result#*$'\t'}"

  case "${http_code}" in
    200|201|202|409)
      rm -f "${body_file}"
      return 0
      ;;
    *)
      cat "${body_file}" >&2
      rm -f "${body_file}"
      return 1
      ;;
  esac
}

image_key_reserved() {
  local candidate_name="$1"
  local candidate_tag="$2"
  local key="${candidate_name}|${candidate_tag}"
  [[ -n "${RESERVED_IMAGE_KEYS[${key}]:-}" ]]
}

reserve_image_key() {
  local candidate_name="$1"
  local candidate_tag="$2"
  RESERVED_IMAGE_KEYS["${candidate_name}|${candidate_tag}"]=1
}

image_name_exists_in_db() {
  local candidate_name="$1"
  local candidate_tag="$2"
  local sql
  sql="SELECT COUNT(1) FROM image WHERE is_platform_owned = 1 AND name = $(sql_quote_nullable "${candidate_name}") AND tag = $(sql_quote_nullable "${candidate_tag}");"
  [[ "$(mysql_query "${sql}")" != "0" ]]
}

normalize_image_repo_name() {
  local raw="$1"
  local normalized

  normalized="$(printf '%s' "${raw}" | tr '[:upper:]' '[:lower:]')"
  normalized="$(printf '%s' "${normalized}" | sed -E 's/[^a-z0-9._-]+/_/g; s/[_\.-]{2,}/_/g; s/^[_\.-]+//; s/[_\.-]+$//')"

  if [[ -z "${normalized}" ]]; then
    printf 'image'
  else
    printf '%s' "${normalized}"
  fi
}

pick_target_image_name() {
  local source_name="$1"
  local owner="$2"
  local source_id="$3"
  local source_tag="$4"
  local source_name_safe owner_safe candidate base_candidate suffix=1

  source_name_safe="$(normalize_image_repo_name "${source_name}")"
  owner_safe="$(normalize_image_repo_name "${owner}")"

  for candidate in "${source_name_safe}" "${source_name_safe}_${owner_safe}"; do
    if image_key_reserved "${candidate}" "${source_tag}"; then
      continue
    fi
    if image_name_exists_in_db "${candidate}" "${source_tag}"; then
      continue
    fi
    reserve_image_key "${candidate}" "${source_tag}"
    printf '%s' "${candidate}"
    return 0
  done

  # 镜像仓库名必须兼容 Harbor/repository 规则，因此兜底规则使用下划线拼接，
  # 不复用数据资产里的括号风格命名。
  base_candidate="${source_name_safe}_${owner_safe}_${source_id}"
  candidate="${base_candidate}"
  while true; do
    if ! image_key_reserved "${candidate}" "${source_tag}" && ! image_name_exists_in_db "${candidate}" "${source_tag}"; then
      reserve_image_key "${candidate}" "${source_tag}"
      printf '%s' "${candidate}"
      return 0
    fi
    candidate="${base_candidate}_${suffix}"
    suffix=$((suffix + 1))
  done
}

list_image_assets() {
  mysql_query "
    SELECT
      i.id,
      REPLACE(REPLACE(REPLACE(i.name, '\t', ' '), '\n', ' '), '\r', ' '),
      i.owner,
      i.source,
      i.tag,
      CASE WHEN i.tag_postfix IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.tag_postfix = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE i.tag_postfix END,
      CASE WHEN i.description IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.description = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE REPLACE(REPLACE(REPLACE(i.description, '\t', ' '), '\n', ' '), '\r', ' ') END,
      CASE WHEN i.cluster_id IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.cluster_id = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE i.cluster_id END,
      CASE WHEN i.source_path IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.source_path = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE i.source_path END,
      i.status,
      CASE WHEN i.types IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.types = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE i.types END,
      CASE WHEN i.infer_service_port IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.infer_service_port = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE i.infer_service_port END,
      CASE WHEN i.start_command IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.start_command = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE REPLACE(REPLACE(REPLACE(i.start_command, '\t', ' '), '\n', ' '), '\r', ' ') END,
      DATE_FORMAT(i.create_time, '%Y-%m-%d %H:%i:%s'),
      DATE_FORMAT(i.update_time, '%Y-%m-%d %H:%i:%s')
    FROM image i
    WHERE i.is_shared = 1
      AND i.is_platform_owned = 0
      AND i.status = 'CREATED'
      AND NULLIF(i.path, '') IS NOT NULL
      AND NULLIF(i.tag_postfix, '') IS NOT NULL
    ORDER BY i.id;
  "
}

image_row_by_id() {
  local image_id="$1"
  mysql_query "
    SELECT
      i.id,
      REPLACE(REPLACE(REPLACE(i.name, '\t', ' '), '\n', ' '), '\r', ' '),
      i.owner,
      i.source,
      i.tag,
      CASE WHEN i.tag_postfix IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.tag_postfix = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE i.tag_postfix END,
      CASE WHEN i.description IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.description = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE REPLACE(REPLACE(REPLACE(i.description, '\t', ' '), '\n', ' '), '\r', ' ') END,
      CASE WHEN i.cluster_id IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.cluster_id = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE i.cluster_id END,
      CASE WHEN i.source_path IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.source_path = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE i.source_path END,
      i.status,
      CASE WHEN i.types IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.types = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE i.types END,
      CASE WHEN i.infer_service_port IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.infer_service_port = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE i.infer_service_port END,
      CASE WHEN i.start_command IS NULL THEN '${TSV_NULL_PLACEHOLDER}' WHEN i.start_command = '' THEN '${TSV_EMPTY_PLACEHOLDER}' ELSE REPLACE(REPLACE(REPLACE(i.start_command, '\t', ' '), '\n', ' '), '\r', ' ') END,
      DATE_FORMAT(i.create_time, '%Y-%m-%d %H:%i:%s'),
      DATE_FORMAT(i.update_time, '%Y-%m-%d %H:%i:%s')
    FROM image i
    WHERE i.id = ${image_id}
      AND i.is_shared = 1
      AND i.is_platform_owned = 0
      AND i.status = 'CREATED'
      AND NULLIF(i.path, '') IS NOT NULL
      AND NULLIF(i.tag_postfix, '') IS NOT NULL;
  "
}

update_temp_image_failure() {
  local temp_id="$1"
  local message="$2"
  [[ -n "${temp_id}" ]] || return 0
  mysql_query "
    UPDATE image
    SET status = 'FAILURE',
        failed_reason = $(sql_quote_nullable "${message}")
    WHERE id = ${temp_id};
  " >/dev/null
}

insert_temp_platform_image() {
  local target_name="$1"
  local owner="$2"
  local source="$3"
  local tag="$4"
  local tag_postfix="$5"
  local description="$6"
  local cluster_id="$7"
  local source_path="$8"
  local target_path="$9"
  local types="${10}"
  local infer_service_port="${11}"
  local start_command="${12}"

  mysql_query "
    INSERT INTO image (
      name, owner, source, tag, tag_postfix, description, cluster_id, source_path, path,
      is_shared, status, types, infer_service_port, start_command, failed_reason, is_platform_owned
    ) VALUES (
      $(sql_quote_nullable "${target_name}"),
      $(sql_quote_nullable "${owner}"),
      $(sql_quote_nullable "${source}"),
      $(sql_quote_nullable "${tag}"),
      $(sql_quote_nullable "${tag_postfix}"),
      $(sql_quote_nullable "${description}"),
      $(sql_quote_nullable "${cluster_id}"),
      $(sql_quote_nullable "${source_path}"),
      $(sql_quote_nullable "${target_path}"),
      0,
      'CREATING',
      $(sql_quote_nullable "${types}"),
      $(sql_quote_nullable "${infer_service_port}"),
      $(sql_quote_nullable "${start_command}"),
      NULL,
      1
    );
    SELECT LAST_INSERT_ID();
  " | tail -n 1
}

finalize_image_migration() {
  local temp_id="$1"
  local source_id="$2"
  local finalize_sql_file exec_status
  finalize_sql_file="$(mktemp)"

  cat > "${finalize_sql_file}" <<EOF
START TRANSACTION;
UPDATE image
SET status = 'CREATED',
    is_shared = 1,
    failed_reason = NULL
WHERE id = ${temp_id};
UPDATE image
SET is_shared = 0
WHERE id = ${source_id};
COMMIT;
EOF

  mysql_exec_file "${finalize_sql_file}" >/dev/null
  exec_status=$?
  rm -f "${finalize_sql_file}"
  return "${exec_status}"
}

process_image_asset() {
  local source_id="$1"
  local source_name="$2"
  local owner="$3"
  local source="$4"
  local source_tag="$5"
  local tag_postfix="$6"
  local description="$7"
  local cluster_id="$8"
  local source_path="$9"
  local status="${10}"
  local types="${11}"
  local infer_service_port="${12}"
  local start_command="${13}"
  local create_time="${14}"
  local update_time="${15}"

  local target_name source_project dest_project source_repo dest_repo source_real_tag target_path temp_record_id=""
  local initial_row current_row

  target_name="$(pick_target_image_name "${source_name}" "${owner}" "${source_id}" "${source_tag}")" || {
    failure "${source_id}" "${source_name}" "${source_tag}" "${owner}" "${cluster_id}" "pick_target_name" "unable to allocate a unique platform image name" ""
    return 1
  }

  source_project="u_${owner}"
  dest_project="${HARBOR_PLATFORM_PROJECT}"
  source_repo="${source_name}"
  dest_repo="${target_name}"
  source_real_tag="${source_tag}${tag_postfix}"
  target_path="${HARBOR_REGISTRY_URL}/${dest_project}/${target_name}:${source_real_tag}"

  initial_row="$(image_row_by_id "${source_id}")"
  if [[ -z "${initial_row}" ]]; then
    failure "${source_id}" "${source_name}" "${source_tag}" "${owner}" "${cluster_id}" "revalidate_before_insert" "source image no longer matches migration criteria" ""
    return 1
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    log INFO "DRY_RUN insert temp platform image for image#${source_id}: ${target_name}:${source_tag}"
    log INFO "DRY_RUN copy Harbor artifact ${source_project}/${source_repo}:${source_real_tag} -> ${dest_project}/${dest_repo}:${source_real_tag}"
    success "${source_id}" "${source_name}" "${source_tag}" "${target_name}" "${source_tag}" "${cluster_id}" "${target_path}" ""
    return 0
  fi

  temp_record_id="$(insert_temp_platform_image \
    "${target_name}" "${owner}" "${source}" "${source_tag}" "${tag_postfix}" \
    "${description}" "${cluster_id}" "${source_path}" "${target_path}" \
    "${types}" "${infer_service_port}" "${start_command}")" || {
      failure "${source_id}" "${source_name}" "${source_tag}" "${owner}" "${cluster_id}" "insert_temp_record" "failed to insert platform temp record" ""
      return 1
    }

  current_row="$(image_row_by_id "${source_id}")"
  if [[ "${initial_row}" != "${current_row}" ]]; then
    update_temp_image_failure "${temp_record_id}" "source image changed before harbor copy"
    failure "${source_id}" "${source_name}" "${source_tag}" "${owner}" "${cluster_id}" "revalidate_before_copy" "source image changed before harbor copy" "${temp_record_id}"
    return 1
  fi

  ensure_harbor_project_exists "${dest_project}" || {
    update_temp_image_failure "${temp_record_id}" "failed to ensure harbor project ${dest_project}"
    failure "${source_id}" "${source_name}" "${source_tag}" "${owner}" "${cluster_id}" "ensure_harbor_project" "failed to ensure harbor project ${dest_project}" "${temp_record_id}"
    return 1
  }

  copy_harbor_artifact "${source_project}" "${source_repo}" "${source_real_tag}" "${dest_project}" "${dest_repo}" || {
    update_temp_image_failure "${temp_record_id}" "failed to copy harbor artifact ${source_project}/${source_repo}:${source_real_tag}"
    failure "${source_id}" "${source_name}" "${source_tag}" "${owner}" "${cluster_id}" "copy_harbor_artifact" "failed to copy harbor artifact ${source_project}/${source_repo}:${source_real_tag}" "${temp_record_id}"
    return 1
  }

  current_row="$(image_row_by_id "${source_id}")"
  if [[ "${initial_row}" != "${current_row}" ]]; then
    update_temp_image_failure "${temp_record_id}" "source image changed before db finalize"
    failure "${source_id}" "${source_name}" "${source_tag}" "${owner}" "${cluster_id}" "revalidate_before_finalize" "source image changed before db finalize" "${temp_record_id}"
    return 1
  fi

  finalize_image_migration "${temp_record_id}" "${source_id}" || {
    update_temp_image_failure "${temp_record_id}" "db finalize failed after harbor copy; orphan artifact may remain"
    failure "${source_id}" "${source_name}" "${source_tag}" "${owner}" "${cluster_id}" "db_finalize" "db finalize failed after harbor copy; orphan artifact may remain in ${dest_project}" "${temp_record_id}"
    return 1
  }

  success "${source_id}" "${source_name}" "${source_tag}" "${target_name}" "${source_tag}" "${cluster_id}" "${target_path}" "${temp_record_id}"
}

main() {
  local row
  if [[ -z "${MYSQL_PASSWORD}" ]]; then
    log WARN "MYSQL_PASSWORD is empty. Make sure this is intended."
  fi
  if ! require_harbor_config; then
    log ERROR "HARBOR_URL / HARBOR_USER / HARBOR_PASSWORD are required."
    exit 1
  fi

  log INFO "Start image migration. DRY_RUN=${DRY_RUN}"

  while IFS=$'\t' read -r \
    source_id source_name owner source source_tag tag_postfix description cluster_id source_path status types infer_service_port start_command create_time update_time; do
    [[ -n "${source_id}" ]] || continue
    process_image_asset \
      "${source_id}" "${source_name}" "${owner}" "${source}" "${source_tag}" "${tag_postfix}" \
      "${description}" "${cluster_id}" "${source_path}" "${status}" \
      "${types}" "${infer_service_port}" "${start_command}" "${create_time}" "${update_time}"
  done < <(list_image_assets)

  log INFO "Image migration finished. Success file: ${SUCCESS_FILE}"
  log INFO "Image migration finished. Failure file: ${FAILURES_FILE}"
}

main "$@"
