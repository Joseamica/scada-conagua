import { Router, Request, Response } from 'express';
import { isAuth, isAdmin } from '../middlewares/auth-middleware';
import { getAllEntities, getScopedEntities, createEntity } from '../services/entity-service';

const router = Router();

// GET / — List entities filtered by caller's scope
router.get('/', isAuth, async (req: Request, res: Response) => {
    try {
        const { scope, scope_id, estado_id } = req.user!;
        const entities = await getScopedEntities(scope, estado_id, scope_id);
        res.json(entities);
    } catch (error) {
        console.error('Error fetching entities:', error);
        res.status(500).json({ error: 'Failed to fetch entities' });
    }
});

// POST / — Create a new entity (Admin only)
router.post('/', isAdmin, async (req: Request, res: Response) => {
    const { name, level, parent_id, estado_id, municipio_id } = req.body;

    if (!name || !level) {
        return res.status(400).json({ error: 'name and level are required' });
    }

    try {
        const id = await createEntity({ name, level, parent_id, estado_id, municipio_id });
        res.status(201).json({ id, message: 'Entity created' });
    } catch (error) {
        console.error('Error creating entity:', error);
        res.status(500).json({ error: 'Failed to create entity' });
    }
});

export default router;
