import type { UploadSpeedSample } from "src/utils/fileUpload/uploadCalculation";

import {
  calculateUploadedBytes,
  calculateUploadSpeed,
  UPLOAD_SPEED_WINDOW_MS,
} from "src/utils/fileUpload/uploadCalculation";

const MIB = 1024 * 1024;

describe("calculateUploadedBytes", () => {
  it("calculates complete chunks", () => {
    expect(calculateUploadedBytes(10 * MIB, 5 * MIB, [0, 1])).toBe(10 * MIB);
  });

  it("uses the remaining file size for the final chunk", () => {
    expect(calculateUploadedBytes(11 * MIB, 5 * MIB, [2])).toBe(1 * MIB);
    expect(calculateUploadedBytes(11 * MIB, 5 * MIB, [0, 2])).toBe(6 * MIB);
  });

  it("deduplicates indices and ignores invalid or out-of-range indices", () => {
    expect(calculateUploadedBytes(11 * MIB, 5 * MIB, [0, 0, -1, 1.5, 3])).toBe(5 * MIB);
  });

  it("returns zero for invalid file or chunk sizes", () => {
    expect(calculateUploadedBytes(0, 5 * MIB, [0])).toBe(0);
    expect(calculateUploadedBytes(10 * MIB, 0, [0])).toBe(0);
  });
});

describe("calculateUploadSpeed", () => {
  it("returns zero until there are at least two samples", () => {
    const result = calculateUploadSpeed([], 0, 0, 0);

    expect(result.bytesPerSecond).toBe(0);
    expect(result.samples).toEqual([{ bytes: 0, time: 0 }]);
  });

  it("calculates confirmed throughput from the rolling window", () => {
    const samples: UploadSpeedSample[] = [
      { bytes: 0, time: 0 },
      { bytes: 1000, time: 1000 },
    ];

    expect(calculateUploadSpeed(samples, 2000, 2000, 2000).bytesPerSecond).toBe(1000);
  });

  it("includes periodic idle samples when concurrent chunks finish together", () => {
    const samples: UploadSpeedSample[] = Array.from({ length: 9 }, (_, index) => ({
      bytes: 0,
      time: (index + 1) * 1000,
    }));
    samples.push({ bytes: 5 * MIB, time: 10000 }, { bytes: 10 * MIB, time: 10001 });

    const result = calculateUploadSpeed(samples, 10 * MIB, 11000, 10001);

    expect(result.bytesPerSecond).toBe(MIB);
  });

  it("returns zero when no bytes have been confirmed for the full window", () => {
    const samples: UploadSpeedSample[] = [
      { bytes: 0, time: 0 },
      { bytes: 1000, time: 1000 },
      { bytes: 1000, time: 5000 },
    ];

    expect(calculateUploadSpeed(samples, 1000, 11000, 1000).bytesPerSecond).toBe(0);
  });

  it("prunes expired samples and never returns a negative speed", () => {
    const samples: UploadSpeedSample[] = [
      { bytes: 3000, time: 0 },
      { bytes: 2000, time: 1000 },
    ];

    const result = calculateUploadSpeed(samples, 1000, UPLOAD_SPEED_WINDOW_MS + 1000, 11000);

    expect(result.bytesPerSecond).toBe(0);
    expect(result.samples.every((sample) => sample.time >= 1000)).toBe(true);
  });
});
