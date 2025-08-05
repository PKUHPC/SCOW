import net from "net";

export async function isPortReachable(port: number, host: string, timeout: number = 1000): Promise<boolean> {
  if (typeof host !== "string") {
    throw new TypeError("Specify a `host`");
  }

  const promise = new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();

    const onError = (error: Error) => {
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(timeout);
    socket.once("error", onError);
    socket.once("timeout", onError);

    socket.connect(port, host, () => {
      socket.end();
      resolve();
    });
  });

  try {
    await promise;
    return true;
  } catch {
    return false;
  }
}
