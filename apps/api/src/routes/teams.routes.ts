import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadDocument } from '../middleware/upload.js';
import { handleUpdateTeam } from '../controllers/handle-update-team.js';
import { handleAcceptTerms } from '../controllers/handle-accept-terms.js';
import { handleUploadDocument } from '../controllers/handle-upload-document.js';
import { handleLookupSiret } from '../controllers/handle-lookup-siret.js';

const router: RouterType = Router();

router.use(authMiddleware);

router.put('/me', wrapHandler(handleUpdateTeam));
router.post('/me/accept-terms', wrapHandler(handleAcceptTerms));
router.post('/me/document', uploadDocument, wrapHandler(handleUploadDocument));
router.get('/siret/:siret', wrapHandler(handleLookupSiret));

export default router;
