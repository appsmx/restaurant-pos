import { Router } from 'express';
import { floorPlanService } from '../services/floorPlanService';
import { auth } from '../middleware/auth';

const router = Router();
router.use(auth);

router.get('/sections', async (req, res, next) => {
  try {
    const sections = await floorPlanService.getSections();
    res.json(sections);
  } catch (error) {
    next(error);
  }
});

router.get('/tables', async (req, res, next) => {
  try {
    const { sectionId } = req.query;
    const tables = await floorPlanService.getTables(sectionId as string | undefined);
    res.json(tables);
  } catch (error) {
    next(error);
  }
});

router.patch('/tables/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const table = await floorPlanService.updateTableStatus(id, status);
    res.json(table);
  } catch (error) {
    next(error);
  }
});

export default router;