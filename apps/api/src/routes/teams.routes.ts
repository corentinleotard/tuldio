import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadDocument, uploadLogo } from '../middleware/upload.js';
import { handleUpdateTeam } from '../controllers/handle-update-team.js';
import { handleAcceptTerms } from '../controllers/handle-accept-terms.js';
import { handleUploadDocument } from '../controllers/handle-upload-document.js';
import { handleUploadLogo } from '../controllers/handle-upload-logo.js';
import { handleDeleteLogo } from '../controllers/handle-delete-logo.js';
import { handleLookupSiret } from '../controllers/handle-lookup-siret.js';
import { handleGetAiCosts } from '../controllers/handle-get-ai-costs.js';
import { handlePreviewPdf } from '../controllers/handle-preview-pdf.js';
import { handleGetTeamFields } from '../controllers/handle-get-team-fields.js';
import { handleUpdateTeamField } from '../controllers/handle-update-team-field.js';
import { handleCreateTeamField } from '../controllers/handle-create-team-field.js';
import { handleDeleteTeamField } from '../controllers/handle-delete-team-field.js';

const router: RouterType = Router();

router.use(authMiddleware);

router.put('/me', wrapHandler(handleUpdateTeam));
router.post('/me/accept-terms', wrapHandler(handleAcceptTerms));
router.post('/me/document', uploadDocument, wrapHandler(handleUploadDocument));
router.post('/me/logo', uploadLogo, wrapHandler(handleUploadLogo));
router.delete('/me/logo', wrapHandler(handleDeleteLogo));
router.get('/me/ai-costs', wrapHandler(handleGetAiCosts));
router.get('/me/preview-pdf', wrapHandler(handlePreviewPdf));
router.get('/me/fields', wrapHandler(handleGetTeamFields));
router.patch('/me/fields/:fieldId', wrapHandler(handleUpdateTeamField));
router.post('/me/fields', wrapHandler(handleCreateTeamField));
router.delete('/me/fields/:fieldId', wrapHandler(handleDeleteTeamField));
router.get('/siret/:siret', wrapHandler(handleLookupSiret));

export default router;
