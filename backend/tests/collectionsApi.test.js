// @vitest-environment node
const path = require("node:path");
const { randomUUID } = require("node:crypto");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
if (process.env.NODE_ENV !== "test" || !process.env.TEST_DB_NAME || process.env.TEST_DB_NAME === process.env.DEV_DB_NAME) {
  throw new Error("Configure a separate TEST_DB_NAME before running database tests.");
}
// Use a test-only signing key; do not change the environment file.
process.env.JWT_KEY = "collections-api-test-key";
const express = require("express");
const { sequelize, User, Article, Collection, CollectionArticle } = require("../models");
const { jwtSign } = require("../helper/jwt");
const router = require("../routes/collections");
const errorHandler = require("../middleware/errorHandler");

let server, base, owner, other, token, otherToken, collection;
let userIds = [];
let articles = [];

async function request(method, url, body, auth = token) {
  const response = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Token ${auth}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

beforeAll(async () => {
  await sequelize.authenticate();
  const app = express();
  app.use(express.json());
  app.use("/api/collections", router);
  app.use(errorHandler);
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });
  base = `http://127.0.0.1:${server.address().port}/api/collections`;
});

beforeEach(async () => {
  const suffix = randomUUID();
  for (const name of ["owner", "other"]) {
    const user = await User.create({ username: `${name}-${suffix}`, email: `${name}-${suffix}@example.test` });
    userIds.push(user.id);
    if (name === "owner") owner = user;
    else other = user;
  }
  token = await jwtSign(owner);
  otherToken = await jwtSign(other);
  collection = await Collection.create({ name: "Read later", userId: owner.id });
  articles = await Article.bulkCreate([0, 1, 2].map((i) => ({
    title: `Article ${i}`, slug: `${suffix}-${i}`, description: `Summary ${i}`,
    body: "Full body should not be loaded", userId: owner.id,
    createdAt: new Date(i === 2 ? "2010-01-01" : "2025-01-01"),
  })));
});

afterEach(async () => {
  // Delete only this test's fixtures, never truncate shared tables.
  await Collection.destroy({ where: { userId: userIds } });
  await Article.destroy({ where: { userId: userIds } });
  await User.destroy({ where: { id: userIds } });
  userIds = [];
});

