"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CollectionArticle extends Model {
    static associate({ Collection, Article }) {
      this.belongsTo(Collection, {
        foreignKey: "collectionId",
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
      this.belongsTo(Article, {
        foreignKey: "articleId",
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    }
  }

  CollectionArticle.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      collectionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      articleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "CollectionArticle",
      indexes: [
        {
          name: "collection_articles_unique",
          unique: true,
          fields: ["collectionId", "articleId"],
        },
      ],
    },
  );

  return CollectionArticle;
};