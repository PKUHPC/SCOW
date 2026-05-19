import { Logger } from "@ddadaal/tsgrpc-server";
import { DateMessage } from "@scow/protos/build/google/type/date";
import dayjs from "dayjs";
import { convertToDateMessage, dayjsToDateMessage, isValidTimezone } from "src/date";

const mockLogger = {
  error: jest.fn(),
};

it("returns a DateMessage for valid date string", () => {
  const dateStr = "2021-12-31";
  const result = convertToDateMessage(dateStr, mockLogger as unknown as Logger);
  expect(result).toEqual(DateMessage.create({ year: 2021, month: 12, day: 31 }));
});

it("returns undefined for invalid date format", () => {
  const dateStr = "2021-12-31-01";
  const result = convertToDateMessage(dateStr, mockLogger as unknown as Logger);
  expect(result).toBeUndefined();
  expect(mockLogger.error).toHaveBeenCalledWith(`Invalid date format: ${dateStr}`);
});

it("returns undefined for invalid date", () => {
  const dateStr = "2021-02-30";
  const result = convertToDateMessage(dateStr, mockLogger as unknown as Logger);
  expect(result).toBeUndefined();
  expect(mockLogger.error).toHaveBeenCalledWith(`Invalid date in: ${dateStr}`);
});

describe("isValidTimezone", () => {
  it('should return true for valid UTC offset "+08:00"', () => {
    expect(isValidTimezone("+08:00")).toBe(true);
  });

  it('should return true for valid UTC offset "-05:00"', () => {
    expect(isValidTimezone("-05:00")).toBe(true);
  });

  it('should return false for invalid UTC offset "+25:00"', () => {
    expect(isValidTimezone("+25:00")).toBe(false);
  });

  it('should return true for valid timezone name "Asia/Shanghai"', () => {
    expect(isValidTimezone("Asia/Shanghai")).toBe(true);
  });

  it('should return true for valid timezone name "Europe/Paris"', () => {
    expect(isValidTimezone("Europe/Paris")).toBe(true);
  });

  it('should return false for invalid timezone name "Invalid/Timezone"', () => {
    expect(isValidTimezone("Invalid/Timezone")).toBe(false);
  });

  it("should return true for UTC", () => {
    expect(isValidTimezone("UTC")).toBe(true);
  });
});

describe("dayjsToDateMessage", () => {
  it("should convert Dayjs object to DateMessage correctly", () => {
    const date = dayjs(new Date(2024, 0, 15));
    const result = dayjsToDateMessage(date);
    expect(result).toEqual({ year: 2024, month: 1, day: 15 });
  });
});
