// @vitest-environment node
const path = require("node:path");
const { randomUUID } = require("node:crypto");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});

if (
  process.env.NODE_ENV !== "test" ||
  !process.env.TEST_DB_NAME ||
  process.env.TEST_DB_NAME === process.env.DEV_DB_NAME
) {
  throw new Error("Configure a separate TEST_DB_NAME before running database tests.");
}

const {
  sequelize,
  User,
  Article,
  Collection,
  CollectionArticle,
  Sequelize,
} = require("../models");

let transaction;
let owner;
let article;
let collection;

beforeEach(async () => {
  transaction = await sequelize.transaction();
  const suffix = randomUUID();
  owner = await User.create(
    { username: `test-${suffix}`, email: `${suffix}@example.test` },
    { transaction },
  );
  article = await Article.create(
    { title: "Test article", slug: suffix, body: "Test", userId: owner.id },
    { transaction },
  );
  collection = await Collection.create(
    { name: "Read later", userId: owner.id },
    { transaction },
  );
});

afterEach(async () => {
  if (transaction && !transaction.finished) await transaction.rollback();
  transaction = undefined;
});

afterAll(async () => {
  await sequelize.close();
});

test("an article can be saved, read, and removed without deleting it", async () => {
  await collection.addArticle(article, { transaction });
  const saved = await collection.getArticles({ transaction });
  expect(saved.map((item) => item.id)).toEqual([article.id]);
  expect((await article.getCollections({ transaction }))[0].id).toBe(collection.id);

  await collection.removeArticle(article, { transaction });
  expect(await collection.countArticles({ transaction })).toBe(0);
  expect(await Article.findByPk(article.id, { transaction })).not.toBeNull();
});

test("the database rejects duplicate membership", async () => {
  const membership = { collectionId: collection.id, articleId: article.id };
  await CollectionArticle.create(membership, { transaction });

  // PostgreSQL needs a savepoint so the expected failure does not abort the parent transaction.
  await expect(
    sequelize.transaction({ transaction }, (savepoint) =>
      CollectionArticle.create(membership, { transaction: savepoint }),
    ),
  ).rejects.toBeInstanceOf(Sequelize.UniqueConstraintError);

  expect(await CollectionArticle.count({ where: membership, transaction })).toBe(1);
});

test("deleting one collection preserves its article and another collection's membership", async () => {
  const another = await Collection.create(
    { name: "Another list", userId: owner.id },
    { transaction },
  );
  await collection.addArticle(article, { transaction });
  await another.addArticle(article, { transaction });
  await collection.destroy({ transaction });

  expect(await CollectionArticle.count({
    where: { collectionId: collection.id }, transaction,
  })).toBe(0);
  expect(await Article.findByPk(article.id, { transaction })).not.toBeNull();
  expect(await another.countArticles({ transaction })).toBe(1);
});

test("deleting an article removes its memberships but preserves the collection", async () => {
  await collection.addArticle(article, { transaction });
  await article.destroy({ transaction });

  expect(await CollectionArticle.count({
    where: { collectionId: collection.id }, transaction,
  })).toBe(0);
  expect(await Collection.findByPk(collection.id, { transaction })).not.toBeNull();
});

test("the database rejects a membership referring to a deleted collection", async () => {
  await collection.destroy({ transaction });

  await expect(
    sequelize.transaction({ transaction }, (savepoint) =>
      CollectionArticle.create(
        { collectionId: collection.id, articleId: article.id },
        { transaction: savepoint },
      ),
    ),
  ).rejects.toBeInstanceOf(Sequelize.ForeignKeyConstraintError);
});

test("the database rejects a membership referring to a deleted article", async () => {
  await article.destroy({ transaction });

  await expect(
    sequelize.transaction({ transaction }, (savepoint) =>
      CollectionArticle.create(
        { collectionId: collection.id, articleId: article.id },
        { transaction: savepoint },
      ),
    ),
  ).rejects.toBeInstanceOf(Sequelize.ForeignKeyConstraintError);
});
