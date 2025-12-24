const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrder,
  getMyOrders,
  getOrders,
  updateOrderStatus,
  processPayment,
  confirmPayment,
  cancelOrder,
  stripeWebhook
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

// Stripe webhook (needs raw body)
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

router.route('/')
  .post(protect, createOrder)
  .get(protect, authorize('admin'), getOrders);

router.route('/myorders')
  .get(protect, getMyOrders);

router.route('/:id')
  .get(protect, getOrder);

router.route('/:id/status')
  .put(protect, authorize('admin'), updateOrderStatus);

router.route('/:id/pay')
  .post(protect, processPayment);

router.route('/:id/confirm-payment')
  .post(protect, confirmPayment);

router.route('/:id/cancel')
  .put(protect, cancelOrder);

module.exports = router;