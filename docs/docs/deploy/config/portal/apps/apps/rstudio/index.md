---
sidebar_position: 1
---

# RStudio

## 软件简介

RStudio Server是RStudio公司提供的一款基于Web的R开发环境，可以通过Web浏览器远程访问，实现对R编程语言的开发、调试和管理。RStudio Server支持多用户并发访问，具有良好的用户管理和权限控制，支持SSH和HTTPS等安全协议，是企业级和团队协作开发的理想选择。

## 前提条件

请确保在需要运行应用的计算节点上安装有R和RStudio Server。RStudio Server 1.4.1103之前版本，建议下载相应系统的rpm包进行安装，这样相对比较简单。RStudio Server 1.4.1103及之后的版本，为保证和平台的兼容性，建议通过编译后构建Singularity镜像进行安装，这样可以减少跨平台、跨集群的重复编译。

### 1、RStudio Server 1.4.1103之前版本的安装

#### 1.1、R安装

具体安装步骤请参考附章中R的安装。

#### 1.2、RStudio Server安装

```bash
# 下载rpm包
wget https://download2.rstudio.org/server/centos6/x86_64/rstudio-server-rhel-1.3.959-x86_64.rpm

# 拷贝只共享存储
mkdir -p /data/software/rstudio-server/1.3.959
cp rstudio-server-rhel-1.3.959-x86_64.rpm /data/software/rstudio-server/1.3.959
cd /data/software/rstudio-server/1.3.959

# 解压安装
rpm2cpio rstudio-server-rhel-1.3.959-x86_64.rpm | cpio -div
```

### 2、RStudio Server 1.4.1103及之后版本的安装

#### 2.1、Singularity安装

具体安装步骤请参考附章中Singularity的安装。

#### 2.2、R安装

通过构建Singularity镜像的方式安装RStudio Server，Singularity镜像内无需安装R环境，可直接使用宿主机系统里面的R环境，所以R安装在宿主机系统即可，具体安装步骤请参考附章中R的安装。

### 2.3、构建RStudio Server镜像

具体安装步骤请参考附章中构建RStudio Server镜像。

下面讲解如何配置使用RStudio Server。

## 配置文件

创建`config/apps`目录，在里面创建`rstudio.yml`文件，其内容如下：

### 1、RStudio Server 1.4.1103之前版本

