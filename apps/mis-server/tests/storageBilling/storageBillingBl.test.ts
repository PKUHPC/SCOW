import { calculateTieredPrice } from "src/bl/storageBilling";
import { StoragePriceTier } from "src/entities/StoragePriceItem";

describe("calculateTieredPrice", () => {

  it("returns 0 for empty tiers", () => {
    expect(calculateTieredPrice(100, []).toNumber()).toBe(0);
  });

  it("returns 0 for zero or negative usage", () => {
    const tiers: StoragePriceTier[] = [{ startTb: 0, pricePerTbPerDay: 1 }];
    expect(calculateTieredPrice(0, tiers).toNumber()).toBe(0);
    expect(calculateTieredPrice(-10, tiers).toNumber()).toBe(0);
  });

  it("calculates single tier correctly", () => {
    // 1024 GB = 1 TB, price = 2 元/TB/天 → 2
    const tiers: StoragePriceTier[] = [{ startTb: 0, pricePerTbPerDay: 2 }];
    const result = calculateTieredPrice(1024, tiers);
    expect(result.toNumber()).toBe(2);
  });

  it("calculates with free first tier and paid second tier", () => {
    // tier 0: 0~50TB free, tier 1: 50TB+ at 1.5 元/TB/天
    // 60TB usage (60*1024 GB): first 50TB free, next 10TB at 1.5 → 15
    const tiers: StoragePriceTier[] = [
      { startTb: 0, pricePerTbPerDay: 0 },
      { startTb: 50, pricePerTbPerDay: 1.5 },
    ];
    const result = calculateTieredPrice(60 * 1024, tiers);
    expect(result.toNumber()).toBe(15);
  });

  it("charges only the first tier when usage is below second tier", () => {
    // 30TB usage (30*1024 GB): all in first tier at 1 元/TB/天 → 30
    const tiers: StoragePriceTier[] = [
      { startTb: 0, pricePerTbPerDay: 1 },
      { startTb: 50, pricePerTbPerDay: 2 },
    ];
    const result = calculateTieredPrice(30 * 1024, tiers);
    expect(result.toNumber()).toBe(30);
  });

  it("calculates three tiers correctly (progressive pricing)", () => {
    // tier 0: 0~10TB at 1, tier 1: 10~50TB at 2, tier 2: 50TB+ at 3
    // 70TB usage:
    //   tier 0: 10TB * 1 = 10
    //   tier 1: 40TB * 2 = 80
    //   tier 2: 20TB * 3 = 60
    //   total = 150
    const tiers: StoragePriceTier[] = [
      { startTb: 0, pricePerTbPerDay: 1 },
      { startTb: 10, pricePerTbPerDay: 2 },
      { startTb: 50, pricePerTbPerDay: 3 },
    ];
    const result = calculateTieredPrice(70 * 1024, tiers);
    expect(result.toNumber()).toBe(150);
  });

  it("handles unsorted tiers input", () => {
    // same as above but tiers given in reverse order
    const tiers: StoragePriceTier[] = [
      { startTb: 50, pricePerTbPerDay: 3 },
      { startTb: 0, pricePerTbPerDay: 1 },
      { startTb: 10, pricePerTbPerDay: 2 },
    ];
    const result = calculateTieredPrice(70 * 1024, tiers);
    expect(result.toNumber()).toBe(150);
  });

  it("calculates fractional GB correctly", () => {
    // 512 GB = 0.5 TB at 2 元/TB/天 → 1
    const tiers: StoragePriceTier[] = [{ startTb: 0, pricePerTbPerDay: 2 }];
    const result = calculateTieredPrice(512, tiers);
    expect(result.toNumber()).toBe(1);
  });

  it("calculates 1 GB correctly (minimum billing unit)", () => {
    // 1 GB = 1/1024 TB at 1024 元/TB/天 → 1
    const tiers: StoragePriceTier[] = [{ startTb: 0, pricePerTbPerDay: 1024 }];
    const result = calculateTieredPrice(1, tiers);
    expect(result.toNumber()).toBe(1);
  });
});
