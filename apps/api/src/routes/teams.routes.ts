import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleUpdateTeam } from '../controllers/handle-update-team.js';
import { handleLookupSiret } from '../controllers/handle-lookup-siret.js';

const router: RouterType = Router();

router.use(authMiddleware);

router.put('/me', wrapHandler(handleUpdateTeam));
router.get('/siret/:siret', wrapHandler(handleLookupSiret));

export default router;
