const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const path = require('path');
const errorHandler = require('./middleware/error');

// Route files
const auth = require('./routes/auth');
const products = require('./routes/products');
const customizations = require('./routes/customizations');
const cart = require('./routes/cart');
const orders = require('./routes/orders');

const app = express();

// Body parser
app.use(express.json());

// File uploading
app.use(fileUpload());

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Security headers
app.use(helmet());

// CORS
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Mount routers
app.use('/api/auth', auth);
app.use('/api/products', products);
app.use('/api/customizations', customizations);
app.use('/api/cart', cart);
app.use('/api/orders', orders);

// Error handler middleware
app.use(errorHandler);

// Handle 404
app.use('', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

module.exports = app;