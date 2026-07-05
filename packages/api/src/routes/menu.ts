import { Router } from 'express';
import { menuService } from '../services/menuService';
import { auth } from '../middleware/auth';

const router = Router();
router.use(auth);

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await menuService.getCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    const products = await menuService.getProducts(categoryId as string | undefined);
    res.json(products);
  } catch (error) {
    next(error);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    const product = await menuService.createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

export default router;