```yaml title="config/apps/rstudio.yml"
# 这个应用的ID
id: rstudio

# 这个应用的名字
name: RStudio

# 指定应用类型为web
type: web

# Web应用的配置
web:
  # 指定反向代理类型
  proxyType: relative
  # 准备脚本
  beforeScript: |
    export PORT=$(get_port)
    export PASSWORD=$(get_password 12)
    export SLURM_COMPUTE_NODE_HOSTNAME=$(hostname)
    export APPURI="${PROXY_BASE_PATH}/${SLURM_COMPUTE_NODE_HOSTNAME}/${PORT}/"
    export USER=${USER}

  # 运行任务的脚本。可以使用准备脚本定义的变量
  script: |
    setup_env () {
        # Additional environment which could be moved into a module
        export RSTUDIO_PASSWORD=${PASSWORD}

        # rstudio的路径
        export RSTUDIO_HOME=/data/software/rstudio-server/1.3.959/usr/lib/rstudio-server
        export RSTUDIO_BIN_PATH=${RSTUDIO_HOME}/bin
        export RSTUDIO_RSERVER=${RSTUDIO_BIN_PATH}/rserver
        export RSTUDIO_RSESSION=${RSTUDIO_BIN_PATH}/rsession

        export RSTUDIO_AUTH="/data/software/rstudio-server/auth"
        export RSESSION_WRAPPER_FILE="${PWD}/rsession.sh"
        export DB_CONF_FILE="${PWD}/database.conf"
        export WHICHR=/data/software/R/${r_version}/bin/R
    }
    setup_env

    (
    umask 077
    sed 's/^ \{2\}//' > "${RSESSION_WRAPPER_FILE}" << EOL
    #!/usr/bin/env bash
    # Log all output from this script
    export RSESSION_LOG_FILE="${PWD}/rsession.log"
    exec &>>"\${RSESSION_LOG_FILE}"
    # Launch the original command
    echo "Launching rsession..."
    set -x
    exec ${RSTUDIO_RSESSION} --r-libs-user "${R_LIBS_USER}" "\${@}"
    EOL
    )

    chmod 700 "${RSESSION_WRAPPER_FILE}"
    cd "${HOME}"
    export TMPDIR="$(mktemp -d)"
    mkdir -p "$TMPDIR/rstudio-server"
    python -c 'from uuid import uuid4; print(uuid4())' > "$TMPDIR/rstudio-server/secure-cookie-key"
    chmod 0600 "$TMPDIR/rstudio-server/secure-cookie-key"
    
    set -x
    # Launch the RStudio Server
    export PATH=/data/software/rstudio-server/1.3.959/usr/lib/rstudio-server/bin:$PATH
    echo "Starting up rserver..."
    # RStudio Server 1.4.1103之前版本不需要--database-config-file，之后版本需要增加此配置
    /data/software/rstudio-server/1.3.959/usr/lib/rstudio-server/bin/rserver \
      --www-port "${PORT}" \
      --auth-none 1 \
      --auth-pam-helper-path "${RSTUDIO_AUTH}" \
      --auth-encrypt-password 0 \
      --rsession-path "${RSESSION_WRAPPER_FILE}" \
      --server-data-dir "${TMPDIR}" \
      --server-user ${USER} \
      --secure-cookie-key-file "${TMPDIR}/rstudio-server/secure-cookie-key" \
      --rsession-which-r ${WHICHR}
      
      echo 'Singularity as exited...'

  # 如何连接应用
  connect:
    method: POST
    path: /auth-do-sign-in
    formData:
      password: "{{ PASSWORD }}"
      username: "{{ USER }}"
      appUri: "{{ APPURI }}"
      
# 配置HTML表单   
attributes:
  - type: select
    name: r_version
    label: 请选择R版本
    select:
      - value: R-3.6.0
        label: 3.6.0
      - value: R-4.2.3
        label: 4.2.3
  - type: text
    name: sbatchOptions
    label: 其他sbatch参数
    required: false
    placeholder: "比如：--gpus gres:2 --time 10"
```

### 2、RStudio Server 1.4.1103及之后版本（源码安装R）

