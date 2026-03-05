import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleListTemplates } from '../controllers/handle-list-templates.js';
import { handleCreateTemplate } from '../controllers/handle-create-template.js';

const router: RouterType = Router();

router.use(authMiddleware);

router.get('/', wrapHandler(handleListTemplates));
router.post('/', wrapHandler(handleCreateTemplate));

export default router;
