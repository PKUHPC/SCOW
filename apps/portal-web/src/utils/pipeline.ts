import { createWriterExtensions } from "@ddadaal/tsgrpc-common";
import { ObjectWritable } from "@grpc/grpc-js/build/src/object-stream";

export async function pipeline<TSource, TTarget>(
  source: AsyncIterable<TSource>,
  transform: (source: TSource) => TTarget | undefined | Promise<TTarget | undefined>,
  target: ObjectWritable<TTarget>,
  options?: { signal: AbortSignal },
) {
  const { writeAsync } = createWriterExtensions(target);

  if (options?.signal.aborted) {
    return;
  }

  for await (const s of source) {
    if (options?.signal.aborted) {
      break;
    }
    const object = await transform(s);
    if (object) {
      await writeAsync(object);
    }
  }
}
