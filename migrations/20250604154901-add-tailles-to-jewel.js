'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('jewel', 'tailles', {
      type: Sequelize.JSON, // ou Sequelize.TEXT si JSON n'est pas supporté
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('jewel', 'tailles');
  }
};