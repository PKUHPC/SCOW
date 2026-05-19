import "jest-extended";
module.exports = async () => {
  jest.mock("@scow/lib-auth", () => ({
    createUser: jest.fn(async () => ({ status: 204, ok: true, text: () => "" })),
    getUser: jest.fn(async () => ({ identityId: "test" })),
    getCapabilities: jest.fn(async () => ({
      createUser: true,
      changePassword: true,
      getUser: true,
      validateName: true,
      deleteUser: true,
      deleteAccount: true,
    })),
    deleteUser: jest.fn(async () => ({ status: 204, ok: true })),
    deleteAccount: jest.fn(async () => ({ status: 204, ok: true })),
  }));
};
