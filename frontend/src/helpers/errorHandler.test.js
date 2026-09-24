import errorHandler from "./errorHandler";

describe("Catching errors", () => {
  const errors = [401, 403, 404, 409, 422, 500];

  test.each(errors)("Status %p shows the API message", (statusCode) => {
    const resError = {
      response: { status: statusCode, data: { errors: { body: ["Please try again."] } } },
    };

    expect(() => errorHandler(resError)).toThrow("Please try again.");
  });

  test("network failures show a useful message", () => {
    expect(() => errorHandler({ request: {} })).toThrow("Could not reach the server");
  });
});
