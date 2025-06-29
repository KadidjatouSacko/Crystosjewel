
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize-client.js"; 

export class Activity extends Model {}

Activity.init ({
      activity_type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      icon: {
        type: DataTypes.STRING,
        allowNull: false
      },
      customer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Customers', // Assure-toi que tu as une table "Customers"
          key: 'id'
        }
      }
    }, {
        sequelize,
        tableName : "Activity",
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false
    });
  
   
  
  