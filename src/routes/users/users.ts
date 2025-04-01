import { Router } from 'express';
import { authenticateUser } from '../../middlewares/authenticateUser';
import {
  deleteUserController,
  updateUserController,
} from '../../controllers/usersController';
import { authenticateAdmin } from '../../middlewares/authenticateAdmin';

const router = Router();

router.put('/:id', authenticateUser, updateUserController);

router.delete('/:id', authenticateAdmin, deleteUserController);
export default router;
