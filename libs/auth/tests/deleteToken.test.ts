import { deleteToken } from "src/deleteToken";
import { applicationJsonHeaders } from "src/utils";
import { mockFetch } from "tests/utils";

const token = "123";

mockFetch((input) => {
  new URL(input as string).searchParams.get("token");
  return { status: 204 };
});

const authUrl = "auth:5000";

it("raises correct request", async () => {
  await deleteToken(token, authUrl);

  expect(fetch).toHaveBeenCalledWith(authUrl + "/token?token=" + token, {
    method: "DELETE",
    headers: applicationJsonHeaders,
  });
});
