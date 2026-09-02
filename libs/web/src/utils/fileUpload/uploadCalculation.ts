export interface UploadSpeedSample {
  bytes: number;
  time: number;
}

export interface UploadSpeedCalculationResult {
  bytesPerSecond: number;
  samples: UploadSpeedSample[];
}

export const UPLOAD_SPEED_WINDOW_MS = 10000;

export const calculateUploadedBytes = (
  fileSizeByte: number,
  chunkSizeByte: number,
  uploadedIndices: Iterable<number>,
): number => {
  if (fileSizeByte <= 0 || chunkSizeByte <= 0) return 0;

  let uploadedBytes = 0;
  const uniqueIndices = new Set(uploadedIndices);

  uniqueIndices.forEach((index) => {
    if (!Number.isInteger(index) || index < 0) return;

    const chunkStart = index * chunkSizeByte;
    if (chunkStart >= fileSizeByte) return;

    uploadedBytes += Math.min(chunkSizeByte, fileSizeByte - chunkStart);
  });

  return Math.min(uploadedBytes, fileSizeByte);
};

export const calculateUploadSpeed = (
  samples: UploadSpeedSample[],
  currentBytes: number,
  now: number,
  lastProgressTime: number,
  windowMs = UPLOAD_SPEED_WINDOW_MS,
): UploadSpeedCalculationResult => {
  const windowStart = now - windowMs;
  const recentSamples = [...samples, { bytes: currentBytes, time: now }].filter((sample) => sample.time >= windowStart);

  if (recentSamples.length < 2 || now - lastProgressTime >= windowMs) {
    return { bytesPerSecond: 0, samples: recentSamples };
  }

  const firstSample = recentSamples[0];
  const lastSample = recentSamples[recentSamples.length - 1];
  const timeDiffSeconds = (lastSample.time - firstSample.time) / 1000;
  const bytesDiff = lastSample.bytes - firstSample.bytes;

  return {
    bytesPerSecond: timeDiffSeconds > 0 ? Math.max(0, bytesDiff / timeDiffSeconds) : 0,
    samples: recentSamples,
  };
};
