const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  addCustomizationToCart
} = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

router.route('/')
  .get(protect, getCart)
  .delete(protect, clearCart);

router.route('/items')
  .post(protect, addToCart);

router.route('/items/:itemId')
  .put(protect, updateCartItem)
  .delete(protect, removeFromCart);

router.route('/from-customization/:customizationId')
  .post(protect, addCustomizationToCart);

module.exports = router;