const express = require('express');
const router = express.Router();
const {
  createCustomization,
  getUserCustomizations,
  getCustomization,
  updateCustomization,
  deleteCustomization,
  calculatePrice,
  checkExisting
} = require('../controllers/customizationController');
const { protect } = require('../middleware/auth');

router.route('/')
  .get(protect, getUserCustomizations)
  .post(protect, createCustomization);

router.route('/calculate-price')
  .post(calculatePrice);

router.route('/check-existing')
  .post(protect, checkExisting);

router.route('/:id')
  .get(protect, getCustomization)
  .put(protect, updateCustomization)
  .delete(protect, deleteCustomization);

module.exports = router;