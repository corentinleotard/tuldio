import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { otpLimiter } from '../lib/rate-limit.js';
import { handleSendOtp } from '../controllers/handle-send-otp.js';
import { handleVerifyOtp } from '../controllers/handle-verify-otp.js';
import { handleRefresh } from '../controllers/handle-refresh.js';
import { handleLogout } from '../controllers/handle-logout.js';
import { handleMe } from '../controllers/handle-me.js';
import { handleBootstrap } from '../controllers/handle-bootstrap.js';
import { handleActivateInvite } from '../controllers/handle-activate-invite.js';

const router: RouterType = Router();

// Public
router.post('/otp/send', otpLimiter, wrapHandler(handleSendOtp));
router.post('/otp/verify', wrapHandler(handleVerifyOtp));
router.post('/refresh', wrapHandler(handleRefresh));
router.post('/invite', wrapHandler(handleActivateInvite));

// Protected
router.get('/me', authMiddleware, wrapHandler(handleMe));
router.get('/bootstrap', authMiddleware, wrapHandler(handleBootstrap));
router.post('/logout', authMiddleware, wrapHandler(handleLogout));

export default router;