```yaml title="config/apps/rstudio.yml"
# 这个应用的ID
id: rstudio

# 这个应用的名字
name: RStudio

# 指定应用类型为web
type: web

# Web应用的配置
web:
  # 指定反向代理类型
  proxyType: relative
  # 准备脚本
  beforeScript: |
    export PORT=$(get_port)
    export PASSWORD=$(get_password 12)
    export SLURM_COMPUTE_NODE_HOSTNAME=$(hostname)
    export APPURI="${PROXY_BASE_PATH}/${SLURM_COMPUTE_NODE_HOSTNAME}/${PORT}/"
    export USER=${USER}
    export SINGULARITY_VERSION="singularity/3.9.2"

  # 运行任务的脚本。可以使用准备脚本定义的变量
  script: |
    setup_env () {
        # Additional environment which could be moved into a module
        export RSTUDIO_PASSWORD=${PASSWORD}
        # Change these to suit
        export RSTUDIO_SERVER_IMAGE="/data/software/rstudio-server/rstudio.sif"

        # 容器中rstudio的路径
        export RSTUDIO_HOME=/usr/lib/rstudio-server
        export RSTUDIO_BIN_PATH=${RSTUDIO_HOME}/bin
        export RSTUDIO_RSERVER=${RSTUDIO_BIN_PATH}/rserver
        export RSTUDIO_RSESSION=${RSTUDIO_BIN_PATH}/rsession

        export RSTUDIO_AUTH="/data/software/rstudio-server/auth"
        export RSESSION_WRAPPER_FILE="${PWD}/rsession.sh"
        export DB_CONF_FILE="${PWD}/database.conf"
        export WHICHR=/data/software/R/${r_version}/bin/R
    }
    setup_env
    module switch ${SINGULARITY_VERSION}
    (
    umask 077
    sed 's/^ \{2\}//' > "${RSESSION_WRAPPER_FILE}" << EOL
    #!/usr/bin/env bash
    # Log all output from this script
    export RSESSION_LOG_FILE="${PWD}/rsession.log"
    exec &>>"\${RSESSION_LOG_FILE}"
    # Launch the original command
    echo "Launching rsession..."
    set -x
    exec ${RSTUDIO_RSESSION} --r-libs-user "${R_LIBS_USER}" "\${@}"
    EOL
    )

    chmod 700 "${RSESSION_WRAPPER_FILE}"
    cd "${HOME}"
    export TMPDIR="$(mktemp -d)"
    mkdir -p "$TMPDIR/rstudio-server"
    python -c 'from uuid import uuid4; print(uuid4())' > "$TMPDIR/rstudio-server/secure-cookie-key"
    chmod 0600 "$TMPDIR/rstudio-server/secure-cookie-key"

    (
    umask 177
    cat > "${DB_CONF_FILE}" << EOL
    provider=sqlite
    directory=${HOME}/.local/share/rstudio/database
    EOL
    )
    
    set -x
    # Launch the RStudio Server
    echo "Starting up rserver..."
    # RStudio Server 1.4.1103之前版本不需要--database-config-file，之后版本需要增加此配置
    singularity run -B "/tmp:/tmp","/data:/data" "$RSTUDIO_SERVER_IMAGE" ${RSTUDIO_RSERVER} \
      --www-port "${PORT}" \
      --auth-none 1 \
      --auth-pam-helper-path "${RSTUDIO_AUTH}" \
      --auth-encrypt-password 0 \
      --rsession-path "${RSESSION_WRAPPER_FILE}" \
      --server-data-dir "${TMPDIR}" \
      --server-user ${USER} \
      --secure-cookie-key-file "${TMPDIR}/rstudio-server/secure-cookie-key" \
      --database-config-file "${DB_CONF_FILE}" \
      --rsession-which-r ${WHICHR}
      
      echo 'Singularity as exited...'

  # 如何连接应用
  connect:
    method: POST
    path: /auth-do-sign-in
    formData:
      password: "{{ PASSWORD }}"
      username: "{{ USER }}"
      appUri: "{{ APPURI }}"
      
# 配置HTML表单   
attributes:
  - type: select
    name: r_version
    label: 请选择R版本
    select:
      - value: R-3.6.0
        label: 3.6.0
      - value: R-4.2.3
        label: 4.2.3
  - type: text
    name: sbatchOptions
    label: 其他sbatch参数
    required: false
    placeholder: "比如：--gpus gres:2 --time 10"
```

### 3、RStudio Server 1.4.1103及之后版本（Conda环境安装R）

