import { isImageAddressFromRegistry, isValidImageAddress } from "../../src/utils/imageAddress";

describe("isImageAddressFromRegistry", () => {
  test.each([
    ["harbor.example.com/project/image:latest", "harbor.example.com"],
    ["harbor.example.com:5000/project/image:latest", "https://harbor.example.com:5000/"],
    ["[2001:db8::1]:5000/project/image:latest", "http://[2001:db8::1]:5000"],
    ["HARBOR.EXAMPLE.COM/project/image:latest", "harbor.example.com"],
  ])("identifies an image from the configured registry: %s", (imageAddress, registryAddress) => {
    expect(isImageAddressFromRegistry(imageAddress, registryAddress)).toBe(true);
  });

  test.each([
    ["other.example.com/project/image:latest", "harbor.example.com"],
    ["harbor.example.com:5001/project/image:latest", "harbor.example.com:5000"],
    ["harbor.example.com/project/image:latest", "harbor.example.com.cn"],
    ["invalid-image-address", "harbor.example.com"],
  ])("rejects an image from a different registry: %s", (imageAddress, registryAddress) => {
    expect(isImageAddressFromRegistry(imageAddress, registryAddress)).toBe(false);
  });
});

describe("isValidImageAddress", () => {
  test.each([
    "registry.example.com/library/node",
    "registry.example.com/qinguangrui/node:20-alpine",
    "registry.example.com:5000/team/image_name:v1.0-rc1",
    "localhost/image",
    "localhost:5000/team/image",
    "registry:5000/team/image",
    "192.168.1.10:5000/team/image",
    "[2001:db8::1]:5000/team/image",
    `${"a".repeat(63)}.example.com/team/image`,
    `registry.example.com/team/image:${"a".repeat(128)}`,
    `registry.example.com/team/image:_${"a".repeat(127)}`,
    "registry.example.com/team/image:_tag",
    "registry.example.com/team/image:tag-",
    "registry.example.com/team/image:tag.",
    "registry.example.com/team/image:tag_",
    `registry.example.com/${"a".repeat(234)}`,
    `registry.example.com/team/image@sha256:${"a".repeat(64)}`,
    `registry.example.com/team/image@sha512:${"a".repeat(128)}`,
    `registry.example.com/team/image@blake3:${"a".repeat(64)}`,
    `registry.example.com/team/image@md5:${"a".repeat(32)}`,
    "registry.example.com/team/image@constructor:encoded",
    "registry.example.com/team/image@multihash+base58:QmRZxt2b1FVZPNqd8hsiykDL3TdBDeTSPX9Kv46HmX4Gx8",
    "registry.example.com/team/image@sha256+b64u:LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564",
    `registry.example.com/team/image:release@sha256:${"a".repeat(64)}`,
    `registry.example.com:5000/team/image:release@sha512:${"a".repeat(128)}`,
    `registry.example.com/${"a".repeat(234)}:release@sha256:${"a".repeat(64)}`,
  ])("accepts valid image address: %s", (imageAddress) => {
    expect(isValidImageAddress(imageAddress)).toBe(true);
  });

  test.each([
    "",
    ".",
    "..",
    "-",
    "node",
    "example/node",
    "registry/image",
    "registry.example.com",
    "https://registry.example.com/team/image",
    "-registry.example.com/team/image",
    "registry-.example.com/team/image",
    "registry..example.com/team/image",
    "registry_example.com/team/image",
    `${"a".repeat(64)}.example.com/team/image`,
    "999.999.999.999/team/image",
    "[2001:::1]:5000/team/image",
    "registry.example.com:0/team/image",
    "registry.example.com:65536/team/image",
    "registry.example.com/",
    "registry.example.com/Team/image",
    "registry.example.com/team//image",
    "registry.example.com/team/.image",
    "registry.example.com/team/image_",
    "registry.example.com/team/image..name",
    "registry.example.com/qinguangrui/node:-",
    "registry.example.com/team/image:.tag",
    "registry.example.com/team/image:tag+suffix",
    `registry.example.com/team/image:${"a".repeat(129)}`,
    `registry.example.com/team/image@sha256:${"a".repeat(63)}`,
    `registry.example.com/team/image@sha256:${"A".repeat(64)}`,
    `registry.example.com/team/image@sha256:${"g".repeat(64)}`,
    `registry.example.com/team/image@sha512:${"a".repeat(127)}`,
    `registry.example.com/team/image@blake3:${"a".repeat(63)}`,
    "registry.example.com/team/image@SHA256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "registry.example.com/team/image@multihash++base58:QmRZxt2b1FVZPNqd8hsiykDL3TdBDeTSPX9Kv46HmX4Gx8",
    "registry.example.com/team/image@multihash+base58:",
    "registry.example.com/team/image@multihash+base58:abc.def",
    `registry.example.com/team/image:release@sha256:${"a".repeat(63)}`,
    `registry.example.com/team/image:.release@sha256:${"a".repeat(64)}`,
    "registry.example.com/team/image ",
    `registry.example.com/${"a".repeat(235)}`,
  ])("rejects invalid image address: %s", (imageAddress) => {
    expect(isValidImageAddress(imageAddress)).toBe(false);
  });
});
