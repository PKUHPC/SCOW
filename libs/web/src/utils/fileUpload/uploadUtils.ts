import * as crypto from "crypto";
import { styled } from "styled-components";

export const PercentAndSpeedContainer = styled.div({
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  marginTop: "6px",
  fontSize: "12px",
});

// 格式化速度显示
export const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond <= 0) {
    return "0 B/s";
  }

  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  const k = 1024;

  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  const value = bytesPerSecond / Math.pow(k, i);

  // 根据大小调整小数位数
  const decimals = i === 0 ? 0 : 1;

  return `${value.toFixed(decimals)} ${units[i]}`;
};


export async function calculateBlobSHA256(blob: Blob): Promise<string> {
  try {

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Uint8Array.from(Buffer.from(arrayBuffer));
    const hash = crypto.createHash("sha256");
    hash.update(buffer);
    const hashHex = hash.digest("hex");

    return hashHex;
  } catch (error: any) {

    throw new Error(`Failed to calculate hash: ${error.message}`);
  }
}

