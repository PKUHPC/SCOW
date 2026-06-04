import { createReadStream, existsSync } from "fs";
import { basename, join } from "path";
import { FastifyReply } from "fastify";

import { metaBasePath } from "./paths";

const scowctlBinDir = process.env.SCOWCTL_BIN_DIR ?? "/app/apps/scowctl/build/bin";

function scowctlBasePath(basePath: string) {
  return `${metaBasePath(basePath)}/scowctl`;
}

export function getScowctlPagePath(basePath: string) {
  return scowctlBasePath(basePath);
}

export function getScowctlBinaryPath(basePath: string, binaryName: string) {
  return `${scowctlBasePath(basePath)}/bin/${binaryName}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createScowctlHtml(basePath: string, scowBaseUrl?: string) {
  const installScriptPath = `${scowctlBasePath(basePath)}/install.sh`;
  const powershellInstallScriptPath = `${scowctlBasePath(basePath)}/install.ps1`;
  const x64Path = getScowctlBinaryPath(basePath, "scowctl-x64");
  const arm64Path = getScowctlBinaryPath(basePath, "scowctl-arm64");
  const macosArm64Path = getScowctlBinaryPath(basePath, "scowctl-macos-arm64");
  const windowsX64Path = getScowctlBinaryPath(basePath, "scowctl-windows-x64.exe");
  const displayBaseUrl = scowBaseUrl ?? "<scow base url>";
  const shellInstallCommand = `curl ${displayBaseUrl}${installScriptPath} | sh`;
  const powershellInstallCommand = `iwr ${displayBaseUrl}${powershellInstallScriptPath} -UseB | iex`;
  const loginCommand = `scowctl login ${displayBaseUrl}`;
  const staticAuthLoginCommand = `scowctl login ${displayBaseUrl} --auth-secret <secret> --auth-user <user-id>`;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>scowctl</title>
    <style>
      :root {
        --primary: #2c66d4;
        --text: #1f2937;
        --muted: #6b7280;
        --line: #e5e7eb;
        --panel: #ffffff;
        --code-bg: #f5f7fb;
        --success: #15803d;
      }
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        color: var(--text);
        font-family: Roboto, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.6;
        background:
          linear-gradient(115deg, rgba(44, 102, 212, 0.14), rgba(255, 255, 255, 0.7) 48%, rgba(44, 102, 212, 0.08)),
          #eef3fb;
      }
      .brand {
        position: absolute;
        top: 34px;
        left: 48px;
        color: var(--primary);
        font-size: 26px;
        font-weight: 700;
        letter-spacing: 0;
      }
      .page {
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 104px 32px 64px;
      }
      .panel {
        width: min(100%, 1040px);
        background: var(--panel);
        border-radius: 12px;
        box-shadow: 0 18px 48px rgba(31, 41, 55, 0.12);
        padding: 42px 48px 46px;
      }
      h1, h2, h3, p { margin-top: 0; }
      h1 {
        margin-bottom: 14px;
        font-size: 36px;
        line-height: 1.2;
        letter-spacing: 0;
      }
      h2 {
        margin: 30px 0 12px;
        font-size: 20px;
        line-height: 1.3;
      }
      h3 {
        margin: 0 0 10px;
        font-size: 16px;
        line-height: 1.3;
      }
      .lead {
        max-width: 760px;
        margin-bottom: 0;
        color: var(--muted);
      }
      .summary {
        margin-top: 18px;
        color: #3f4d66;
      }
      .section {
        margin-top: 30px;
        padding-top: 24px;
        border-top: 1px solid var(--line);
      }
      code, pre {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      .command-row {
        display: flex;
        align-items: stretch;
        gap: 10px;
        margin-top: 10px;
      }
      .command-row pre {
        flex: 1;
        min-width: 0;
        margin: 0;
        padding: 13px 16px;
        color: #162033;
        background: var(--code-bg);
        border: 1px solid var(--line);
        border-radius: 8px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .copy-button {
        flex: 0 0 auto;
        min-width: 72px;
        padding: 0 16px;
        border: 1px solid var(--primary);
        border-radius: 8px;
        color: var(--primary);
        background: #ffffff;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .copy-button:hover {
        color: #ffffff;
        background: var(--primary);
      }
      .copy-button.copied {
        border-color: var(--success);
        color: #ffffff;
        background: var(--success);
      }
      a { color: var(--primary); text-decoration: none; }
      a:hover { text-decoration: underline; }
      .downloads {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin: 12px 0 0;
      }
      .download-link {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        padding: 8px 12px;
        border: 1px solid var(--primary);
        border-radius: 8px;
        color: var(--primary);
        font-weight: 600;
      }
      .download-link:hover {
        color: #ffffff;
        background: var(--primary);
        text-decoration: none;
      }
      .feature-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px 28px;
        margin: 16px 0 0;
        padding: 0;
        list-style: none;
      }
      .feature-list li {
        position: relative;
        padding-left: 18px;
        color: #4b5563;
      }
      .feature-list li::before {
        position: absolute;
        left: 0;
        top: 0.72em;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--primary);
        content: "";
      }
      @media (max-width: 960px) {
        .brand {
          position: static;
          padding: 28px 28px 0;
        }
        .page {
          min-height: auto;
          align-items: stretch;
          padding: 40px 24px 48px;
        }
        .panel {
          width: 100%;
          padding: 34px 28px;
        }
        .feature-list {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 560px) {
        .brand {
          padding: 22px 20px 0;
          font-size: 22px;
        }
        .page {
          padding: 28px 16px 36px;
        }
        .panel {
          padding: 28px 20px;
          border-radius: 10px;
        }
        .command-row {
          flex-direction: column;
        }
        .copy-button {
          min-height: 38px;
        }
        .downloads {
          grid-template-columns: 1fr;
        }
        h1 {
          font-size: 30px;
        }
      }
    </style>
  </head>
  <body>
    <div class="brand">SCOW</div>
    <main class="page">
      <section class="panel" aria-labelledby="scowctl-title">
        <h1 id="scowctl-title">scowctl</h1>
        <p class="lead">登录当前 SCOW 实例，查看可用 HTTP API，并以当前用户身份调用 API。</p>
        <p class="summary">面向用户侧的轻量命令行工具，连接当前部署实例后即可发现并调用 HTTP API。</p>

        <section class="section">
          <h2>安装</h2>
          <h3>Linux / macOS</h3>
          <div class="command-row">
            <pre><code>${escapeHtml(shellInstallCommand)}</code></pre>
            <button class="copy-button" type="button">复制</button>
          </div>
          <h3 style="margin-top: 18px;">Windows</h3>
          <div class="command-row">
            <pre><code>${escapeHtml(powershellInstallCommand)}</code></pre>
            <button class="copy-button" type="button">复制</button>
          </div>
        </section>

        <section class="section">
          <h2>登录</h2>
          <div class="command-row">
            <pre><code>${escapeHtml(loginCommand)}</code></pre>
          </div>
          <div class="command-row">
            <pre><code>${escapeHtml(staticAuthLoginCommand)}</code></pre>
          </div>
        </section>

        <section class="section">
          <h2>手动下载</h2>
          <div class="downloads">
            <a class="download-link" href="${x64Path}">Linux x64</a>
            <a class="download-link" href="${arm64Path}">Linux arm64</a>
            <a class="download-link" href="${macosArm64Path}">macOS arm64</a>
            <a class="download-link" href="${windowsX64Path}">Windows x64</a>
          </div>
        </section>

        <section class="section">
          <h2>主要功能</h2>
          <ul class="feature-list">
            <li><code>scowctl login &lt;scow-base-url&gt;</code>：登录 SCOW 并从 meta-server 缓存当前实例的 OpenAPI 定义。</li>
            <li><code>scowctl api list</code>：列出当前实例可用的 HTTP API。</li>
            <li><code>scowctl api help &lt;method&gt; &lt;path&gt;</code>：查看某个 API 可填写的参数。</li>
            <li><code>scowctl api &lt;method&gt; &lt;path&gt; key=value...</code>：调用 SCOW HTTP API。</li>
            <li><code>scowctl api refresh</code>：刷新当前实例的 OpenAPI 缓存。</li>
          </ul>
        </section>
      </section>
    </main>
    <script>
      async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return;
        }

        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.top = "-1000px";
        textArea.style.left = "-1000px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          const copied = document.execCommand("copy");
          if (!copied) {
            throw new Error("copy command failed");
          }
        } finally {
          document.body.removeChild(textArea);
        }
      }

      document.querySelectorAll(".copy-button").forEach((button) => {
        button.addEventListener("click", async () => {
          const command = button.parentElement?.querySelector("code")?.textContent ?? "";
          if (!command) {
            return;
          }

          try {
            await copyText(command);
            button.textContent = "已复制";
            button.classList.add("copied");
            window.setTimeout(() => {
              button.textContent = "复制";
              button.classList.remove("copied");
            }, 1600);
          } catch {
            button.textContent = "复制失败";
            window.setTimeout(() => {
              button.textContent = "复制";
            }, 1600);
          }
        });
      });
    </script>
  </body>
</html>`;
}

