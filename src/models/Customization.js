const mongoose = require('mongoose');

const customizationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please enter customization name']
  },
  baseProduct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  fragrance: {
    fragranceType: {
      type: String,
      enum: ['floral', 'woody', 'fresh', 'oriental', 'citrus', 'spicy'],
      required: true
    },
    intensity: {
      type: String,
      enum: ['light', 'medium', 'strong'],
      default: 'medium'
    },
    specificNotes: [String]
  },
  bottle: {
    style: {
      type: String,
      enum: ['classic', 'modern', 'vintage', 'luxury', 'minimalist'],
      required: true
    },
    color: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      enum: [30, 50, 100, 200],
      required: true
    },
    material: {
      type: String,
      enum: ['glass', 'crystal', 'plastic'],
      default: 'glass'
    }
  },
  label: {
    text: String,
    font: {
      type: String,
      enum: ['serif', 'sans-serif', 'script', 'modern'],
      default: 'sans-serif'
    },
    color: String
  },
  packaging: {
    type: String,
    enum: ['standard', 'premium', 'gift'],
    default: 'standard'
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  priceBreakdown: {
    basePrice: {
      type: Number,
      required: true
    },
    bottleUpgrade: {
      type: Number,
      default: 0
    },
    fragranceUpgrade: {
      type: Number,
      default: 0
    },
    packagingUpgrade: {
      type: Number,
      default: 0
    },
    labelCustomization: {
      type: Number,
      default: 0
    }
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'completed', 'ordered'],
    default: 'draft'
  },
  images: [{
    public_id: String,
    url: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate total price before saving
customizationSchema.pre('save', function(next) {
  const basePrice = this.priceBreakdown.basePrice || 0;
  const bottleUpgrade = this.priceBreakdown.bottleUpgrade || 0;
  const fragranceUpgrade = this.priceBreakdown.fragranceUpgrade || 0;
  const packagingUpgrade = this.priceBreakdown.packagingUpgrade || 0;
  const labelCustomization = this.priceBreakdown.labelCustomization || 0;
  
  const unitPrice = basePrice + bottleUpgrade + fragranceUpgrade + packagingUpgrade + labelCustomization;
  this.totalPrice = unitPrice * this.quantity;
  next();
});

module.exports = mongoose.model('Customization', customizationSchema);