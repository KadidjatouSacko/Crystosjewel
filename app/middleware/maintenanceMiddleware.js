// app/middleware/maintenanceMiddleware.js
import { maintenance } from '../utils/maintenance.js';

export const maintenanceCheck = (req, res, next) => {
    try {
        console.log('🔍 Vérification maintenance:', {
            maintenanceActive: maintenance.isActive(),
            isAdmin: req.session?.user?.role_id === 2,
            path: req.path,
            userId: req.session?.user?.id
        });

        // ✅ Si pas en maintenance, continuer normalement
        if (!maintenance.isActive()) {
            console.log('✅ Pas de maintenance active, accès normal');
            return next();
        }
        
        // ✅ TOUJOURS PERMETTRE L'ACCÈS À CES PAGES (même en maintenance)
        const allowedPaths = [
            '/connexion-inscription',
            '/connexion', 
            '/inscription',
            '/api/auth/login',
            '/api/auth/register',
            '/login',
            '/register',
            '/maintenance',
            '/deconnexion',
            '/logout'
        ];
        
        const allowedStatic = [
            '/css/',
            '/js/',
            '/images/',
            '/public/',
            '/favicon.ico'
        ];
        
        // Vérifier les chemins autorisés
        if (allowedPaths.includes(req.path) || 
            allowedStatic.some(path => req.path.startsWith(path))) {
            console.log('✅ Chemin autorisé pendant maintenance:', req.path);
            return next();
        }
        
        // ✅ Permettre l'accès aux admins connectés (role_id = 2)
        if (req.session?.user?.role_id === 2) {
            console.log('👑 Admin autorisé pendant la maintenance');
            return next();
        }
        
        // ✅ Permettre l'accès aux routes API de maintenance pour les admins
        if (req.path.startsWith('/api/maintenance')) {
            if (req.session?.user?.role_id === 2) {
                console.log('🔧 API maintenance autorisée pour admin');
                return next();
            } else {
                console.log('❌ API maintenance refusée pour non-admin');
                return res.status(403).json({
                    success: false,
                    message: 'Accès administrateur requis'
                });
            }
        }
        
        console.log('🚫 Redirection vers maintenance pour:', req.path);
        
        // Rediriger tous les autres utilisateurs vers la page de maintenance
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(503).json({
                success: false,
                message: 'Site en maintenance',
                maintenanceMode: true,
                maintenanceData: maintenance.getStatus()
            });
        }
        
        return res.redirect('/maintenance');
        
    } catch (error) {
        console.error('❌ Erreur middleware maintenance:', error);
        next();
    }
};