// models/settingModel.js - Version PostgreSQL avec ENUM
import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-client.js';

export class Setting extends Model {}

Setting.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    section: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Section du paramètre (general, appearance, contact, etc.)'
    },
    key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Clé unique du paramètre dans sa section'
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Valeur du paramètre'
    },
    type: {
        type: DataTypes.ENUM('string', 'number', 'boolean', 'json', 'file'),
        allowNull: false,
        defaultValue: 'string',
        comment: 'Type de données du paramètre'
    },
    description: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Description du paramètre'
    },
    is_public: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Si visible par les clients'
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    tableName: 'settings',
    timestamps: false, // On gère manuellement car la table a un trigger
    underscored: false // Vos colonnes utilisent snake_case mais pas de conversion auto
});

// Méthodes statiques utiles
Setting.getBySection = async function(sectionName) {
    const settings = await this.findAll({
        where: { section: sectionName },
        order: [['key', 'ASC']]
    });
    
    const result = {};
    settings.forEach(setting => {
        let value = setting.value;
        
        // Parser selon le type
        switch (setting.type) {
            case 'boolean':
                value = value === 'true' || value === '1';
                break;
            case 'number':
                value = parseFloat(value);
                break;
            case 'json':
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    console.warn(`Erreur parsing JSON pour ${setting.key}:`, e);
                }
                break;
        }
        
        result[setting.key] = {
            value,
            type: setting.type,
            description: setting.description
        };
    });
    
    return result;
};

Setting.getValue = async function(section, key, defaultValue = null) {
    try {
        const setting = await this.findOne({
            where: { section, key }
        });
        
        if (!setting) return defaultValue;
        
        let value = setting.value;
        
        // Parser selon le type
        switch (setting.type) {
            case 'boolean':
                return value === 'true' || value === '1';
            case 'number':
                return parseFloat(value);
            case 'json':
                try {
                    return JSON.parse(value);
                } catch (e) {
                    console.warn(`Erreur parsing JSON pour ${section}.${key}:`, e);
                    return defaultValue;
                }
            default:
                return value;
        }
        
    } catch (error) {
        console.error(`Erreur récupération setting ${section}.${key}:`, error);
        return defaultValue;
    }
};

Setting.setValue = async function(section, key, value, type = null, description = null) {
    try {
        // Déterminer le type automatiquement si non fourni
        if (!type) {
            if (typeof value === 'boolean') type = 'boolean';
            else if (typeof value === 'number') type = 'number';
            else if (typeof value === 'object') type = 'json';
            else type = 'string';
        }
        
        // Convertir la valeur en string pour stockage
        let stringValue;
        if (type === 'json') {
            stringValue = JSON.stringify(value);
        } else {
            stringValue = String(value);
        }
        
        const [setting, created] = await this.findOrCreate({
            where: { section, key },
            defaults: {
                section,
                key,
                value: stringValue,
                type,
                description
            }
        });
        
        if (!created) {
            setting.value = stringValue;
            setting.type = type;
            if (description) setting.description = description;
            await setting.save();
        }
        
        return setting;
        
    } catch (error) {
        console.error(`Erreur sauvegarde setting ${section}.${key}:`, error);
        throw error;
    }
};

// Méthode pour obtenir tous les paramètres publics (pour les vues client)
Setting.getPublicSettings = async function() {
    try {
        const settings = await this.findAll({
            where: { is_public: true },
            order: [['section', 'ASC'], ['key', 'ASC']]
        });
        
        const result = {};
        settings.forEach(setting => {
            if (!result[setting.section]) {
                result[setting.section] = {};
            }
            
            let value = setting.value;
            switch (setting.type) {
                case 'boolean':
                    value = value === 'true' || value === '1';
                    break;
                case 'number':
                    value = parseFloat(value);
                    break;
                case 'json':
                    try {
                        value = JSON.parse(value);
                    } catch (e) {
                        console.warn(`Erreur parsing JSON pour ${setting.key}:`, e);
                    }
                    break;
            }
            
            result[setting.section][setting.key] = value;
        });
        
        return result;
        
    } catch (error) {
        console.error('Erreur récupération paramètres publics:', error);
        return {};
    }
};

// Méthode pour créer ou mettre à jour un paramètre
Setting.updateOrCreate = async function(section, key, value, description = null) {
    try {
        const stringValue = String(value);
        const type = typeof value === 'boolean' ? 'boolean' : 
                     typeof value === 'number' ? 'number' : 'string';
        
        const [setting, created] = await this.findOrCreate({
            where: { section, key },
            defaults: {
                section,
                key,
                value: stringValue,
                type,
                description: description || `Paramètre ${key}`,
                is_public: false // Maintenance reste privée
            }
        });
        
        if (!created) {
            setting.value = stringValue;
            setting.type = type;
            if (description) setting.description = description;
            setting.updated_at = new Date();
            await setting.save();
        }
        
        return setting;
        
    } catch (error) {
        console.error(`Erreur sauvegarde setting ${section}.${key}:`, error);
        throw error;
    }
};

export default Setting;