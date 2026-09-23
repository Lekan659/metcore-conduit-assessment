"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "CollectionArticles",
        {
          id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
          },
          collectionId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "Collections", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          articleId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "Articles", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction },
      );

      await queryInterface.addConstraint("CollectionArticles", {
        fields: ["collectionId", "articleId"],
        type: "unique",
        name: "collection_articles_unique",
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("CollectionArticles");
  },
};
