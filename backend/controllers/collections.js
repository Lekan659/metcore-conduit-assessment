const { UniqueConstraintError, ForeignKeyConstraintError } = require("sequelize");
const { Collection, Article, CollectionArticle } = require("../models");
const {
  UnauthorizedError,
  NotFoundError,
  FieldRequiredError,
  ValidationError,
} = require("../helper/customErrors");
const getCollectionArticles = require("../helper/collectionArticles");

const collectionInput = (body, creating = false) => {
  const input = body?.collection;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Provide a collection object");
  }

  const values = {};
  if (creating || input.name !== undefined) {
    if (typeof input.name !== "string") {
      throw new ValidationError("Collection name must be text");
    }
    const name = input.name.trim();
    if (!name) throw new FieldRequiredError("A collection name");
    if (name.length > 100) {
      throw new ValidationError("Collection name must not exceed 100 characters");
    }
    values.name = name;
  }

  if (input.description !== undefined) {
    if (input.description !== null && typeof input.description !== "string") {
      throw new ValidationError("Collection description must be text or null");
    }
    const description = input.description?.trim() || null;
    values.description = description;
  } else if (creating) {
    values.description = null;
  }

  if (!creating && Object.keys(values).length === 0) {
    throw new ValidationError("Provide a name or description to update");
  }
  return values;
};

// Both endpoints follow the starter: offset is a zero-based page number.
const pagination = (query) => {
  const { limit = 3, offset = 0 } = query;
  const pageSize = Number(limit);
  const page = Number(offset);

  if (
    !/^\d+$/.test(String(limit)) ||
    !/^\d+$/.test(String(offset)) ||
    !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
    !Number.isSafeInteger(page) || page < 0 ||
    !Number.isSafeInteger(page * pageSize)
  ) {
    throw new ValidationError("limit must be 1–100 and offset a non-negative whole page number");
  }
  return { limit: pageSize, offset: page * pageSize };
};

const ownedCollection = async (req) => {
  const { loggedUser } = req;
  if (!loggedUser) throw new UnauthorizedError();

  const collection = await Collection.findOne({
    where: { id: req.params.id, userId: loggedUser.id },
  });
  if (!collection) throw new NotFoundError("Collection");
  return collection;
};

const createCollection = async (req, res, next) => {
  try {
    const { loggedUser: user } = req;
    if (!user) throw new UnauthorizedError();
    const values = collectionInput(req.body, true);
    const collection = await Collection.create({ ...values, userId: user.id });
    res.status(201).json({ collection });
  } catch (error) {
    next(error);
  }
};

const getCollections = async (req, res, next) => {
  try {
    const { loggedUser: user } = req;
    if (!user) throw new UnauthorizedError();
    const { rows: collections, count } = await Collection.findAndCountAll({
      where: { userId: user.id },
      ...pagination(req.query),
      order: [["createdAt", "DESC"], ["id", "DESC"]],
    });
    res.json({ collections, collectionsCount: count });
  } catch (error) {
    next(error);
  }
};

const getCollection = async (req, res, next) => {
  try {
    const collection = await ownedCollection(req);
    const savedArticles = await getCollectionArticles(collection.id, pagination(req.query));
    res.json({ collection, ...savedArticles });
  } catch (error) {
    next(error);
  }
};

const updateCollection = async (req, res, next) => {
  try {
    const collection = await ownedCollection(req);
    await collection.update(collectionInput(req.body));
    res.json({ collection });
  } catch (error) {
    next(error);
  }
};

const deleteCollection = async (req, res, next) => {
  try {
    const collection = await ownedCollection(req);
    await collection.destroy();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const addArticleToCollection = async (req, res, next) => {
  try {
    const collection = await ownedCollection(req);
    const { articleSlug } = req.body || {};
    if (typeof articleSlug !== "string" || !articleSlug.trim()) {
      throw new FieldRequiredError("An article slug");
    }
    const slug = articleSlug.trim();
    const article = await Article.findOne({ where: { slug }, attributes: ["id"] });
    if (!article) throw new NotFoundError("Article");

    // Insert directly so the unique constraint rejects both repeat and concurrent saves.
    await CollectionArticle.create({ collectionId: collection.id, articleId: article.id });
    res.status(201).json({ message: "Article added to collection" });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        errors: { body: ["Article is already in this collection"] },
      });
    }
    if (error instanceof ForeignKeyConstraintError) {
      return next(new NotFoundError("Collection or article"));
    }
    next(error);
  }
};

const removeArticleFromCollection = async (req, res, next) => {
  try {
    const collection = await ownedCollection(req);
    const { slug } = req.params;
    const article = await Article.findOne({ where: { slug }, attributes: ["id"] });
    if (!article) throw new NotFoundError("Article");

    const removed = await CollectionArticle.destroy({
      where: { collectionId: collection.id, articleId: article.id },
    });
    if (!removed) throw new NotFoundError("Article in collection");
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCollection,
  getCollections,
  getCollection,
  updateCollection,
  deleteCollection,
  addArticleToCollection,
  removeArticleFromCollection,
};
