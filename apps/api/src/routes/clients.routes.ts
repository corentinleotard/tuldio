import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleListClients } from '../controllers/handle-list-clients.js';
import { handleSearchClients } from '../controllers/handle-search-clients.js';
import { handleGetClient } from '../controllers/handle-get-client.js';
import { handleCreateClient } from '../controllers/handle-create-client.js';
import { handleUpdateClient } from '../controllers/handle-update-client.js';
import { handleAddClientNote } from '../controllers/handle-add-client-note.js';

const router: RouterType = Router();

router.use(authMiddleware);

router.get('/', wrapHandler(handleListClients));
router.get('/search', wrapHandler(handleSearchClients));
router.get('/:id', wrapHandler(handleGetClient));
router.post('/', wrapHandler(handleCreateClient));
router.put('/:id', wrapHandler(handleUpdateClient));
router.post('/:id/notes', wrapHandler(handleAddClientNote));

export default router;
