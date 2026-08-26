import { Router } from 'express';
import multer from 'multer';
import { auth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();
router.use(auth);
router.use(requireRole('ADMIN', 'MANAGER'));

// Multer: store in memory, 2MB limit (images should be compressed client-side)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPG, PNG, WebP, GIF)'));
    }
  },
});

/**
 * POST /api/upload/image — Upload a product image.
 * Returns a base64 data URL that can be stored in Product.imageUrl.
 *
 * This approach keeps things simple (no external storage/CDN needed).
 * Images should be compressed/resized client-side before upload.
 */
router.post('/image', upload.single('image'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibió imagen' });
    }

    // Convert to base64 data URL
    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    // Sanity check on final size (base64 is ~33% larger)
    if (dataUrl.length > 3 * 1024 * 1024) {
      return res.status(413).json({ success: false, message: 'La imagen es demasiado grande. Máximo 2MB.' });
    }

    res.json({ success: true, imageUrl: dataUrl, size: req.file.size });
  } catch (error) {
    next(error);
  }
});

export default router;
