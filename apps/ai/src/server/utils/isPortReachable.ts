import crypto from "crypto";
import http from "http";
import { NextApiRequest } from "next";
import { join } from "path";
import { BASE_PATH } from "src/utils/processEnv";

/**
 * 检查端口是否可通过URL访问
 * @param req Next.js API请求对象
 * @param timeout 超时时间（毫秒）
 * @param clusterId 集群ID
 * @param host 主机地址
 * @param port 端口号
 * @param appType 应用类型：web或vnc
 * @param proxyType 代理类型：relative、absolute或undefined
 * @returns Promise<boolean> 端口是否可达
 */
export async function isPortReachableThroughUrl(
  req: NextApiRequest,
  timeout: number,
  clusterId: string,
  host: string,
  port: number,
  appType: "web" | "vnc",
  proxyType: "relative" | "absolute" | undefined,
): Promise<boolean> {
  if (typeof host !== "string") {
    throw new TypeError("Specify a `host`");
  }

  const urlBase = `http://localhost:${process.env.PORT ?? 3000}`;

  if (appType === "web") {
    return checkWebAppReachability(req, timeout, clusterId, host, port, proxyType, urlBase);
  } else {
    return checkVncAppReachability(req, timeout, clusterId, host, port, urlBase);
  }
}

/**
 * 检查Web应用端口可达性
 */
async function checkWebAppReachability(
  req: NextApiRequest,
  timeout: number,
  clusterId: string,
  host: string,
  port: number,
  proxyType: "relative" | "absolute" | undefined,
  urlBase: string,
): Promise<boolean> {
  if (typeof proxyType !== "string") {
    throw new TypeError("Specify a `proxyType` in web app");
  }

  const controller = new AbortController();
  const { signal } = controller;

  // 设置超时
  const timeoutId = setTimeout(() => {
    if (!signal.aborted) {
      controller.abort();
    }
  }, timeout);

  try {
    const webPath = join(BASE_PATH, "/api/proxy", clusterId, proxyType, host, String(port));
    const checkUrl = new URL(webPath, urlBase);

    let res: Response;
    try {
      res = await fetch(checkUrl, {
        headers: {
          "Cookie": req.headers.cookie || "",
        },
        redirect: "manual",
        signal,
      });
    } catch (err) {
      // 如果fetch请求被中止,推测为网关报错
      // 实际测试时 不配置代理网关的情况，指定错误节点时会出现此报错
      if (err instanceof DOMException && err.name === "AbortError") {
        res = new Response(null, { status: 502 });
      } else {
        throw err;
      }
    }

    if (res.status === 502) {
      console.log(`Web app connection failed during connecting to ${host}:${port}`);
      return false;
    } else {
      // res.status !== 502的情况，认为端口已经开放
      console.log(`Web app is successfully connected to ${host}:${port} with statusCode: ${res.status}`);
      return true;
    }
  } catch (error) {
    console.log(`Error in web app connection during connecting to ${host}:${port}:`, error);
    return false;
  } finally {
    clearTimeout(timeoutId);
    if (!signal.aborted) {
      controller.abort();
    }
  }
}

/**
 * 检查VNC应用端口可达性
 */
function checkVncAppReachability(
  req: NextApiRequest,
  timeout: number,
  clusterId: string,
  host: string,
  port: number,
  urlBase: string,
): Promise<boolean> {
  // vnc的proxyType指定为absolute
  const vncPath = join(BASE_PATH, "/api/proxy", clusterId, "absolute", host, String(port));
  const checkUrl = new URL(vncPath, urlBase);

  const headerOption = {
    "Sec-WebSocket-Key": crypto.randomBytes(16).toString("base64"),
    "Sec-WebSocket-Version": 13,
    "Connection": "Upgrade",
    "Upgrade": "websocket",
    "Cookie": req.headers.cookie,
    "Host": `localhost:${process.env.PORT ?? 3000}`,
    "Origin": `http://localhost:${process.env.PORT ?? 3000}`,
  };

  return new Promise((resolve) => {
    let isResolved = false;
    let request: http.ClientRequest | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (request && !request.destroyed) {
        request.destroy();
        request = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const safeResolve = (value: boolean) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(value);
      }
    };

    try {
      request = http.get(checkUrl, { headers: headerOption });

      // 设置超时
      timeoutId = setTimeout(() => {
        console.log(`Timeout during vnc app connecting to ${host}:${port}`);
        safeResolve(false);
      }, timeout);

      request.on("upgrade", () => {
        console.log(`Vnc app successfully connected to ${host}:${port}`);
        safeResolve(true);
      });

      request.on("response", (res) => {
        console.log(
          `Vnc app connection failed during connecting to ${host}:${port} with statusCode: ${res.statusCode}`,
        );
        safeResolve(false);
      });

      request.on("error", (error) => {
        console.log(`Vnc app connection failed during connecting to ${host}:${port}`, error);
        safeResolve(false);
      });

      request.on("close", () => {
        // 请求已关闭，如果还没有resolve，说明连接异常关闭
        if (!isResolved) {
          console.log(`Vnc app connection closed unexpectedly for ${host}:${port}`);
          safeResolve(false);
        }
      });
    } catch (error) {
      console.log(`Error creating vnc request for ${host}:${port}:`, error);
      safeResolve(false);
    }
  });
}
