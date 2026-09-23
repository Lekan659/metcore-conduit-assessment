const { CollectionArticle, Article, User } = require("../models");

// Each CollectionArticle row records an article saved in a collection.
// Page these rows first to sort by save date, then fetch the articles together.
async function getCollectionArticles(collectionId, { limit, offset }) {
  const { rows: memberships, count } = await CollectionArticle.findAndCountAll({
    where: { collectionId },
    attributes: ["articleId"],
    limit,
    offset,
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    raw: true,
  });

  if (!memberships.length) {
    return { articles: [], articlesCount: count };
  }

  const articleIds = memberships.map((membership) => membership.articleId);
  const articles = await Article.findAll({
    where: { id: articleIds },
    attributes: ["id", "slug", "title", "description"],
    include: [
      {
        model: User,
        as: "author",
        attributes: ["id", "username", "bio", "image"],
      },
    ],
  });

  const byId = new Map(articles.map((article) => [article.id, article]));
  return {
    articles: articleIds.map((id) => byId.get(id)).filter(Boolean),
    articlesCount: count,
  };
}

module.exports = getCollectionArticles;
