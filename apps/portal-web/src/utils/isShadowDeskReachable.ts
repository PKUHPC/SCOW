/**
 * 检查ShadowDesk应用是否准备就绪
 *
 * @param id - 请求中使用的ID
 * @param timeout - 每个请求的超时时间（毫秒）
 * @returns 返回一个 Promise，当检查完成时会解析为 boolean
 */

export async function isShadowDeskReachable(id: string,proxyServer: string, timeout: number = 1000,
  connectPath: string): Promise<boolean> {

  if (typeof id !== "string" || id === "") {
    throw new TypeError("Specify a `id`");
  }

  // 带超时的 fetch 请求
  const fetchWithTimeout = async (url: string, timeout: number): Promise<Response> => {

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  try {
    const path = connectPath?.split("/")?.[1];
    const url =
     `http://${proxyServer}/${path}/checkConnectivity?id=${id}`;
    const response = await fetchWithTimeout(url, timeout);
    if (response.ok) {
      const result = await response.json();
      if (result.ok) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  } catch {
    return false;
  }
}
