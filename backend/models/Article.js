"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Article extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate({ User, Tag, Comment, Collection, CollectionArticle }) {
      // define association here

      // Users
      this.belongsTo(User, { foreignKey: "userId", as: "author" });

      // Comments
      this.hasMany(Comment, { foreignKey: "articleId", onDelete: "cascade" });

      // Tag list
      this.belongsToMany(Tag, {
        through: "TagList",
        as: "tagList",
        foreignKey: "articleId",
        timestamps: false,
        onDelete: "cascade", // FIXME: delete tags
      });

      this.belongsToMany(Collection, {
        through: { model: CollectionArticle, unique: false },
        as: "collections",
        foreignKey: "articleId",
        otherKey: "collectionId",
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });


      // Favorites
      this.belongsToMany(User, {
        through: "Favorites",
        foreignKey: "articleId",
        timestamps: false,
      });
    }

    toJSON() {
      return {
        ...this.get(),
        id: undefined,
        userId: undefined,
      };
    }
  }
  Article.init(
    {
      slug: DataTypes.STRING,
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      body: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "Article",
    },
  );
  return Article;
};
