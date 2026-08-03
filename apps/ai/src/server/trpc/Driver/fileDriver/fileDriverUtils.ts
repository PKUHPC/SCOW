import { contentType } from "mime-types";
import { basename } from "path";
import { Readable } from "stream";

export function readableStreamToNodeReadable(readableStream: ReadableStream<Uint8Array>) {
  const nodeReadable = new Readable();
  nodeReadable._read = () => {};

  const reader = readableStream.getReader();

  reader.read().then(function processText({ done, value }) {
    if (done) {
      nodeReadable.push(null);
      return;
    }
    nodeReadable.push(Buffer.from(value));
    reader.read().then(processText);
  });

  return nodeReadable;
}

const textFiles = ["application/x-sh"];

export function getContentType(filename: string, defaultValue: string) {
  const type = contentType(basename(filename));

  if (!type) {
    return defaultValue;
  }

  if (textFiles.some((x) => type.startsWith(x))) {
    return "text/plain; charset=utf-8";
  }

  return type;
}
