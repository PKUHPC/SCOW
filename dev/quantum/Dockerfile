FROM ccrepo.pku.edu.cn/dockerhub/library/debian:12

# Setup proxy
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.pku.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources

# Install necessary tools
RUN apt update && apt install -y curl wget sudo openssh-client bzip2

# Setup Anaconda
WORKDIR /tmp/anaconda
COPY environment.yaml setup.sh tensorcircuit-0.12.0+qobody-py3-none-any.whl /tmp/anaconda/
ENV CONDA_DIR=/opt/conda
RUN bash setup.sh && rm setup.sh
ENV PATH="$CONDA_DIR/bin:$PATH"

# ENV QOBODY_BASE_URL=http://localhost:3000/api/tc/
ENV QOBODY_BASE_URL=http://localhost:5007/api/tc/

# # Modify the URL for the tensorcircuit SDK to point to the running quantum server
# # RUN sed -i 's|https://quantum.tencent.com/cloud/quk/|http://localhost:3000/api/tc/|g' /opt/conda/envs/tensorcircuit/lib/python3.10/site-packages/tensorcircuit/cloud/config.py

# Create a normal user dev and grant it passwordless sudo permission
RUN useradd -ms /bin/bash dev && usermod -aG sudo dev && echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

USER dev

WORKDIR /home/dev

COPY run.sh /home/dev/run.sh

EXPOSE 8888

ENTRYPOINT [ "bash", "run.sh" ]