export function createScowctlInstallScript(basePath: string, scowBaseUrl: string) {
  const x64Url = `${scowBaseUrl}${getScowctlBinaryPath(basePath, "scowctl-x64")}`;
  const arm64Url = `${scowBaseUrl}${getScowctlBinaryPath(basePath, "scowctl-arm64")}`;
  const macosArm64Url = `${scowBaseUrl}${getScowctlBinaryPath(basePath, "scowctl-macos-arm64")}`;

  return `#!/bin/sh
set -eu

OS="$(uname -s)"
ARCH="$(uname -m)"

case "\${OS}:\${ARCH}" in
  Linux:x86_64|Linux:amd64)
    BINARY_URL="${x64Url}"
    ;;
  Linux:aarch64|Linux:arm64)
    BINARY_URL="${arm64Url}"
    ;;
  Darwin:arm64|Darwin:aarch64)
    BINARY_URL="${macosArm64Url}"
    ;;
  *)
    echo "Unsupported platform: \${OS}/\${ARCH}" >&2
    exit 1
    ;;
esac

INSTALL_DIR="\${SCOWCTL_INSTALL_DIR:-\${HOME}/.local/bin}"
mkdir -p "\${INSTALL_DIR}"

TMP_FILE="$(mktemp)"
trap 'rm -f "\${TMP_FILE}"' EXIT

echo "Downloading scowctl from \${BINARY_URL}"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "\${BINARY_URL}" -o "\${TMP_FILE}"
elif command -v wget >/dev/null 2>&1; then
  wget -q "\${BINARY_URL}" -O "\${TMP_FILE}"
else
  echo "curl or wget is required" >&2
  exit 1
fi

chmod +x "\${TMP_FILE}"
mv "\${TMP_FILE}" "\${INSTALL_DIR}/scowctl"
trap - EXIT

echo "scowctl installed to \${INSTALL_DIR}/scowctl"
case ":\${PATH}:" in
  *":\${INSTALL_DIR}:"*) ;;
  *) echo "Add \${INSTALL_DIR} to PATH before running scowctl." ;;
esac
`;
}

