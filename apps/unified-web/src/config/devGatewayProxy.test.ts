import { DEV_GATEWAY_PROXY_PREFIX, getDevGatewayResourceUrl } from "src/config/devGatewayProxy";

describe("getDevGatewayResourceUrl", () => {
  test("routes resources on the selected gateway through the local development proxy", () => {
    expect(
      getDevGatewayResourceUrl(
        "https://gateway.example.test/notification?source=portal",
        "https://gateway.example.test",
      ),
    ).toBe(`${DEV_GATEWAY_PROXY_PREFIX}/notification?source=portal`);
  });

  test("keeps external extension resources unchanged", () => {
    expect(getDevGatewayResourceUrl("https://extension.example.com", "https://gateway.example.test")).toBe(
      "https://extension.example.com",
    );
  });

  test("keeps relative extension resources unchanged", () => {
    expect(getDevGatewayResourceUrl("/notification", "https://gateway.example.test")).toBe("/notification");
  });
});
