const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Customization = require('../models/Customization');
const ErrorResponse = require('../utils/errorResponse');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// @desc    Create new order from cart
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res, next) => {
  try {
    const { shippingInfo, paymentMethod } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product')
      .populate('items.customization');

    if (!cart || cart.items.length === 0) {
      return next(new ErrorResponse('No items in cart', 400));
    }

    // Check stock for all products
    for (const item of cart.items) {
      if (item.itemType === 'product' && item.product) {
        if (item.product.stock < item.quantity) {
          return next(new ErrorResponse(
            `Insufficient stock for ${item.product.name}. Only ${item.product.stock} available`,
            400
          ));
        }
      }
    }

    // Prepare order items
    const orderItems = cart.items.map(item => ({
      product: item.itemType === 'product' ? item.product._id : undefined,
      customization: item.itemType === 'customization' ? item.customization._id : undefined,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
      itemType: item.itemType
    }));

    // Calculate prices
    const itemsPrice = cart.totalPrice;
    const taxPrice = itemsPrice * 0.15; // 15% tax
    const shippingPrice = itemsPrice > 100 ? 0 : 10; // Free shipping above $100
    const totalPrice = itemsPrice + taxPrice + shippingPrice;

    // Create order
    const order = await Order.create({
      user: req.user.id,
      orderItems,
      shippingInfo,
      paymentInfo: {
        method: paymentMethod,
        status: paymentMethod === 'cod' ? 'pending' : 'pending'
      },
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      orderStatus: 'processing'
    });

    // Update stock and customization status
    for (const item of cart.items) {
      if (item.itemType === 'product' && item.product) {
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { stock: -item.quantity }
        });
      } else if (item.itemType === 'customization' && item.customization) {
        await Customization.findByIdAndUpdate(item.customization._id, {
          status: 'ordered'
        });
      }
    }

    // Clear cart
    cart.items = [];
    await cart.save();

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('orderItems.product')
      .populate('orderItems.customization');

    if (!order) {
      return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
    }

    // Make sure user owns order or is admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ErrorResponse(`Not authorized to access this order`, 401));
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all orders - Admin
// @route   GET /api/orders
// @access  Private/Admin
exports.getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status - Admin
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
    }

    order.orderStatus = status;
    
    if (status === 'delivered') {
      order.deliveredAt = Date.now();
      order.paymentInfo.status = 'completed';
      order.paymentInfo.paymentDate = Date.now();
    }

    await order.save();

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Process payment
// @route   POST /api/orders/:id/pay
// @access  Private
exports.processPayment = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
    }

    // Make sure user owns order
    if (order.user.toString() !== req.user.id) {
      return next(new ErrorResponse(`Not authorized to pay for this order`, 401));
    }

    // Check if already paid
    if (order.paymentInfo.status === 'completed') {
      return next(new ErrorResponse(`Order already paid`, 400));
    }

    // Process payment based on method
    if (order.paymentInfo.method === 'credit_card' || order.paymentInfo.method === 'debit_card') {
      // Process with Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.totalPrice * 100), // Convert to cents
        currency: 'usd',
        metadata: { orderId: order._id.toString() }
      });

      order.paymentInfo.transactionId = paymentIntent.id;
      order.paymentInfo.status = 'pending'; // Will be updated via webhook
      
    } else if (order.paymentInfo.method === 'easypaisa' || order.paymentInfo.method === 'jazzcash') {
      // For mobile payment methods, generate payment reference
      order.paymentInfo.transactionId = `MP${Date.now()}${Math.floor(Math.random() * 1000)}`;
      order.paymentInfo.status = 'pending';
      
    } else if (order.paymentInfo.method === 'bank_transfer') {
      // Generate bank transfer reference
      order.paymentInfo.transactionId = `BT${Date.now()}${Math.floor(Math.random() * 1000)}`;
      order.paymentInfo.status = 'pending';
    }

    await order.save();

    res.status(200).json({
      success: true,
      data: {
        order,
        clientSecret: order.paymentInfo.method.includes('card') ? paymentIntent?.client_secret : null,
        paymentReference: order.paymentInfo.transactionId
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Confirm mobile/bank payment
// @route   POST /api/orders/:id/confirm-payment
// @access  Private
exports.confirmPayment = async (req, res, next) => {
  try {
    const { transactionId } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
    }

    // Make sure user owns order
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ErrorResponse(`Not authorized to confirm payment for this order`, 401));
    }

    order.paymentInfo.status = 'completed';
    order.paymentInfo.paymentDate = Date.now();
    
    if (transactionId) {
      order.paymentInfo.transactionId = transactionId;
    }

    await order.save();

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
    }

    // Make sure user owns order
    if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ErrorResponse(`Not authorized to cancel this order`, 401));
    }

    // Check if order can be cancelled
    if (!['processing', 'confirmed'].includes(order.orderStatus)) {
      return next(new ErrorResponse(`Order cannot be cancelled at this stage`, 400));
    }

    // Restore stock if products were deducted
    if (order.orderStatus === 'processing' || order.orderStatus === 'confirmed') {
      for (const item of order.orderItems) {
        if (item.itemType === 'product' && item.product) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: item.quantity }
          });
        }
      }
    }

    order.orderStatus = 'cancelled';
    await order.save();

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Stripe webhook
// @route   POST /api/orders/webhook
// @access  Public
exports.stripeWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      
      // Find order by transaction ID
      const order = await Order.findOne({
        'paymentInfo.transactionId': paymentIntent.id
      });

      if (order) {
        order.paymentInfo.status = 'completed';
        order.paymentInfo.paymentDate = new Date();
        await order.save();
      }
      break;
      
    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object;
      
      const failedOrder = await Order.findOne({
        'paymentInfo.transactionId': failedPaymentIntent.id
      });

      if (failedOrder) {
        order.paymentInfo.status = 'failed';
        await order.save();
      }
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};