afterAll(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

const operations = () => [
  ["GET", ""], ["POST", "", { collection: { name: "New" } }],
  ["GET", `/${collection.id}`], ["PUT", `/${collection.id}`, { collection: { name: "Changed" } }],
  ["DELETE", `/${collection.id}`],
  ["POST", `/${collection.id}/articles`, { articleSlug: articles[0].slug }],
  ["DELETE", `/${collection.id}/articles/${articles[0].slug}`],
];

test("every endpoint requires login and rejects invalid tokens", async () => {
  for (const [method, url, body] of operations()) {
    expect((await request(method, url, body, null)).status).toBe(401);
    expect((await request(method, url, body, "invalid-token")).status).toBe(401);
  }
});

test("another user cannot read, edit, delete or change membership", async () => {
  await collection.addArticle(articles[0]);
  for (const [method, url, body] of operations().slice(2)) {
    expect((await request(method, url, body, otherToken)).status).toBe(404);
  }
  expect((await request("GET", "", undefined, otherToken)).body.collections).toEqual([]);
  expect(await collection.countArticles()).toBe(1);
  expect((await collection.reload()).name).toBe("Read later");
});

test("create, list, update and delete preserve ownership and articles", async () => {
  const created = await request("POST", "", { collection: { name: "  Books  ", userId: other.id } });
  expect(created.status).toBe(201);
  expect(created.body.collection.name).toBe("Books");
  expect(created.body.collection.userId).toBeUndefined();
  const id = created.body.collection.id;
  expect((await Collection.findByPk(id)).userId).toBe(owner.id);
  const updated = await request("PUT", `/${id}`, { collection: { description: "  Later  ", userId: other.id } });
  expect(updated.status).toBe(200);
  expect(updated.body.collection.description).toBe("Later");
  expect((await Collection.findByPk(id)).userId).toBe(owner.id);
  expect((await request("GET", "")).body.collectionsCount).toBe(2);
  await request("POST", `/${id}/articles`, { articleSlug: articles[0].slug });
  expect((await request("DELETE", `/${id}`)).status).toBe(204);
  expect(await CollectionArticle.count({ where: { collectionId: id } })).toBe(0);
  expect(await Article.findByPk(articles[0].id)).not.toBeNull();
});

test("invalid bodies, IDs and pagination return validation errors", async () => {
  for (const body of [{}, { collection: [] }, { collection: { name: 42 } }, { collection: { name: " " } }, { collection: { name: "x".repeat(101) } }, { collection: { name: "OK", description: 42 } }]) {
    const response = await request("POST", "", body);
    expect(response.status).toBe(422);
    expect(response.body.errors.body.length).toBeGreaterThan(0);
  }
  expect((await request("PUT", `/${collection.id}`, { collection: {} })).status).toBe(422);
  for (const id of ["abc", "0", "-1", "2147483648"]) expect((await request("GET", `/${id}`)).status).toBe(422);
  for (const query of ["limit=0", "limit=101", "limit=abc", "offset=-1", "offset=1.5", "limit=3&offset=9007199254740991"]) {
    expect((await request("GET", `/${collection.id}?${query}`)).status).toBe(422);
    expect((await request("GET", `?${query}`)).status).toBe(422);
  }
  expect((await request("POST", `/${collection.id}/articles`, { articleSlug: 42 })).status).toBe(422);
  expect((await request("POST", `/${collection.id}/articles`, { articleSlug: "missing" })).status).toBe(404);
});

test("repeated and concurrent saves create only one membership", async () => {
  const save = () => request("POST", `/${collection.id}/articles`, { articleSlug: articles[0].slug });
  const responses = await Promise.all([save(), save()]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  expect((await save()).status).toBe(409);
  expect(await collection.countArticles()).toBe(1);
  const another = await Collection.create({ name: "Keep this save", userId: owner.id });
  await another.addArticle(articles[0]);
  expect((await request("DELETE", `/${collection.id}/articles/${articles[0].slug}`)).status).toBe(204);
  expect((await request("DELETE", `/${collection.id}/articles/${articles[0].slug}`)).status).toBe(404);
  expect(await Article.findByPk(articles[0].id)).not.toBeNull();
  expect(await collection.countArticles()).toBe(0);
  expect(await another.countArticles()).toBe(1);
});

test("detail paginates by save date, includes only summary fields, and has no N+1 queries", async () => {
  for (let i = 0; i < articles.length; i++) {
    await CollectionArticle.create({ collectionId: collection.id, articleId: articles[i].id, createdAt: new Date(2026, 0, i + 1) });
  }
  async function measured(limit) {
    const queries = [];
    const previous = sequelize.options.logging;
    sequelize.options.logging = (sql) => queries.push(sql);
    try {
      const result = await request("GET", `/${collection.id}?limit=${limit}&offset=0`);
      expect(result.status).toBe(200);
      return { ...result.body, queries };
    } finally {
      sequelize.options.logging = previous;
    }
  }
  const one = await measured(1);
  const three = await measured(3);
  expect(one.queries.length).toBeGreaterThan(0);
  expect(three.queries.length).toBe(one.queries.length);
  expect(three.articlesCount).toBe(3);
  expect(three.articles.map((a) => a.slug)).toEqual([...articles].reverse().map((a) => a.slug));
  expect(Object.keys(three.articles[0]).sort()).toEqual(["author", "description", "slug", "title"]);
  for (const article of three.articles) {
    expect(article.author).toEqual({ username: owner.username, bio: null, image: null });
  }
  const second = await request("GET", `/${collection.id}?limit=1&offset=1`);
  expect(second.body.articles[0].slug).toBe(articles[1].slug);
  const empty = await request("GET", `/${collection.id}?limit=3&offset=1`);
  expect(empty.body.articles).toEqual([]);
  expect(empty.body.articlesCount).toBe(3);
});


test("collection list paginates only the owner's rows with a total count", async () => {
  const extra = await Collection.bulkCreate([1, 2, 3].map((i) => ({
    name: `List ${i}`, userId: owner.id, createdAt: new Date(collection.createdAt.getTime() + 1000),
  })));
  await Collection.create({ name: "Private other list", userId: other.id });
  const expectedIds = [...extra].reverse().map((item) => item.id).concat(collection.id);
  const first = await request("GET", "?limit=2&offset=0");
  const second = await request("GET", "?limit=2&offset=1");
  const empty = await request("GET", "?limit=2&offset=2");
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(first.body.collections.map((item) => item.id)).toEqual(expectedIds.slice(0, 2));
  expect(second.body.collections.map((item) => item.id)).toEqual(expectedIds.slice(2));
  for (const response of [first, second, empty]) expect(response.body.collectionsCount).toBe(4);
  expect(empty.body.collections).toEqual([]);
  expect((await request("GET", "")).body.collections).toHaveLength(3);
});
