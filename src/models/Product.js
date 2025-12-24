const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter product name'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please enter product description']
  },
  brand: {
    type: String,
    required: [true, 'Please enter brand name']
  },
  fragranceNotes: {
    topNotes: [String],
    middleNotes: [String],
    baseNotes: [String]
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'unisex'],
    required: [true, 'Please specify gender target']
  },
  category: {
    type: String,
    enum: ['perfume', 'cologne', 'body mist', 'attar'],
    default: 'perfume'
  },
  price: {
    type: Number,
    required: [true, 'Please enter product price'],
    min: [0, 'Price cannot be negative']
  },
  discountPrice: {
    type: Number,
    min: [0, 'Discount price cannot be negative']
  },
  discountPercentage: {
    type: Number,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100']
  },
  size: {
    type: Number,
    required: [true, 'Please enter product size in ml']
  },
  stock: {
    type: Number,
    required: [true, 'Please enter product stock'],
    min: [0, 'Stock cannot be negative']
  },
  images: [{
    public_id: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    }
  }],
  ratings: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  numOfReviews: {
    type: Number,
    default: 0
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate final price
productSchema.virtual('finalPrice').get(function() {
  if (this.discountPrice) {
    return this.discountPrice;
  }
  if (this.discountPercentage) {
    return this.price * (1 - this.discountPercentage / 100);
  }
  return this.price;
});

module.exports = mongoose.model('Product', productSchema);