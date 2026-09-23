"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Article author
      await queryInterface.addColumn(
        "Articles",
        "userId",
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "Users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        { transaction },
      );

      // Article that a comment belongs to
      await queryInterface.addColumn(
        "Comments",
        "articleId",
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "Articles",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        { transaction },
      );

      // Comment author
      await queryInterface.addColumn(
        "Comments",
        "userId",
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "Users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        { transaction },
      );

      // Users' favourite articles
      await queryInterface.createTable(
        "Favorites",
        {
          articleId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
              model: "Articles",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          userId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
              model: "Users",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
        },
        { transaction },
      );

      // Relationships between users and their followers
      await queryInterface.createTable(
        "Followers",
        {
          userId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
              model: "Users",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          followerId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
              model: "Users",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
        },
        { transaction },
      );

      // Tags attached to articles
      await queryInterface.createTable(
        "TagList",
        {
          articleId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
              model: "Articles",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          tagName: {
            type: Sequelize.STRING,
            allowNull: false,
            primaryKey: true,
            references: {
              model: "Tags",
              key: "name",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
        },
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("TagList", { transaction });
      await queryInterface.dropTable("Followers", { transaction });
      await queryInterface.dropTable("Favorites", { transaction });

      await queryInterface.removeColumn("Comments", "userId", {
        transaction,
      });

      await queryInterface.removeColumn("Comments", "articleId", {
        transaction,
      });

      await queryInterface.removeColumn("Articles", "userId", {
        transaction,
      });
    });
  },
};