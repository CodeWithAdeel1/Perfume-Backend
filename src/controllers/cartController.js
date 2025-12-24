const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Customization = require('../models/Customization');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
exports.getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product')
      .populate('items.customization');

    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/items
// @access  Private
exports.addToCart = async (req, res, next) => {
  try {
    const { itemType, itemId, quantity } = req.body;

    let cart = await Cart.findOne({ user: req.user.id });
    
    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    let itemDetails;
    let itemName;
    let itemPrice;
    let itemImage;

    if (itemType === 'product') {
      const product = await Product.findById(itemId);
      
      if (!product) {
        return next(new ErrorResponse('Product not found', 404));
      }

      if (product.stock < quantity) {
        return next(new ErrorResponse(`Only ${product.stock} items available`, 400));
      }

      itemDetails = { product: itemId };
      itemName = product.name;
      itemPrice = product.finalPrice;
      itemImage = product.images[0];
    } else if (itemType === 'customization') {
      const customization = await Customization.findById(itemId);
      
      if (!customization) {
        return next(new ErrorResponse('Customization not found', 404));
      }

      // Check if user owns the customization
      if (customization.user.toString() !== req.user.id) {
        return next(new ErrorResponse('Not authorized to add this customization to cart', 401));
      }

      itemDetails = { customization: itemId };
      itemName = customization.name;
      itemPrice = customization.totalPrice / customization.quantity;
      itemImage = customization.images && customization.images.length > 0 
        ? customization.images[0] 
        : null;
    } else {
      return next(new ErrorResponse('Invalid item type', 400));
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(item => {
      if (itemType === 'product') {
        return item.product && item.product.toString() === itemId;
      } else {
        return item.customization && item.customization.toString() === itemId;
      }
    });

    if (existingItemIndex > -1) {
      // Update quantity if item exists
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item to cart
      cart.items.push({
        ...itemDetails,
        name: itemName,
        price: itemPrice,
        quantity,
        image: itemImage,
        itemType
      });
    }

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:itemId
// @access  Private
exports.updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const itemId = req.params.itemId;

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return next(new ErrorResponse('Cart not found', 404));
    }

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);

    if (itemIndex === -1) {
      return next(new ErrorResponse('Item not found in cart', 404));
    }

    if (quantity <= 0) {
      // Remove item if quantity is 0 or less
      cart.items.splice(itemIndex, 1);
    } else {
      // Check stock if it's a product
      if (cart.items[itemIndex].itemType === 'product' && cart.items[itemIndex].product) {
        const product = await Product.findById(cart.items[itemIndex].product);
        if (product && product.stock < quantity) {
          return next(new ErrorResponse(`Only ${product.stock} items available`, 400));
        }
      }
      
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:itemId
// @access  Private
exports.removeFromCart = async (req, res, next) => {
  try {
    const itemId = req.params.itemId;

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return next(new ErrorResponse('Cart not found', 404));
    }

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);

    if (itemIndex === -1) {
      return next(new ErrorResponse('Item not found in cart', 404));
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
exports.clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return next(new ErrorResponse('Cart not found', 404));
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Move customization to cart
// @route   POST /api/cart/from-customization/:customizationId
// @access  Private
exports.addCustomizationToCart = async (req, res, next) => {
  try {
    const customization = await Customization.findById(req.params.customizationId);

    if (!customization) {
      return next(new ErrorResponse('Customization not found', 404));
    }

    // Check if user owns the customization
    if (customization.user.toString() !== req.user.id) {
      return next(new ErrorResponse('Not authorized to add this customization to cart', 401));
    }

    // Update customization status
    customization.status = 'ordered';
    await customization.save();

    // Add to cart
    await this.addToCart({
      body: {
        itemType: 'customization',
        itemId: customization._id,
        quantity: customization.quantity
      },
      user: req.user
    }, res, next);
  } catch (error) {
    next(error);
  }
};