import { getUser } from "src/getUser";
import { applicationJsonHeaders } from "src/utils";
import { mockFetch } from "tests/utils";

const identityId = "existing";
const error = "error";

mockFetch((input) => {
  const query = new URL(input as string).searchParams.get("identityId");
  if (query === identityId) {
    return { status: 200, json: { user: { identityId: identityId } } };
  } else if (query === error) {
    return { status: 404 };
  } else {
    return { status: 404, json: { code: "USER_NOT_FOUND" } };
  }
});

const authUrl = "auth:5000";

it("raises correct request", async () => {
  await getUser(authUrl, { identityId });

  expect(fetch).toHaveBeenCalledWith(authUrl + "/user?identityId=" + identityId, {
    headers: applicationJsonHeaders,
  });
});

it("returns undefined if 404 and USER_NOT_FOUND", async () => {
  const user = await getUser(authUrl, { identityId: identityId + identityId });
  expect(user).toBeUndefined();
});

it("returns user if user exists", async () => {
  const user = await getUser(authUrl, { identityId: identityId });
  expect(user).toEqual({ identityId });
});

it("throws for unexpected error", async () => {
  try {
    await getUser(authUrl, { identityId: error });
    expect("").fail("get user completes");
  } catch (e: any) {
    expect(e.status).toBe(404);
  }
});
