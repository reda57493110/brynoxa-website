import { Router } from 'express';
import authRoutes from './auth.routes';
import catalogRoutes from './catalog.routes';
import commerceRoutes from './commerce.routes';
import customerRoutes from './customer.routes';
import inventoryRoutes from './inventory.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use(catalogRoutes);
router.use(customerRoutes);
router.use(inventoryRoutes);
router.use(commerceRoutes);

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Brynoxa API OK' });
});

export default router;
