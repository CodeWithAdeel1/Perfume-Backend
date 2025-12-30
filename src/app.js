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
app.set('trust proxy', 1); // Add this line!
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
  windowMs: 15 * 60 * 1000,
  max: 100,
  // Add this line below:
  validate: { trustProxy: false }, 
  standardHeaders: true,
  legacyHeaders: false,
});

// And add this line to your Express app instance:
app.set('trust proxy', 1);
app.use(limiter);

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
// 1. ADD THIS: Root route to prevent 404 on the main URL
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Perfume Backend API is operational'
  });
});
// Mount routers
app.use('/api/auth', auth);
app.use('/api/products', products);
app.use('/api/customizations', customizations);
app.use('/api/cart', cart);
app.use('/api/orders', orders);

// Error handler middleware
app.use(errorHandler);

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

module.exports = app;
