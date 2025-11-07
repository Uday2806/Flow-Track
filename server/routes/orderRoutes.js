
import express from 'express';
import multer from 'multer';
import { 
    getAllOrders, 
    syncShopifyOrders, 
    updateOrderStatus, 
    addOrderNote,
    seedOrders
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Configure multer for memory storage to handle file uploads within the status update
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

router.get('/', protect, getAllOrders);
router.post('/shopify-sync', protect, syncShopifyOrders);
// This route now accepts multiple file uploads (up to 5) along with status data
router.put('/:id/status', protect, upload.array('attachmentFiles', 5), updateOrderStatus);
router.post('/:id/note', protect, addOrderNote);

// A utility route to seed initial order data (optional)
router.post('/seed-orders', seedOrders);

export default router;