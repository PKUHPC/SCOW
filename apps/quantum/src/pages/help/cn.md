## 1. SDK快速入门

用户需要认证Token才能访问 QPU 和云端托管的模拟器。

### 1.1 使用Token

在本页开头部分获取token。获取到Token后，通过`set_token`命令设置Token：

```python
from tensorcircuit.cloud import apis
apis.set_token("your token got from website")
``` 

**注意**：

1.一旦设置Token后，它将保存在集群的公共存储上，因此只需在第一次在集群中运行程序时执行此步骤。
2.后续示例都假定已从 `tensorcircuit.cloud` 导入了 `apis` 库。


### 1.2 验证安装

通过使用 TensorCircuit 模拟器的本地副本进行量子电路模拟，验证安装是否正确完成：
```python
import tensorcircuit as tc
c = tc.Circuit(2)
c.h(0)
c.cx(0, 1)
c.draw(idle_wires=False)
``` 
如果安装正确，应显示以下两量子比特电路（由单个Hadamard和单个 CNOT 门组成）：

![两量子比特电路]({{BASE_PATH}}/markdown/circuit.svg)

**注意**

1.在接下来的内容中，所有 Python 代码片段都假定已将 TensorCircuit 作为 tc 导入。

### 1.3 查找设备列表

查找所有当前可用设备的完整列表。

```python
from tensorcircuit.cloud import apis
apis.list_devices(state = "on")
``` 

### 1.4 提交作业

可以通过 submit_task 命令将任务提交给量子云平台的 QPU。在以下示例中，我们将上述量子电路，进行了 1024 次测量。

``` python
t = apis.submit_task(
    provider="qobody", 
    device="qobody::t12", 
    circuit=c,
    shots=1024
)
```

**注意**

1.提交任务后，可以使用```t.details()``` 命令访问与任务相关的详细信息。


2.通过```t.results()```查看最终结果。 

### 1.5 在云端模拟器上运行程序

量子云托管了TensorCircuit基于张量网络的模拟器。要在这个模拟器上运行之前的量子程序，只需在提交任务时将设备名称更改为"simulator:tc":

``` python
c = tc.Circuit(2)
c.h(0)
c.cx(0,1)
t = apis.submit_task(provider="qobody",
  device="simulator:tc",
  circuit=c,
  shots=1024)
```
 
### 1.6 批处理任务提交

多个量子电路可以作为批处理提交，只需将电路列表传递给submit_task，如下所示:

``` python
c1 = tc.Circuit(2)
c1.h(0)
c2 = tc.Circuit(2)
c2.h(1)
ts = apis.submit_task(device="t12",
  circuit=[c1, c2],
  shots =1024
)
for t in ts:
  print(t.results())
```

 **注意**

目前支持的最大批处理大小为64。

### 1.7 可视化输出

可以使用plot_histograms命令以图形方式显示从t.results()中获得的测量统计信息，如下所示。

``` python
c = tc.Circuit(2)
c.h(0)
c.cx(0,1)
t = apis.submit_task(provider="qobody",
  device="t12",
  circuit=c,
  shots=1024)

counts = t.results()
tc.results.counts.plot_histogram(counts)
```
它的输出类似于

![plot_histogram图像示意1]({{BASE_PATH}}/markdown/plotHistogram.png)

请注意，由于门和测量误差，得到的值将与理想值略有不同。可以通过使用量子误差缓解技术来减少这些错误。


通过将任务结果作为列表传递，多个实验结果(例如批量提交)可以显示在同一图形上。例如，对于三个电路c1, c2, c3:
``` python
ts = apis.submit_task(device="t12",
  circuit=[c1, c2, c3],
  shots=1024)

counts_list = [t.results() for t in ts]
tc.results.counts.plot_histogram(counts_list)
```

![plot_histogram图像示意2]({{BASE_PATH}}/markdown/plotHistogram2.png)

### 1.8 设置供应商和本地设备

为了进行测试和调试，TensorCircuit SDK配备了本地提供程序（“local”）和本地设备（“testing”），它们的行为就像云设备一样，但是运行在用户的本地计算机上。可以通过以下方式使用：

首先设置提供程序： `apis.set_provider("local")`

然后运行

``` python
t = apis.submit_task(circuit=c,
  device="testing",
  shots=1024,
)
```

或者，提供程序可以直接作为submit_task的参数传递：

``` python
t = apis.submit_task(circuit=c,
    provider="local",
    device="testing",
    shots=1024,
  )
```

可以通过以下方式查询当前设置的提供程序： `apis.get_provider()`

如果想切换回云量子设备，可以设置 `apis.set_provider("qobody")`