```yaml title="config/apps/rstudio.yml"
# 这个应用的ID
id: rstudio

# 这个应用的名字
name: RStudio

# 指定应用类型为web
type: web

# Web应用的配置
web:
  # 指定反向代理类型
  proxyType: relative
  # 准备脚本
  beforeScript: |
    export PORT=$(get_port)
    export PASSWORD=$(get_password 12)
    export SLURM_COMPUTE_NODE_NAME=$(hostname)
    export APPURI="${PROXY_BASE_PATH}/${SLURM_COMPUTE_NODE_NAME}/${PORT}/"
    export USER=${USER}
    export SINGULARITY_VERSION="singularity/3.9.2"
    export SHELL_NAME=$(echo ${SHELL} | awk -F'/' '{print $NF}')
    export CONDA_VERSION="anaconda/3-2023.03"

  # 运行任务的脚本。可以使用准备脚本定义的变量
  script: |
    setup_env () {
        # Additional environment which could be moved into a module
        export RSTUDIO_PASSWORD=${PASSWORD}
        # Change these to suit
        export RSTUDIO_SERVER_IMAGE="/data/software/rstudio-server/rstudio.sif"

        # 容器中rstudio的路径
        export RSTUDIO_HOME=/usr/lib/rstudio-server
        export RSTUDIO_BIN_PATH=${RSTUDIO_HOME}/bin
        export RSTUDIO_RSERVER=${RSTUDIO_BIN_PATH}/rserver
        export RSTUDIO_RSESSION=${RSTUDIO_BIN_PATH}/rsession

        export RSTUDIO_AUTH="/data/software/rstudio-server/auth"
        export RSESSION_WRAPPER_FILE="${PWD}/rsession.sh"
        export DB_CONF_FILE="${PWD}/database.conf"
        export WHICHR=/data/software/R/${r_version}/bin/R
    }
    setup_env
    module switch ${SINGULARITY_VERSION}

    for m in ${textModuleName}; do module switch ${m}; done

    conda -V &> /dev/null
    if [ $? -ne 0 ]; then
      module switch ${CONDA_VERSION}
    fi
    # init conda
    eval "$($(which conda) shell.${SHELL_NAME} hook)"

    conda activate ${r_version}
    if [ $? -ne 0 ]; then
      echo "${r_version}不存在，请输入正确的R版本！"
      exit 2
    fi

    (
    umask 077
    sed 's/^ \{2\}//' > "${RSESSION_WRAPPER_FILE}" << EOL
    #!/usr/bin/env bash
    # Log all output from this script
    export RSESSION_LOG_FILE="${PWD}/rsession.log"
    exec &>>"\${RSESSION_LOG_FILE}"
    # Launch the original command
    echo "Launching rsession..."
    set -x
    exec ${RSTUDIO_RSESSION} --r-libs-user "${R_LIBS_USER}" "\${@}"
    EOL
    )

    chmod 700 "${RSESSION_WRAPPER_FILE}"
    cd "${HOME}"
    export TMPDIR="$(mktemp -d)"
    mkdir -p "$TMPDIR/rstudio-server"
    python -c 'from uuid import uuid4; print(uuid4())' > "$TMPDIR/rstudio-server/secure-cookie-key"
    chmod 0600 "$TMPDIR/rstudio-server/secure-cookie-key"

    (
    umask 177
    cat > "${DB_CONF_FILE}" << EOL
    provider=sqlite
    directory=${HOME}/.local/share/rstudio/database
    EOL
    )

    set -x
    # Launch the RStudio Server
    echo "Starting up rserver..."
    # RStudio Server 1.4.1103之前版本不需要--database-config-file，之后版本需要增加此配置
    singularity run -B "/tmp:/tmp","/data:/data" "$RSTUDIO_SERVER_IMAGE" ${RSTUDIO_RSERVER} \
      --www-port "${PORT}" \
      --auth-none 1 \
      --auth-pam-helper-path "${RSTUDIO_AUTH}" \
      --auth-encrypt-password 0 \
      --rsession-path "${RSESSION_WRAPPER_FILE}" \
      --server-data-dir "${TMPDIR}" \
      --server-user ${USER} \
      --secure-cookie-key-file "${TMPDIR}/rstudio-server/secure-cookie-key" \
      --database-config-file "${DB_CONF_FILE}"
      # --rsession-which-r ${WHICHR}

      echo 'Singularity as exited...'

  # 如何连接应用
  connect:
    method: POST
    path: /auth-do-sign-in
    formData:
      password: "{{ PASSWORD }}"
      username: "{{ USER }}"
      appUri: "{{ APPURI }}"

# 配置HTML表单   
attributes:
  - type: select
    name: r_version
    label: 请选择R版本
    select:
      - value: R-3.6.0
        label: 3.6.0
      - value: R-4.2.3
        label: 4.2.3
  - type: text
    name: textModuleName
    label: Modules
    required: false  # 输入需要额外加载的环境模块列表
    placeholder: 输入需要额外加载的环境模块列表，模块之间用空格分开（比如：python/2.7.5 code-server/4.9.1）  # 提示信息
  - type: text
    name: sbatchOptions
    label: 其他sbatch参数
    required: false
    placeholder: "比如：--gpus gres:2 --time 10"
```

增加了此文件后，刷新WEB浏览器即可。

对于RStudio，export以下变量的含义是：

- `SLURM_COMPUTE_NODE_HOSTNAME`: 计算节点的主机名
- `SINGULARITY_VERSION`：Singularity版本

