// @vitest-environment node
import axios from "axios";
import {
  getCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  addArticleToCollection,
  removeArticleFromCollection,
} from "./collections";

vi.mock("axios", () => ({ default: vi.fn() }));
const headers = { Authorization: "Token test-token" };
beforeEach(() => vi.resetAllMocks());

test.each([
  [getCollections, {}, { url: "/api/collections", params: { limit: 3, offset: 0 } }],
  [getCollection, { id: 7 }, { url: "/api/collections/7", params: { limit: 3, offset: 0 } }],
  [createCollection, { name: "Reading", description: "Later" }, {
    url: "/api/collections", method: "POST", data: { collection: { name: "Reading", description: "Later" } },
  }],
  [updateCollection, { id: 7, description: null }, {
    url: "/api/collections/7", method: "PUT", data: { collection: { name: undefined, description: null } },
  }],
  [deleteCollection, { id: 7 }, { url: "/api/collections/7", method: "DELETE" }],
  [addArticleToCollection, { id: 7, articleSlug: "reading-react" }, {
    url: "/api/collections/7/articles", method: "POST", data: { articleSlug: "reading-react" },
  }],
  [removeArticleFromCollection, { id: 7, slug: "article/with?characters" }, {
    url: "/api/collections/7/articles/article%2Fwith%3Fcharacters", method: "DELETE",
  }],
])("%s sends authenticated requests matching the backend contract", async (operation, input, expected) => {
  const data = { result: "server response" };
  axios.mockResolvedValue({ data });
  expect(await operation({ headers, ...input })).toBe(data);
  expect(axios).toHaveBeenCalledExactlyOnceWith({ headers, ...expected });
});

test.each([getCollections, getCollection])("%s passes page numbers without multiplying by limit", async (operation) => {
  axios.mockResolvedValue({ data: { articles: [], articlesCount: 12 } });
  await operation({ headers, id: 7, page: 2, limit: 5 });
  expect(axios.mock.calls[0][0].params).toEqual({ limit: 5, offset: 2 });
});

test.each([401, 403, 404, 409, 422, 500])("preserves status %i and the backend error message", async (status) => {
  axios.mockRejectedValue({ response: { status, data: { errors: { body: ["API explanation"] } } } });
  await expect(addArticleToCollection({ headers, id: 7, articleSlug: "saved" }))
    .rejects.toMatchObject({ message: "API explanation", status });
});

test("network failures reject with a message the UI can display", async () => {
  axios.mockRejectedValue(new Error("Network Error"));
  await expect(getCollections({ headers })).rejects.toThrow("Could not connect to the server");
});

test("unexpected error bodies still produce a useful error", async () => {
  axios.mockRejectedValue({ response: { status: 502, data: "Bad gateway" } });
  await expect(getCollections({ headers })).rejects.toMatchObject({
    message: "Could not complete the collection request. Please try again.", status: 502,
  });
});

test("204 deletion responses do not require a JSON body", async () => {
  axios.mockResolvedValue({ status: 204, data: "" });
  await expect(deleteCollection({ headers, id: 7 })).resolves.toBe("");
});
