import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleListExpenses } from '../controllers/handle-list-expenses.js';
import { handleCreateExpense } from '../controllers/handle-create-expense.js';

const router: RouterType = Router();

router.use(authMiddleware);

router.get('/', wrapHandler(handleListExpenses));
router.post('/', wrapHandler(handleCreateExpense));

export default router;