export function createScowctlPowerShellInstallScript(basePath: string, scowBaseUrl: string) {
  const windowsX64Url = `${scowBaseUrl}${getScowctlBinaryPath(basePath, "scowctl-windows-x64.exe")}`;

  return `$ErrorActionPreference = "Stop"

function Install-Scowctl {
  param(
    [string]$InstallDir = "$env:LOCALAPPDATA\\scowctl\\bin"
  )

  $BinaryUrl = "${windowsX64Url}"
  $TargetPath = Join-Path $InstallDir "scowctl.exe"

  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

  Write-Host "Downloading scowctl from $BinaryUrl"
  Invoke-WebRequest -Uri $BinaryUrl -OutFile $TargetPath

  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $Paths = if ([string]::IsNullOrWhiteSpace($UserPath)) { @() } else { $UserPath -split ";" }
  if ($Paths -notcontains $InstallDir) {
    $NewPath = if ([string]::IsNullOrWhiteSpace($UserPath)) { $InstallDir } else { "$UserPath;$InstallDir" }
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    Write-Host "Added $InstallDir to the user PATH. Restart PowerShell before running scowctl from a new shell."
  }

  Write-Host "scowctl installed to $TargetPath"
}

Install-Scowctl
`;
}

export function sendScowctlBinary(reply: FastifyReply, binaryName: string) {
  if (
    binaryName !== "scowctl-x64" &&
    binaryName !== "scowctl-arm64" &&
    binaryName !== "scowctl-macos-arm64" &&
    binaryName !== "scowctl-windows-x64.exe"
  ) {
    return reply.code(404).send();
  }

  const filePath = join(scowctlBinDir, binaryName);
  if (!existsSync(filePath)) {
    return reply.code(404).send();
  }

  return reply
    .type("application/octet-stream")
    .header("Content-Disposition", `attachment; filename="${basename(binaryName)}"`)
    .send(createReadStream(filePath));
}
