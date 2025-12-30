// require('dotenv').config();
const dotenv = require('dotenv');
dotenv.config();
const app = require('./src/app');
const connectDB = require('./src/config/database');
const cloudinary = require('cloudinary').v2;

// Load environment variables

// Connect to MongoDB
connectDB();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// const PORT = process.env.PORT || 5000;

// const server = app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
// IMPORTANT: Only start the server listener if NOT on Vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Add this line at the bottom!
module.exports = app;

// Handle unhandled promise rejections
// process.on('unhandledRejection', (err, promise) => {
//   console.log(`Error: ${err.message}`);
//   server.close(() => process.exit(1));
// });
