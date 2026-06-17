import crypto from "crypto";
import { getDesktopConfig } from "src/utils/desktops";
import { v4 as uuidv4 } from "uuid";

type UriArgs = Record<string, string | undefined>;

export function encryptAES(data: string, appSecretEnc: string): string {
  const secretKey: Buffer = Buffer.from(appSecretEnc, "base64");
  if (secretKey.length !== 32) {
    throw new Error("AppSecret is invalid (must be 32 bytes after decoding)");
  }
  const iv: Buffer = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-256-cfb", secretKey, iv);
  let encrypted: string = cipher.update(data, "utf8", "binary");
  encrypted += cipher.final("binary");

  const encryptedWithIV: Buffer = Buffer.concat([
    iv,
    Buffer.from(encrypted, "binary"),
  ]);
  return encryptedWithIV.toString("base64");
}

export function sign(
  timestamp: number,
  requestId: string,
  appId: string,
  appSecret: string,
  uriArgs: UriArgs = {}
): string {
  const combinedMap: UriArgs = { ...uriArgs };

  if (timestamp != 0) {
    combinedMap.timestamp = timestamp.toString();
  }
  if (appId && appId.length > 0) {
    combinedMap.appId = appId;
  }
  if (requestId && requestId.length > 0) {
    combinedMap.requestId = requestId;
  }

  if (Object.keys(combinedMap).length === 0) {
    throw new Error("Invalid arguments");
  }

  const keys: string[] = Object.keys(combinedMap).sort();
  let signStr: string = keys
    .map((key) => `${key}=${combinedMap[key]}`)
    .join("&");
  signStr += `&appSecret=${appSecret}`;

  return encryptAES(signStr, appSecret);
}

export async function getShadowDeskList(
  cluster: string,
  shadowDeskConfig: ReturnType<
    typeof getDesktopConfig
  >["shadowDesk"] = getDesktopConfig(cluster).shadowDesk
) {
  const timestamp = Math.floor(Date.now() / 1000);
  const requestId = uuidv4();
  const {
    appId = "",
    appSecret = "",
    proxyServer = "",
  } = shadowDeskConfig || {};
  const shadowDeskSign = sign(timestamp, requestId, appId, appSecret, {
    page: "1",
    size: "100",
  });
  const response = await fetch(`http://${proxyServer}/shadowdesk/desk/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      timestamp: String(timestamp),
      sign: shadowDeskSign,
      appId: appId,
      requestId: requestId,
    },
    body: JSON.stringify({
      page: 1,
      size: 100,
    }),
  });
  return response;
}

export async function deleteShadowDesk(
  cluster: string,
  desktopName: string
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000);
  const requestId = uuidv4();
  const {
    appId = "",
    appSecret = "",
    proxyServer = "",
  } = getDesktopConfig(cluster).shadowDesk || {};
  const shadowDeskSign = sign(timestamp, requestId, appId, appSecret, {
    desktop_name: desktopName,
  });
  return await fetch(`http://${proxyServer}/shadowdesk/desk/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      timestamp: String(timestamp),
      sign: shadowDeskSign,
      appId: appId,
      requestId: requestId,
    },
    body: JSON.stringify({
      desktop_name: desktopName,
    }),
  });
}

/**
 * create shadowDesk
 * @param node 创建的远程桌面的节点IP
 * @param username 创建的桌面系统用户名
 * @param desktopName 创建的远程桌面名称（需要保证全局唯一）
 * @param desktopSettings 远程桌面设置（可选），需要确保是一个json字符串，可以指定desktop_type、resolution等。
 * desktop_type支持：gnome/kde/xfce/lxde/lxqt/mate/cinnamon
 */

export async function createShadowDesk(
  cluster: string,
  node: string,
  username: string,
  desktopName: string,
  wm?: string
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000);
  const requestId = uuidv4();
  const {
    appId = "",
    appSecret = "",
    proxyServer = "",
  } = getDesktopConfig(cluster).shadowDesk || {};
  const shadowDeskSign = sign(timestamp, requestId, appId, appSecret, {
    desktop_name: desktopName,
    desktop_settings: JSON.stringify({ desktop_type: wm }),
    node,
    username,
  });
  return await fetch(`http://${proxyServer}/shadowdesk/desk/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      timestamp: String(timestamp),
      sign: shadowDeskSign,
      appId: appId,
      requestId: requestId,
    },
    body: JSON.stringify({
      desktop_name: desktopName,
      desktop_settings: JSON.stringify({ desktop_type: wm }),
      node,
      username,
    }),
  });
}

export async function connectToShadowDesk(
  cluster: string,
  desktopName: string
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000);
  const requestId = uuidv4();
  const {
    appId = "",
    appSecret = "",
    proxyServer = "",
  } = getDesktopConfig(cluster).shadowDesk || {};
  const shadowDeskSign = sign(timestamp, requestId, appId, appSecret, {
    desktop_name: desktopName,
  });
  return await fetch(`http://${proxyServer}/shadowdesk/desk/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      timestamp: String(timestamp),
      sign: shadowDeskSign,
      appId: appId,
      requestId: requestId,
    },
    body: JSON.stringify({
      desktop_name: desktopName,
    }),
  });
}

export async function getShadowDeskStatus(
  cluster: string,
  desktopName: string
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000);
  const requestId = uuidv4();
  const {
    appId = "",
    appSecret = "",
    proxyServer = "",
  } = getDesktopConfig(cluster).shadowDesk || {};
  const shadowDeskSign = sign(timestamp, requestId, appId, appSecret, {
    desktop_name: desktopName,
  });
  return await fetch(`http://${proxyServer}/shadowdesk/desk/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      timestamp: String(timestamp),
      sign: shadowDeskSign,
      appId: appId,
      requestId: requestId,
    },
    body: JSON.stringify({
      desktop_name: desktopName,
    }),
  });
}
