const Customization = require('../models/Customization');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const cloudinary = require('cloudinary').v2;

// Price configuration
const PRICE_CONFIG = {
  basePrices: {
    floral: 50,
    woody: 60,
    fresh: 45,
    oriental: 70,
    citrus: 40,
    spicy: 65
  },
  bottleUpgrades: {
    classic: 0,
    modern: 10,
    vintage: 15,
    luxury: 30,
    minimalist: 5
  },
  intensityUpgrades: {
    light: 0,
    medium: 5,
    strong: 10
  },
  sizePrices: {
    30: 1,
    50: 1.5,
    100: 2.5,
    200: 4
  },
  materialUpgrades: {
    glass: 0,
    crystal: 20,
    plastic: -5
  },
  packagingUpgrades: {
    standard: 0,
    premium: 15,
    gift: 25
  },
  labelCustomization: 5
};

// @desc    Create new customization
// @route   POST /api/customizations
// @access  Private
exports.createCustomization = async (req, res, next) => {
  try {
    const {
      name,
      fragrance,
      bottle,
      label,
      packaging,
      quantity
    } = req.body;

    // Calculate price
    const basePrice = PRICE_CONFIG.basePrices[fragrance.fragranceType];
    const bottleUpgrade = PRICE_CONFIG.bottleUpgrades[bottle.style];
    const intensityUpgrade = PRICE_CONFIG.intensityUpgrades[fragrance.intensity];
    const materialUpgrade = PRICE_CONFIG.materialUpgrades[bottle.material];
    const packagingUpgrade = PRICE_CONFIG.packagingUpgrades[packaging];
    const labelCustomization = label.text ? PRICE_CONFIG.labelCustomization : 0;
    
    // Size multiplier
    const sizeMultiplier = PRICE_CONFIG.sizePrices[bottle.size];

    const priceBreakdown = {
      basePrice: basePrice * sizeMultiplier,
      bottleUpgrade: bottleUpgrade * sizeMultiplier,
      fragranceUpgrade: intensityUpgrade * sizeMultiplier,
      materialUpgrade: materialUpgrade * sizeMultiplier,
      packagingUpgrade,
      labelCustomization
    };

    const unitPrice = Object.values(priceBreakdown).reduce((a, b) => a + b, 0);
    const totalPrice = unitPrice * quantity;

    const customization = await Customization.create({
      user: req.user.id,
      name,
      fragrance,
      bottle,
      label,
      packaging,
      quantity,
      priceBreakdown,
      totalPrice,
      status: 'completed'
    });

    // Add to user's customization history
    await User.findByIdAndUpdate(
      req.user.id,
      { $push: { customizationHistory: customization._id } }
    );

    res.status(201).json({
      success: true,
      data: customization
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all customizations for user
// @route   GET /api/customizations
// @access  Private
exports.getUserCustomizations = async (req, res, next) => {
  try {
    const customizations = await Customization.find({ user: req.user.id })
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: customizations.length,
      data: customizations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single customization
// @route   GET /api/customizations/:id
// @access  Private
exports.getCustomization = async (req, res, next) => {
  try {
    const customization = await Customization.findById(req.params.id);

    if (!customization) {
      return next(new ErrorResponse(`Customization not found with id of ${req.params.id}`, 404));
    }

    // Make sure user owns customization
    if (customization.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ErrorResponse(`Not authorized to access this customization`, 401));
    }

    res.status(200).json({
      success: true,
      data: customization
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update customization
// @route   PUT /api/customizations/:id
// @access  Private
exports.updateCustomization = async (req, res, next) => {
  try {
    let customization = await Customization.findById(req.params.id);

    if (!customization) {
      return next(new ErrorResponse(`Customization not found with id of ${req.params.id}`, 404));
    }

    // Make sure user owns customization
    if (customization.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ErrorResponse(`Not authorized to update this customization`, 401));
    }

    // Recalculate price if any relevant fields are updated
    if (req.body.fragrance || req.body.bottle || req.body.label || req.body.packaging || req.body.quantity) {
      const updatedFields = { ...customization.toObject(), ...req.body };
      
      const basePrice = PRICE_CONFIG.basePrices[updatedFields.fragrance.fragranceType];
      const bottleUpgrade = PRICE_CONFIG.bottleUpgrades[updatedFields.bottle.style];
      const intensityUpgrade = PRICE_CONFIG.intensityUpgrades[updatedFields.fragrance.intensity];
      const materialUpgrade = PRICE_CONFIG.materialUpgrades[updatedFields.bottle.material];
      const packagingUpgrade = PRICE_CONFIG.packagingUpgrades[updatedFields.packaging];
      const labelCustomization = updatedFields.label.text ? PRICE_CONFIG.labelCustomization : 0;
      
      const sizeMultiplier = PRICE_CONFIG.sizePrices[updatedFields.bottle.size];

      req.body.priceBreakdown = {
        basePrice: basePrice * sizeMultiplier,
        bottleUpgrade: bottleUpgrade * sizeMultiplier,
        fragranceUpgrade: intensityUpgrade * sizeMultiplier,
        materialUpgrade: materialUpgrade * sizeMultiplier,
        packagingUpgrade,
        labelCustomization
      };
    }

    customization = await Customization.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: customization
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete customization
// @route   DELETE /api/customizations/:id
// @access  Private
exports.deleteCustomization = async (req, res, next) => {
  try {
    const customization = await Customization.findById(req.params.id);

    if (!customization) {
      return next(new ErrorResponse(`Customization not found with id of ${req.params.id}`, 404));
    }

    // Make sure user owns customization
    if (customization.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ErrorResponse(`Not authorized to delete this customization`, 401));
    }

    // Remove from user's customization history
    await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { customizationHistory: customization._id } }
    );

    // Delete images from cloudinary if any
    if (customization.images && customization.images.length > 0) {
      for (const image of customization.images) {
        await cloudinary.uploader.destroy(image.public_id);
      }
    }

    await customization.remove();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Calculate customization price
// @route   POST /api/customizations/calculate-price
// @access  Public
exports.calculatePrice = async (req, res, next) => {
  try {
    const { fragrance, bottle, label, packaging, quantity } = req.body;

    // Validate inputs
    if (!fragrance || !bottle || !quantity) {
      return next(new ErrorResponse('Missing required fields', 400));
    }

    // Calculate price
    const basePrice = PRICE_CONFIG.basePrices[fragrance.fragranceType];
    const bottleUpgrade = PRICE_CONFIG.bottleUpgrades[bottle.style];
    const intensityUpgrade = PRICE_CONFIG.intensityUpgrades[fragrance.intensity];
    const materialUpgrade = PRICE_CONFIG.materialUpgrades[bottle.material];
    const packagingUpgrade = PRICE_CONFIG.packagingUpgrades[packaging];
    const labelCustomization = label && label.text ? PRICE_CONFIG.labelCustomization : 0;
    
    const sizeMultiplier = PRICE_CONFIG.sizePrices[bottle.size];

    const priceBreakdown = {
      basePrice: basePrice * sizeMultiplier,
      bottleUpgrade: bottleUpgrade * sizeMultiplier,
      fragranceUpgrade: intensityUpgrade * sizeMultiplier,
      materialUpgrade: materialUpgrade * sizeMultiplier,
      packagingUpgrade,
      labelCustomization
    };

    const unitPrice = Object.values(priceBreakdown).reduce((a, b) => a + b, 0);
    const totalPrice = unitPrice * quantity;

    res.status(200).json({
      success: true,
      data: {
        priceBreakdown,
        unitPrice,
        totalPrice
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check for existing similar customizations
// @route   POST /api/customizations/check-existing
// @access  Private
exports.checkExisting = async (req, res, next) => {
  try {
    const { fragrance, bottle, label } = req.body;

    const existing = await Customization.find({
      user: req.user.id,
      'fragrance.fragranceType': fragrance.fragranceType,
      'fragrance.intensity': fragrance.intensity,
      'bottle.style': bottle.style,
      'bottle.color': bottle.color,
      'bottle.size': bottle.size,
      'label.text': label.text
    });

    res.status(200).json({
      success: true,
      count: existing.length,
      data: existing
    });
  } catch (error) {
    next(error);
  }
};