## 附章

### 1、Singularity安装

Singularity用于构建和运行RStudio Server容器镜像，建议安装在共享存储上，集群各节点只需要挂载上共享存储，并配置好环境变量后便可以使用。

- 安装Singularity依赖包：

    ```bash
    yum install -y gcc libuuid-devel squashfs-tools openssl-devel make
    ```

- Singularity使用Go语言开发，需要先安装Go：

    ```bash
    export VERSION=1.20.3 OS=linux ARCH=amd64
    wget https://dl.google.com/go/go$VERSION.$OS-$ARCH.tar.gz
    mkdir -p /data/software/go
    tar -C /data/software/go -xzvf go$VERSION.$OS-$ARCH.tar.gz
    mv /data/software/go/go /data/software/go/$VERSION
    rm -f go$VERSION.$OS-$ARCH.tar.gz
    ```

- 将Go添加到module工具中统一管理：

    ```bash
    # ${MODULEPATH}为modulefile所在的路径
    mkdir -p ${MODULEPATH}/go
    cat >> ${MODULEPATH}/go/1.20.3 << EOF
    #%Module1.0#####################################################################
    ##
    ## go@1.20.3  modulefile
    ##
    proc ModulesHelp { } {

    puts stderr "    This module defines environment variables, aliases and add PATH, LD_LIBRARY_PATH for go"
    puts stderr "    Version 1.20.3"
    }

    module-whatis   "go@1.20.3"
    prepend-path    PATH                    "/data/software/go/1.20.3/bin"
    prepend-path    LIBRARY_PATH            "/data/software/go/1.20.3/lib"
    prepend-path    LD_LIBRARY_PATH         "/data/software/go/1.20.3/lib"
    EOF
    ```

- 安装Singularity：

    ```bash
    export VERSION=3.9.2
    wget https://github.com/sylabs/singularity/releases/download/v${VERSION}/singularity-ce-${VERSION}.tar.gz
    tar -xzf singularity-ce-${VERSION}.tar.gz
    cd singularity-ce-${VERSION}
    module load go/1.20.3
    ./mconfig --prefix=/data/software/singularity/${VERSION}
    cd builddir/
    make -j && make install
    ```

- 将Singularity添加到module工具中统一管理：

    ```bash
    # ${MODULEPATH}为modulefile所在的路径
    mkdir -p ${MODULEPATH}/singularity
    cat >> ${MODULEPATH}/singularity/3.9.2 << EOF
    #%Module1.0#####################################################################
    ##
    ## singularity@3.9.2  modulefile
    ##
    proc ModulesHelp { } {

    puts stderr "    This module defines environment variables, aliases and add PATH, LD_LIBRARY_PATH for singularity"
    puts stderr "    Version 3.9.2"
    }

    module-whatis   "singularity@3.9.2"
    prepend-path    PATH                    "/data/software/singularity/3.9.2/bin"
    EOF
    ```

### 2、R安装

#### 2.1、源码安装R

- 安装R的依赖包:

    ```bash
    yum -y install gcc-gfortran gcc-c++ glibc-headers java-1.8.0-openjdk java-1.8.0-openjdk-devel libX11-devel libXt-devel xz-devel curl-devel bzip2-devel readline-devel zlib-devel openssl-devel pcre2
    ```

- 安装R：

    ```bash
    # 下载R的源代码并编译安装
    curl -LJO https://cran.rstudio.com/src/base/R-4/R-4.2.3.tar.gz
    tar zxf R-4.2.3.tar.gz

    # 必须有--enable-R-shlib这个选项(lib64/R/lib/libR.so)
    ./configure --prefix=/data/software/R/R-4.2.3 --enable-R-shlib
    make -j
    make install
    ```

- 将R添加到module工具中统一管理：

    ```bash
    # ${MODULEPATH}为modulefile所在的路径
    mkdir -p ${MODULEPATH}/R
    cat >> ${MODULEPATH}/R/3-2023.03 << EOF
    #%Module1.0#####################################################################
    ##
    ## R@4.2.3  modulefile
    ##
    proc ModulesHelp { } {
        puts stderr "\tThis module defines environment variables, aliases and add PATH for R"
        puts stderr "\tVersion 4.2.3"
    }

    module-whatis   "R@4.2.3"
    prepend-path    PATH                    "/data/software/R/R-4.2.3/bin"
    EOF
    ```

