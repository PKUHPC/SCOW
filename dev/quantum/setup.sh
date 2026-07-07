#!/bin/bash
set -e

CONDA_DIR="${CONDA_DIR:-/opt/conda}"

# Install anaconda from PKU mirror
wget https://mirrors.pku.edu.cn/anaconda/archive/Anaconda3-5.3.0-Linux-x86_64.sh -O /tmp/anaconda.sh
bash /tmp/anaconda.sh -b -p "$CONDA_DIR"
rm /tmp/anaconda.sh

export PATH="$CONDA_DIR/bin:$PATH"

# Setup anaconda repository
cat >/root/.condarc <<EOF
channels:
  - defaults
show_channel_urls: true
default_channels:
  - https://mirrors.ustc.edu.cn/anaconda/pkgs/main
  - https://mirrors.ustc.edu.cn/anaconda/pkgs/r
custom_channels:
  conda-forge: https://mirrors.ustc.edu.cn/anaconda/cloud
  pytorch: https://mirrors.ustc.edu.cn/anaconda/cloud
  bioconda: https://mirrors.ustc.edu.cn/anaconda/cloud
EOF

# Setup pypi config
mkdir -p /root/.pip
cat >/root/.pip/pip.conf <<EOF
[global]
index-url = https://mirrors.ustc.edu.cn/pypi/web/simple
EOF

# Clean up conda
conda clean -i

# Create a new environment using environment.yaml
conda env create --file environment.yaml

