"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Collection extends Model {
    static associate({ User, Article, CollectionArticle }) {
      this.belongsTo(User, {
        as: "owner",
        foreignKey: "userId",
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });

      this.belongsToMany(Article, {
        through: { model: CollectionArticle, unique: false },
        as: "articles",
        foreignKey: "collectionId",
        otherKey: "articleId",
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    }

    toJSON() {
      return {
        ...this.get(),
        userId: undefined,
      };
    }
  }

  Collection.init(
    {
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      description: DataTypes.TEXT,

      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Collection",
      indexes: [
        {
          name: "collections_user_id",
          fields: ["userId"],
        },
      ],
    },
  );

  return Collection;
};