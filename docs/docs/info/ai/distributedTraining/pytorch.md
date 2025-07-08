---
sidebar_position: 1
title: PyTorchDDP 分布式训练
---

PyTorch DistributedDataParallel（DDP）是一种数据并行的分布式训练方法。通过 DDP 创建多个进程进行模型训练，通过 ring-all-reduce 的方法做进程通讯，完成梯度的交换及参数更新。

## 基本流程
1. 用户在【训练】模块创建一个训练任务时选择训练框架为 `PyTorch`，按需配置各种训练角色并提交任务表单进入任务创建环节。PyTorch DDP master  和 worker 这两种角色用于训练模型，其中编号为 `0` 的 master（master0）额外承担保存 checkpoint 或日志的任务。
2. 任务提交后，scow 将为用户创建对应的容器并向所有容器注入相关的环境变量，通过环境变量用户代码得知集群的信息以及当前容器对应的训练角色，从而完成对应角色的本职任务直到训练结束。
    - 训练之前，平台将等待所有容器之间的网络通畅。
    - 训练过程中，任意容器失败（退出码非 `0`）则训练任务失败。
    - 所有容器训练完成（退出码为 `0`）则训练任务成功。

## 调用方式
平台为用户注入了有可能在训练代码或者入口命令需要用到的环境变量，通过 PyTorch 官方提供的 `torch.distributed.launch` 启动命令结合环境变量启动训练任务。

### 环境变量
- `MASTER_ADDR`: worker0 （RANK=0 的 master）的地址 
- `MASTER_PORT`:  worker0 （RANK=0 的 master）的端口
- `WORLD_SIZE`: 训练容器的数量
- `RANK`: 训练容器（机器）的编号，不同实例中该环境变量的值不同
- `nproc_per_node`: 单个容器（机器）上运行的进程数，使用 GPU 时通常为每台机器上的 GPU 数量

使用如下命令启动 DDP 分布式训练任务：
```bash
# 选择 GPU 实例规格时，通过环境变量配置每个容器上的训练进程数量与 GPU 数量一致。
python -m torch.distributed.launch --nnodes ${WORLD_SIZE} --nproc_per_node  ${nproc_per_node} --master_addr ${MASTER_ADDR} --node_rank ${RANK} --master_port ${MASTER_PORT}  <代码文件的绝对路径>
# ${nproc_per_node} 替换为scow 前端界面输入的GPU卡数 
systemctl disable --now firewalld
```

获取环境变量python 代码 demo:
```python
import sys
import os
import socket
import subprocess

def get_work_index():
    while True:
        try:
            # .replace('master','worker')
            addr = os.environ.get("MASTER_ADDR", "{}")
            # 特殊场景下master_addr 为localhost时，需要拿hostname
            if addr == "localhost":  # 当为master节点时，需要通过hostname获取IP，不然获取IP为127.0.0.1
                addr = os.environ.get("HOSTNAME", "{}")
            master_addr = socket.gethostbyname(addr)  # 获取master IP地址
            master_port = os.environ.get("MASTER_PORT", "{}")  # 获取master port
            # print("MASTER_ADDR: %s", addr)
            world_size = os.environ.get("WORLD_SIZE", "{}")  # job 的总进程数
            # 当前进程的进程号, 必须在 rank==0 的进程内保存参数
            rank = os.environ.get("RANK", "{}")
            # logging.info("RANK: %s", rank)
            break
        except:
            print("get pytorch env failed, sleep for 1 second~")
            os.system("sleep 1s")
            continue
    return int(world_size), int(rank), master_addr, master_port


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--nproc_per_node", default="1", type=str, help="GPUs per node")  # 默认每个 pod 跑 1 个进程
    parser.add_argument("--script", required=True, type=str, help="Training script to run, e.g., train.py") 
    args = parser.parse_args()
    world_size, rank, master_addr, master_port = get_work_index()

    command = [
        "torchrun",
        "--nproc_per_node",
        args.nproc_per_node,
        "--nnodes",
        str(world_size),
        "--node_rank",
        str(rank),
        "--master_addr",
        str(master_addr),
        "--master_port",
        str(master_port),
        args.script,
    ]
    print(command)
    subprocess.run(command)
    
# 使用python 获取环境变量，启动训练代码
python launch.py --nproc_per_node=8  --script=*.py     
```

DDP demo 代码:
```python
import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torchvision import datasets, transforms
from torch.utils.data import DataLoader, DistributedSampler
from torch.optim import Adam

class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 32, 3, 1)
        self.conv2 = nn.Conv2d(32, 64, 3, 1)
        self.dropout = nn.Dropout(0.25)
        self.fc1 = nn.Linear(9216, 128)
        self.fc2 = nn.Linear(128, 10)

    def forward(self, x):
        x = F.relu(self.conv1(x))
        x = F.relu(self.conv2(x))
        x = F.max_pool2d(x, 2)
        x = self.dropout(x)
        x = torch.flatten(x, 1)
        x = F.relu(self.fc1(x))
        x = self.fc2(x)
        return F.log_softmax(x, dim=1)

def setup():
    dist.init_process_group(backend='nccl')  # or 'gloo' for CPU
    local_rank = int(os.environ["LOCAL_RANK"])
    torch.cuda.set_device(local_rank)
    return torch.device("cuda", local_rank)

def cleanup():
    dist.destroy_process_group()

def main():
    device = setup()

    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,))
    ])

    train_dataset = datasets.MNIST('../data', train=True, download=True, transform=transform)
    train_sampler = DistributedSampler(train_dataset, drop_last=True)
    train_loader = DataLoader(train_dataset, batch_size=64, sampler=train_sampler)

    model = Net().to(device)
    model = DDP(model, device_ids=[device.index])

    optimizer = Adam(model.parameters(), lr=1e-3)

    model.train()
    for epoch in range(1, 5):
        train_sampler.set_epoch(epoch)
        for batch_idx, (data, target) in enumerate(train_loader):
            data, target = data.to(device), target.to(device)

            optimizer.zero_grad()
            output = model(data)
            loss = F.nll_loss(output, target)
            loss.backward()
            optimizer.step()

            if batch_idx % 10 == 0 and dist.get_rank() == 0:
                print(f"Epoch {epoch} [{batch_idx * len(data)}/{len(train_loader.dataset)}] Loss: {loss.item():.6f}")

    dist.barrier()
    if dist.get_rank() == 0:
        torch.save(model.state_dict(), "mnist_ddp_model.pt")
    cleanup()

if __name__ == "__main__":
    main()
```