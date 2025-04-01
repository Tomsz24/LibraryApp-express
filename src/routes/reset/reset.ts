import { Router } from 'express';
import {
  changePasswordController,
  resetPasswordController,
} from '../../controllers/resetController';

const router = Router();

router.post('/request', resetPasswordController);

router.post('/change', changePasswordController);

export default router;
