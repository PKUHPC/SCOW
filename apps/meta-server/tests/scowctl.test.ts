import {
  createScowctlHtml,
  createScowctlInstallScript,
  createScowctlPowerShellInstallScript,
  getScowctlBinaryPath,
  getScowctlPagePath,
} from "src/scowctl";

it("creates scowctl page paths with base path", () => {
  expect(getScowctlPagePath("/scow")).toBe("/scow/meta/scowctl");
  expect(getScowctlPagePath("/")).toBe("/meta/scowctl");
});

it("creates scowctl binary paths with base path", () => {
  expect(getScowctlBinaryPath("/scow", "scowctl-x64")).toBe("/scow/meta/scowctl/bin/scowctl-x64");
  expect(getScowctlBinaryPath("/", "scowctl-arm64")).toBe("/meta/scowctl/bin/scowctl-arm64");
  expect(getScowctlBinaryPath("/scow", "scowctl-windows-x64.exe")).toBe(
    "/scow/meta/scowctl/bin/scowctl-windows-x64.exe",
  );
});

it("renders scowctl page with install command and binary links", () => {
  const html = createScowctlHtml("/scow", "https://scow.example.com");

  expect(html).toContain("/scow/meta/scowctl/install.sh");
  expect(html).toContain("/scow/meta/scowctl/install.ps1");
  expect(html).toContain("curl https://scow.example.com/scow/meta/scowctl/install.sh | sh");
  expect(html).toContain("iwr https://scow.example.com/scow/meta/scowctl/install.ps1 -UseB | iex");
  expect(html).toContain("scowctl login https://scow.example.com");
  expect(html).toContain("scowctl login https://scow.example.com --auth-secret &lt;secret&gt; --auth-user &lt;user-id&gt;");
  expect(html).toContain('<div class="brand">SCOW</div>');
  expect(html).toContain("面向用户侧的轻量命令行工具");
  expect(html).toContain('<button class="copy-button" type="button">复制</button>');
  expect(html).toContain("navigator.clipboard && window.isSecureContext");
  expect(html).toContain('document.execCommand("copy")');
  expect(html).toContain("white-space: pre-wrap");
  expect(html).not.toContain('<aside class="intro">');
  expect(html).toContain('class="download-link" href="/scow/meta/scowctl/bin/scowctl-x64"');
  expect(html).toContain("/scow/meta/scowctl/bin/scowctl-x64");
  expect(html).toContain("/scow/meta/scowctl/bin/scowctl-arm64");
  expect(html).toContain("/scow/meta/scowctl/bin/scowctl-windows-x64.exe");
  expect(html).toContain("scowctl api list");
});

it("creates install script using metadata scowctl binary paths", () => {
  const script = createScowctlInstallScript("/scow", "https://scow.example.com");

  expect(script).toContain("https://scow.example.com/scow/meta/scowctl/bin/scowctl-x64");
  expect(script).toContain("https://scow.example.com/scow/meta/scowctl/bin/scowctl-arm64");
  expect(script).not.toContain("BASE_URL=");
  expect(script).toContain('SCOWCTL_INSTALL_DIR:-${HOME}/.local/bin');
});

it("creates powershell install script using metadata scowctl binary path", () => {
  const script = createScowctlPowerShellInstallScript("/scow", "https://scow.example.com");

  expect(script).toContain("https://scow.example.com/scow/meta/scowctl/bin/scowctl-windows-x64.exe");
  expect(script).toContain("function Install-Scowctl");
  expect(script).toContain("Install-Scowctl");
  expect(script).not.toContain("$BaseUrl");
  expect(script).toContain("$env:LOCALAPPDATA\\scowctl\\bin");
});
