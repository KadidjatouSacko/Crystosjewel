// migrations/migratePromoCodes.js
import { PromoCode } from '../app/models/Promocode.js'

/**
 * Migre les codes promo du code vers la base de données
 */
export async function migrateHardcodedPromoCodes() {
    console.log('🔄 Migration des codes promo vers la base de données...');
    
    const hardcodedCodes = {
        'DALLA30': { 
            discountPercent: 20, 
            minAmount: 0, 
            maxDiscount: null,
            description: 'Réduction de 20%',
            usageLimit: 999,
            expiresAt: null
        },
        'WELCOME10': { 
            discountPercent: 10, 
            minAmount: 30, 
            maxDiscount: 50,
            description: 'Réduction de 10%',
            usageLimit: 100,
            expiresAt: new Date('2025-12-31')
        },
        'SUMMER25': { 
            discountPercent: 25, 
            minAmount: 50, 
            maxDiscount: 100,
            description: 'Réduction de 25%',
            usageLimit: 50,
            expiresAt: new Date('2025-09-30')
        }
    };

    try {
        for (const [code, config] of Object.entries(hardcodedCodes)) {
            // Vérifier si le code existe déjà
            const existing = await PromoCode.findOne({ where: { code } });
            
            if (!existing) {
                await PromoCode.create({
                    code: code,
                    discount_percent: config.discountPercent,
                    expires_at: config.expiresAt,
                    usage_limit: config.usageLimit,
                    used_count: 0
                });
                console.log(`✅ Code ${code} créé`);
            } else {
                // Mettre à jour si nécessaire
                await existing.update({
                    discount_percent: config.discountPercent,
                    expires_at: config.expiresAt,
                    usage_limit: config.usageLimit
                });
                console.log(`✅ Code ${code} mis à jour`);
            }
        }
        
        console.log('🎉 Migration terminée avec succès !');
        
        // Afficher les codes migrés
        const allCodes = await PromoCode.findAll();
        console.log(`📊 Total des codes en base: ${allCodes.length}`);
        allCodes.forEach(code => {
            console.log(`- ${code.code}: ${code.discount_percent}% (${code.used_count}/${code.usage_limit})`);
        });
        
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        throw error;
    }
}

// Fonction à appeler au démarrage de l'application
export async function ensurePromoCodesExist() {
    try {
        const count = await PromoCode.count();
        if (count === 0) {
            console.log('📝 Aucun code promo en base, lancement de la migration...');
            await migrateHardcodedPromoCodes();
        } else {
            console.log(`✅ ${count} codes promo trouvés en base`);
        }
    } catch (error) {
        console.error('❌ Erreur vérification codes promo:', error);
    }
}