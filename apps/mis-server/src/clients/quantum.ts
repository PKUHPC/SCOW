import type { AppRouter } from "@scow/quantum/build/src/server/trpc/router";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { config } from "src/config/env";
import superjson from "superjson";

function getQuantumUrl(): string {

  if (!config.QUANTUM_DEPLOYED) {
    throw new Error("DEPLOYMENT_ERROR: Quantum is not deployed. Please configure QUANTUM_DEPLOYED to true.");
  }

  // 优先使用 QUANTUM_URL，仅本地开发配置
  if (config.QUANTUM_URL) {
    return `http://${config.QUANTUM_URL}/api/trpc`;
  }

  // 生产环境检查 QUANTUM_PATH。
  if (config.QUANTUM_PATH) {
    return `http://quantum:3000/${config.QUANTUM_PATH}/api/trpc`;
  }

  throw new Error("DEVELOPMENT_ERROR: QUANTUM_URL or QUANTUM_PATH is not set. ");
}

// 本地开发地址： http://localhost:5007/api/trpc/
// 生产环境地址： http://quantum:3000/<QUANTUM_BASE_PATH>/api/trpc

export function createQuantumClient(token: string) {

  const quantumUrl = getQuantumUrl();

  return createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: quantumUrl,
        async headers() {
          return {
            "x-scow-api-auth-token": token,
          };
        },
      }),
    ],
  });
}
