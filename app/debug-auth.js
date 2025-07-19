// debug-auth.js - Script à exécuter pour diagnostiquer l'authentification
import { Customer } from './app/models/customerModel.js';
import { Role } from './app/models/roleModel.js';
import { sequelize } from './app/models/sequelize-client.js';

async function debugAuth() {
    try {
        console.log('🔍 === DEBUG AUTHENTIFICATION ===\n');

        // 1. Vérifier la connexion à la base
        await sequelize.authenticate();
        console.log('✅ Connexion base de données OK\n');

        // 2. Vérifier la table Role
        console.log('📋 Table Role:');
        const roles = await Role.findAll();
        console.log('Rôles disponibles:', roles.map(r => ({ id: r.id, name: r.name })));
        console.log('');

        // 3. Vérifier la table Customer
        console.log('👥 Table Customer:');
        const customers = await Customer.findAll({
            attributes: ['id', 'email', 'first_name', 'role_id'],
            limit: 5
        });
        console.log('Premiers clients:', customers.map(c => ({ 
            id: c.id, 
            email: c.email, 
            first_name: c.first_name,
            role_id: c.role_id 
        })));
        console.log('');

        // 4. Tester la relation Customer-Role
        console.log('🔗 Test relation Customer-Role:');
        const customerWithRole = await Customer.findOne({
            include: [
                {
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name']
                }
            ]
        });

        if (customerWithRole) {
            console.log('Relation OK:', {
                customer_id: customerWithRole.id,
                customer_email: customerWithRole.email,
                role_id: customerWithRole.role_id,
                role_name: customerWithRole.role?.name || 'AUCUN RÔLE TROUVÉ'
            });
        } else {
            console.log('❌ Aucun client trouvé avec relation');
        }
        console.log('');

        // 5. Vérifier s'il y a des admins
        console.log('👑 Recherche administrateurs (role_id = 2):');
        const admins = await Customer.findAll({
            where: { role_id: 2 },
            attributes: ['id', 'email', 'first_name', 'role_id'],
            include: [
                {
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name'],
                    required: false
                }
            ]
        });

        if (admins.length > 0) {
            console.log('Admins trouvés:', admins.map(a => ({
                id: a.id,
                email: a.email,
                first_name: a.first_name,
                role_id: a.role_id,
                role_name: a.role?.name
            })));
        } else {
            console.log('❌ Aucun administrateur trouvé');
            
            // Créer un admin de test
            console.log('🔧 Création d\'un admin de test...');
            const testAdmin = await Customer.findOne({ limit: 1 });
            if (testAdmin) {
                await testAdmin.update({ role_id: 2 });
                console.log(`✅ ${testAdmin.email} est maintenant administrateur`);
            }
        }
        console.log('');

        // 6. Test de requête complète comme dans le middleware
        console.log('🧪 Test requête complète middleware:');
        const testUser = await Customer.findByPk(1, {
            include: [
                {
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name']
                }
            ]
        });

        if (testUser) {
            console.log('Test middleware OK:', {
                id: testUser.id,
                email: testUser.email,
                role_id: testUser.role_id,
                role: testUser.role,
                isAdmin: testUser.role_id === 2
            });
        }

        console.log('\n✅ === DEBUG TERMINÉ ===');

    } catch (error) {
        console.error('❌ Erreur lors du debug:', error);
        console.error('Stack:', error.stack);
    } finally {
        await sequelize.close();
    }
}

debugAuth();