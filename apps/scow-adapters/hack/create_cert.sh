#!/usr/bin/env bash

set -e

function usage() {
  echo "这个脚本是用来生成adapter和scow证书"
  echo "Usage: create_cert.sh <adapter_address> <scow_address>. 当有多个adapter时, 各个adapter_address用逗号连接， scow_address只会有一个"
  echo "Example: create_cert.sh 192.168.0.1 192.168.0.2(单adapter单scow); create_cert.sh 192.168.0.1,192.168.0.2,192.168.0.3 192.168.0.4(三adapter单scow);"
}

function check_command() {
    local command=$1

    if ! command -v "${command}" &> /dev/null; then
        echo "Error: ${command} not found"
        sudo yum install "${command}" -y
        exit 1
    fi
}

## 生成ca证书
function create_ca() {
    openssl genrsa -out ca.key 4096

    openssl req -new -x509 -nodes -sha256 -days 3650 -subj "/C=CN/ST=HuNan/L=ChangSha/O=ICode/OU=SW/CN=Scow" -key ca.key -out ca.crt
}

## 生成服务端（adapter）证书
function create_adapter_certs() {
    adapter_address=$1

    # 检查传入的第一个参数
    if [[ "$adapter_address" == *,* ]]; then
        # 参数包含逗号，按逗号分割成数组
        ips=(`echo "$adapter_address" | tr ',' '\n'`)
    else
        # 参数不包含逗号，视为单个IP地址
        ips=("$1")
    fi

    cat > adapter.conf <<EOF
[ req ]
default_bits        = 2048  # 设置生成密钥的默认长度为2048位
prompt              = no    # 关闭命令行中的交互式问题，使用文件中的配置
default_md          = sha256  # 设置使用 SHA-256 作为签名哈希算法
distinguished_name  = req_distinguished_name  # 指定使用哪个区块定义证书的主题
req_extensions      = req_ext  # 指定证书请求扩展的部分

[ req_distinguished_name ]
countryName                 = CN
stateOrProvinceName         = HuNan
localityName                = ChangSha
organizationName            = ICode
commonName                  = Scow

[ req_ext ]
subjectAltName = @alt_names

[alt_names]
EOF

    index=1
    # 循环处理每个IP地址, 给每个适配器生成cert
    for ip in "${ips[@]}"; do
        echo "IP.${index}      = ${ip}" >> adapter.conf
        ((index++))
        sleep 1
    done

    openssl genrsa -out adapter.key 4096

    openssl req -new -key adapter.key -out adapter.csr -config adapter.conf

    openssl x509 -req -in adapter.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out adapter.crt -days 1024 -sha256 -extensions req_ext -extfile adapter.conf
}


## 生成客户端（scow）证书
function create_scow_certs() {
    scow_address=$1

    cat > scow.conf <<EOF
[ req ]
default_bits        = 2048  # 设置生成密钥的默认长度为2048位
prompt              = no    # 关闭命令行中的交互式问题，使用文件中的配置
default_md          = sha256  # 设置使用 SHA-256 作为签名哈希算法
distinguished_name  = req_distinguished_name  # 指定使用哪个区块定义证书的主题
req_extensions      = req_ext  # 指定证书请求扩展的部分

[ req_distinguished_name ]
countryName                 = CN
stateOrProvinceName         = HuNan
localityName                = ChangSha
organizationName            = ICode
commonName                  = Scow

[ req_ext ]
subjectAltName = @alt_names

[alt_names]
IP      = ${scow_address}
EOF

    openssl genrsa -out scow.key 4096

    openssl req -new -key scow.key -out scow.csr -config scow.conf

    openssl x509 -req -in scow.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out scow.crt -days 1024 -sha256 -extensions req_ext -extfile scow.conf
}

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

check_command openssl

create_ca

# 给adapter生成cert
echo "给adapter: ${1} 生成证书"
create_adapter_certs "${1}"

# 给scow生成cert
echo "给scow: ${2} 生成证书"
create_scow_certs "${2}"
