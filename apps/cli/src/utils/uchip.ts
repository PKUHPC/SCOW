import { chmodSync, existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { logger } from "src/log";

export function prepareUchipHostDirAndPragmaFiles(hostUChipPath: string) {

  // 1. 确保宿主机上的 uchip 目标目录存在
  try {
    if (!existsSync(hostUChipPath)) {
      mkdirSync(hostUChipPath, { recursive: true });
      logger.debug(`Created host directory for qobody uchip: ${hostUChipPath}`);
    }
    // 确保目录权限允许写入 (可选)
    chmodSync(hostUChipPath, 0o755);
  } catch (error) {
    logger.error(`Failed to prepare uchip host directory at ${hostUChipPath}:`, error);
    // 如果目录创建失败，应抛出错误终止安装流程
    throw new Error(`Critical: Could not prepare host directory ${hostUChipPath} for qobody.`);
  }

  // 2. 定义并写入 .pragma 文件
  const filesToWrite = [
    {
      name: "t12.pragma",
      content: "#pragma qubits.mapping [[0,11],[1,0],[2,2],[3,1],"
        + "[4,12],[5,10],[6,3],[7,4],[8,6],[9,8],[10,9],[11,5]]",
    },
    {
      name: "t12v5.pragma",
      content: "#pragma qubits.mapping [[0,0],[1,2],[2,1],[3,5],[4,3]]",
    },
    {
      name: "t12v7.pragma",
      content: "#pragma qubits.mapping [[0,1],[1,4],[2,2],[3,0],[4,5],[5,3],[6,6]]",
    },
    {
      name: "t57.pragma",
      content: "#pragma qubits.mapping [[0,50],[1,40],[2,30],[3,20],[4,10],[5,0],"
        + "[6,5],[7,15],[8,25],[9,35],[10,45],[11,55],[12,51],[13,41],[14,31],[15,21]"
        + ",[16,11],[17,1],[18,6],[19,16],[20,26],[21,36],[22,46],[23,56],[24,52],"
        + "[25,42],[26,32],[27,22],[28,12],[29,2],[30,7],[31,17],[32,27],[33,37],"
        + "[34,47],[35,57],[36,53],[37,43],[38,33],[39,23],[40,13],[41,3],[42,8],"
        + "[43,18],[44,28],[45,38],[46,58],[47,54],[48,44],[49,34],[50,24],[51,14]," +
        "[52,4],[53,9],[54,29],[55,39],[56,49]]",
    },
    {
      name: "t57v14s2.pragma",
      content: "#pragma qubits.mapping [[0,4],[1,9],[2,0],[3,5],[4,10],[5,1],[6,6],"
        + "[7,11],[8,2],[9,7],[10,12],[11,3],[12,8],[13,13]]",
    },
    {
      name: "t57v13s4.pragma",
      content: "#pragma qubits.mapping [[0,5],[1,10],[2,0],[3,6],[4,11],[5,1],[6,7],"
        + "[7,12],[8,2],[9,8],[10,13],[11,9],[12,4]]",
    },
    {
      name: "t57v15s3.pragma",
      content: "#pragma qubits.mapping [[0,10],[1,0],[2,5],[3,11],[4,1],[5,6],[6,12],"
        + "[7,2],[8,7],[9,13],[10,3],[11,8],[12,14],[13,4],[14,9]]",
    },
    {
      name: "t57v15s1.pragma",
      content: "#pragma qubits.mapping [[0,10],[1,0],[2,5],[3,11],[4,1],[5,6],[6,12],"
        + "[7,2],[8,7],[9,13],[10,3],[11,8],[12,14],[13,4],[14,9]]",
    },
  ];

  for (const file of filesToWrite) {
    try {
      const filePath = path.join(hostUChipPath, file.name);
      writeFileSync(filePath, file.content, "utf-8");
      logger.debug(`Wrote ${file.name} to ${filePath}`);
    } catch (error) {
      logger.error(`Failed to write pragma file ${file.name}:`, error);
      throw new Error(`Critical: Could not write pragma file ${file.name}.`);
    }
  }
}
