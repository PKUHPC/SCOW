import { type FastifyReply } from "fastify";

import { createOpenApiHtml, sendSwaggerUiAsset } from "src/openapiUi";

it("renders openapi ui with custom base path json url", () => {
  const html = createOpenApiHtml("/scow");

  expect(html).toContain("/scow/meta/api/openapi.json");
  expect(html).toContain("/scow/meta/openapi/swagger-ui-bundle.js");
});

it("renders openapi ui with root base path json url", () => {
  const html = createOpenApiHtml("/");

  expect(html).toContain("/meta/api/openapi.json");
  expect(html).toContain("/meta/openapi/swagger-ui.css");
});

function createReply() {
  const reply = {
    code: jest.fn(),
    send: jest.fn((payload) => {
      payload?.destroy?.();
      return payload;
    }),
    type: jest.fn(),
  };

  reply.code.mockReturnValue(reply);
  reply.type.mockReturnValue(reply);

  return reply as unknown as FastifyReply & {
    code: jest.Mock;
    send: jest.Mock;
    type: jest.Mock;
  };
}

it("sends swagger ui asset", () => {
  const reply = createReply();

  sendSwaggerUiAsset(reply, "swagger-ui.css");

  expect(reply.type).toHaveBeenCalledWith("text/css; charset=utf-8");
  expect(reply.code).not.toHaveBeenCalled();
  expect(reply.send).toHaveBeenCalledTimes(1);
});

it("rejects swagger ui asset path traversal", () => {
  const reply = createReply();

  sendSwaggerUiAsset(reply, "../package.json");

  expect(reply.code).toHaveBeenCalledWith(404);
  expect(reply.type).not.toHaveBeenCalled();
});
