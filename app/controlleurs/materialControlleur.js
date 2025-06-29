// controllers/materialController.js
import { Material } from '../models/MaterialModel.js';

export const materialControlleur = {
  async addMaterial(req, res) {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nom de la matière requis' });
    }

    try {
      const material = await Material.create({
        name,
        created_at: new Date(),
        updated_at: new Date()
      });

      res.json({ success: true, material });
    } catch (error) {
      console.error("Erreur lors de l'ajout de la matière:", error);
      res.status(500).json({ success: false, message: "Erreur lors de l'ajout de la matière" });
    }
  }
};
