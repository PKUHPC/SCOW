import { spawn, spawnSync } from "child_process";
import { EventEmitter } from "events";
import { existsSync, rmSync } from "fs";
import { runComposeCommand } from "src/compose/cmd";
import { readEnabledPlugins } from "src/plugin";

jest.mock("child_process", () => ({
  spawn: jest.fn(),
  spawnSync: jest.fn(),
}));

jest.mock("src/compose", () => ({
  createComposeSpec: jest.fn(() => ({ services: {} })),
}));

jest.mock("src/plugin", () => ({
  readEnabledPlugins: jest.fn(),
}));

const filename = "docker-compose-123.yml";
const stdinIsTTY = process.stdin.isTTY;

const setupComposeCommand = () => {
  const child = new EventEmitter() as EventEmitter & { kill: jest.Mock };
  child.kill = jest.fn();

  (spawnSync as jest.Mock).mockReturnValue({ status: 0 });
  (spawn as jest.Mock).mockReturnValue(child);
  (readEnabledPlugins as jest.Mock).mockResolvedValue([]);
  jest.spyOn(Date, "now").mockReturnValue(123);

  return child;
};

afterEach(() => {
  jest.useRealTimers();
  rmSync(filename, { force: true });
  process.exitCode = undefined;
  Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: stdinIsTTY });
  jest.restoreAllMocks();
});

it("removes temporary compose file after compose command exits", async () => {
  const child = setupComposeCommand();

  const command = runComposeCommand({} as any, ["logs", "portal-web"]);

  await Promise.resolve();
  expect(existsSync(filename)).toBe(true);

  child.emit("exit", 0, null);
  await command;

  expect(existsSync(filename)).toBe(false);
});

it("removes temporary compose file on terminal SIGINT without exiting before compose", async () => {
  const child = setupComposeCommand();
  const exit = jest.spyOn(process, "exit").mockImplementation(((code?: string | number | null) => {
    throw new Error(`exit ${code}`);
  }) as typeof process.exit);
  Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });

  const command = runComposeCommand({} as any, ["logs", "-f", "portal-web"]);

  await Promise.resolve();
  expect(existsSync(filename)).toBe(true);

  process.emit("SIGINT");

  expect(existsSync(filename)).toBe(false);
  expect(child.kill).not.toHaveBeenCalled();
  expect(exit).not.toHaveBeenCalled();

  child.emit("exit", null, "SIGINT");
  await command;

  expect(process.exitCode).toBe(130);
});

it("removes temporary compose file on SIGQUIT", async () => {
  const child = setupComposeCommand();
  Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });

  const command = runComposeCommand({} as any, ["logs", "-f", "portal-web"]);

  await Promise.resolve();
  expect(existsSync(filename)).toBe(true);

  process.emit("SIGQUIT");

  expect(existsSync(filename)).toBe(false);
  expect(child.kill).not.toHaveBeenCalled();

  child.emit("exit", null, "SIGQUIT");
  await command;

  expect(process.exitCode).toBe(131);
});

it("forces exit when compose command does not exit after signal", async () => {
  jest.useFakeTimers();
  const child = setupComposeCommand();
  const exit = jest.spyOn(process, "exit").mockImplementation(((code?: string | number | null) => {
    throw new Error(`exit ${code}`);
  }) as typeof process.exit);

  const command = runComposeCommand({} as any, ["logs", "-f", "portal-web"]);

  await Promise.resolve();
  process.emit("SIGTERM");

  expect(child.kill).toHaveBeenCalledWith("SIGTERM");

  jest.advanceTimersByTime(9_999);
  expect(exit).not.toHaveBeenCalled();

  expect(() => jest.advanceTimersByTime(1)).toThrow("exit 143");

  expect(child.kill).toHaveBeenLastCalledWith("SIGKILL");
  expect(exit).toHaveBeenCalledWith(143);

  child.emit("exit", null, "SIGTERM");
  await command;
});
