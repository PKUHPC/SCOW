# 推理启动命令示例

本文只说明单机推理和多机推理需要使用的镜像、启动命令，以及命令参数含义。完整多机 YAML 示例见 [multi-node-inference.yaml](./multi-node-inference.yaml)。

## 单机推理

镜像：

```text
ghcr.io/volcano-sh/vllm-openai:v0.10.0-cu128-nixl-v0.4.1-lmcache-0.3.2
```

启动命令：

```bash
python3 -m vllm.entrypoints.openai.api_server \
  --host 0.0.0.0 \
  --port 8000 \
  --model /models/Qwen3-8B \
  --served-model-name Qwen/Qwen3-8B \
  --tensor-parallel-size 1 \
  --gpu-memory-utilization 0.9 \
  --max-model-len 2048 \
  --trust-remote-code
```

参数说明：

- `--host`：服务监听地址，`0.0.0.0` 表示监听容器内所有网卡。
- `--port`：OpenAI API Server 监听端口，需要和容器端口、Service 端口保持一致。
- `--model`：容器内模型路径。
- `--served-model-name`：对外暴露的模型名称，客户端请求时使用这个名称。
- `--tensor-parallel-size`：张量并行数量，通常等于单个 Pod 内使用的 GPU/NPU 数量。
- `--gpu-memory-utilization`：单卡显存使用比例。
- `--max-model-len`：模型最大上下文长度。
- `--trust-remote-code`：允许加载模型仓库中的自定义代码。

## 多机推理

镜像：

```text
ghcr.io/volcano-sh/vllm-openai:v0.10.0-cu128-nixl-v0.4.1-lmcache-0.3.2
```

启动命令：

```bash
python3 -m vllm.entrypoints.openai.api_server \
  --host 0.0.0.0 \
  --port 8000 \
  --model /models/Qwen3-8B \
  --served-model-name Qwen/Qwen3-8B \
  --tensor-parallel-size 1 \
  --pipeline-parallel-size 2 \
  --distributed-executor-backend ray \
  --gpu-memory-utilization 0.9 \
  --max-model-len 4096 \
  --trust-remote-code
```

参数说明：

- `--pipeline-parallel-size`：流水线并行数量，通常等于参与推理的节点数。
- `--distributed-executor-backend ray`：使用 Ray 作为 vLLM 分布式执行后端。
- 其他 vLLM 参数含义与单机推理一致。

## 验证推理服务

假设服务地址为：

```text
http://<NodeIP>:<NodePort>
```

查看模型列表：

```bash
curl http://<NodeIP>:<NodePort>/v1/models
```

发送 Chat Completions 请求：

```bash
curl http://<NodeIP>:<NodePort>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3-8B",
    "messages": [
      {
        "role": "user",
        "content": "你好，请简单介绍一下你自己。"
      }
    ],
    "max_tokens": 128,
    "temperature": 0.7
  }'
```

参数说明：

- `model`：请求的模型名称，需要和启动命令中的 `--served-model-name` 一致。
- `messages`：对话消息列表。
- `max_tokens`：本次请求最多生成的 token 数。
- `temperature`：采样温度，值越高输出越随机。