#### 2.2、在Conda环境安装R

```bash
# 载入conda到系统环境中，并初始化conda环境
module load anaconda/3-2023.03
eval "$($(which conda) shell.bash hook)"

# 添加北大镜像源，查找相应版本的R进行安装
conda config --add channels https://mirrors.pku.edu.cn/anaconda/pkgs/free/
conda config --add channels https://mirrors.pku.edu.cn/anaconda/pkgs/main/
conda config --add channels https://mirrors.pku.edu.cn/anaconda/cloud/conda-forge/
conda search R


# 根据查找到的R版本，创建Conda虚拟环境，并在创建的时候指定需要安装的R版本，这里选择安装R-3.6.0版本;
conda create -n R-3.6.0 r=3.6.0 -y

# 进入上一步创建好的虚拟环境；
conda activate R-3.6.0

# 安装R语言库，比如stringi
conda install r-stringi -y

# 安装完后就可以用R语言环境了，如果要退出当前环境则执行以下指令；
conda deactivate
```

### 3、构建RStudio Server镜像

- 下载RStudio Server源码包进行编译打包：

    ```bash
    # 下载源码包
    wget https://github.com/rstudio/rstudio/archive/refs/tags/v2023.03.0+386.tar.gz
    # 解压源码包
    tar -zxvf v2023.03.0+386.tar.gz
    cd rstudio-2023.03.0-386

    # 跳过登录时的csrf-token验证，高版本的RStudio Server集成到scow需要跳过验证
    sed -i '134s/^/\/\//' src/cpp/server/auth/ServerAuthCommon.cpp

    # 在当前路径初始化git仓库
    git init
    # 增加git缓存配置
    git config --global http.postBuffer 5242880000
    # 因为是新初始化的git仓库，所以没有提交记录，那么没有HEAD引用。通过执行第一次提交来创建一个HEAD引用
    git config --global user.email ${USER_EMAIL_ADDRESS}
    git commit --allow-empty -n -m "Initial commit."

    # 以下脚本首先构建编译rstudio server所需环境的docker容器，然后在容器内进行rstudio server编译，编译完成后会在源码包路径的package目录下生成rstudio server的rpm包
    # 执行过程如果遇到git克隆包克隆不下来的情况，可以在执行的shell环境添加代理或者修改代码中的克隆地址
    sh docker/docker-compile.sh centos7 server 2023.03.0-386
    # 可以看到目录下有编译好的rstudio-server-rhel-2023.03.0-386-x86_64-relwithdebinfo.rpm包
    ls package
    ```

- 在rstudio-2023.03.0-386目录下编写Dockerfile文件：

    ```bash
    FROM centos:7

    COPY package/rstudio-server-rhel-2023.03.0-386-x86_64-relwithdebinfo.rpm /

    RUN yum -y update && \
        yum -y install epel-release && \
        yum -y install which gcc-gfortran gcc-c++ glibc-headers java-1.8.0-openjdk java-1.8.0-openjdk-devel libX11-devel libXt-devel xz-devel curl-devel bzip2-devel readline-devel zlib-devel openssl-devel pcre2 initscripts postgresql-libs psmisc && \
        cd / && \
        rpm2cpio rstudio-server-rhel-2023.03.0-386-x86_64-relwithdebinfo.rpm | cpio -div && \
        mkdir data && \
        yum clean all
    ```

- 在rstudio-2023.03.0-386目录下构建RStudio Server的docker镜像：

    ```bash
    docker build -t rstudio:2023.03.0-386 .
    ```

- 构建RStudio Server的Singularity镜像：

    ```bash
    singularity build rstudio.sif docker-daemon://rstudio:2023.03.0-386
    ```

- 将Singularity镜像拷贝到共享存储，以便在计算节点可以访问并运行：

    ```bash
    cp rstudio.sif /data/software/rstudio-server/
    ```
