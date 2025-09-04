import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: 'text'
  },
  description: {
    type: String,
    index: 'text'
  },
  type: {
    type: String,
    required: true,
    enum: ['apartment', 'house', 'villa', 'studio', 'commercial', 'plot', 'office'],
    index: true
  },
  subType: {
    type: String,
    enum: ['1bhk', '2bhk', '3bhk', '4bhk', '5bhk', 'penthouse', 'duplex']
  },
  bhk: {
    type: Number,
    index: true
  },
  location: {
    type: String,
    required: true,
    index: true
  },
  area: {
    type: String,
    index: true
  },
  city: {
    type: String,
    required: true,
    index: true
  },
  state: {
    type: String,
    default: 'Maharashtra'
  },
  pincode: {
    type: String,
    index: true
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  price: {
    type: String,
    required: true
  },
  priceNumeric: {
    type: Number,
    required: true,
    index: true
  },
  priceType: {
    type: String,
    enum: ['rent', 'sale', 'lease'],
    required: true,
    index: true
  },
  size: {
    type: String,
    required: true
  },
  sizeNumeric: {
    type: Number, // in sq ft
    index: true
  },
  features: [String],
  amenities: [String],
  furnished: {
    type: String,
    enum: ['fully', 'semi', 'unfurnished'],
    index: true
  },
  parking: {
    type: String,
    enum: ['none', 'bike', 'car', 'both']
  },
  floor: {
    current: Number,
    total: Number
  },
  age: {
    type: Number // in years
  },
  availability: {
    type: String,
    enum: ['immediate', '15_days', '1_month', '2_months', '3_months', 'custom'],
    default: 'immediate'
  },
  availableFrom: Date,
  contact: {
    name: String,
    phone: String,
    email: String,
    whatsapp: String
  },
  agent: {
    id: String,
    name: String,
    phone: String,
    email: String
  },
  images: [String],
  videos: [String],
  documents: [{
    type: String,
    url: String,
    name: String
  }],
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  verified: {
    type: Boolean,
    default: false,
    index: true
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  views: {
    type: Number,
    default: 0
  },
  inquiries: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: Date,
  metadata: {
    source: String,
    tags: [String],
    notes: String,
    internalId: String,
    lastVerified: Date,
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    }
  },
  nearby: {
    metro: [{
      name: String,
      distance: Number, // in km
      walkingTime: Number // in minutes
    }],
    schools: [{
      name: String,
      distance: Number,
      rating: Number
    }],
    hospitals: [{
      name: String,
      distance: Number,
      type: String
    }],
    shopping: [{
      name: String,
      distance: Number,
      type: String // mall, market, etc.
    }],
    restaurants: [{
      name: String,
      distance: Number,
      cuisine: String
    }]
  }
});

// Indexes for better search performance
propertySchema.index({ type: 1, city: 1, priceType: 1 });
propertySchema.index({ priceNumeric: 1, type: 1 });
propertySchema.index({ location: 1, type: 1 });
propertySchema.index({ bhk: 1, type: 1, city: 1 });
propertySchema.index({ featured: 1, active: 1, createdAt: -1 });
propertySchema.index({ coordinates: '2dsphere' });

// Text index for search
propertySchema.index({
  title: 'text',
  description: 'text',
  location: 'text',
  area: 'text',
  features: 'text',
  amenities: 'text'
});

// Pre-save middleware
propertySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Extract numeric values from strings
  if (this.price && !this.priceNumeric) {
    const priceMatch = this.price.match(/[\d,]+/);
    if (priceMatch) {
      this.priceNumeric = parseInt(priceMatch[0].replace(/,/g, ''));
    }
  }
  
  if (this.size && !this.sizeNumeric) {
    const sizeMatch = this.size.match(/(\d+)/);
    if (sizeMatch) {
      this.sizeNumeric = parseInt(sizeMatch[1]);
    }
  }
  
  // Extract BHK from type if not set
  if (!this.bhk && this.subType) {
    const bhkMatch = this.subType.match(/(\d+)bhk/i);
    if (bhkMatch) {
      this.bhk = parseInt(bhkMatch[1]);
    }
  }
  
  // Calculate quality score
  this.metadata.qualityScore = this.calculateQualityScore();
  
  next();
});

// Instance methods
propertySchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

propertySchema.methods.incrementInquiries = function() {
  this.inquiries += 1;
  return this.save();
};

propertySchema.methods.calculateQualityScore = function() {
  let score = 0;
  
  // Basic info completeness (40 points)
  if (this.title) score += 5;
  if (this.description && this.description.length > 50) score += 10;
  if (this.images && this.images.length > 0) score += 15;
  if (this.contact && this.contact.phone) score += 10;
  
  // Features and amenities (20 points)
  if (this.features && this.features.length > 0) score += 10;
  if (this.amenities && this.amenities.length > 0) score += 10;
  
  // Location details (20 points)
  if (this.coordinates && this.coordinates.latitude) score += 10;
  if (this.nearby && Object.keys(this.nearby).length > 0) score += 10;
  
  // Verification and freshness (20 points)
  if (this.verified) score += 10;
  if (this.featured) score += 5;
  
  // Freshness bonus
  const daysSinceCreated = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated < 7) score += 5;
  
  return Math.min(score, 100);
};

propertySchema.methods.getFormattedPrice = function() {
  if (this.priceNumeric >= 10000000) { // 1 crore
    return `₹${(this.priceNumeric / 10000000).toFixed(1)} Cr`;
  } else if (this.priceNumeric >= 100000) { // 1 lakh
    return `₹${(this.priceNumeric / 100000).toFixed(1)} L`;
  } else {
    return `₹${this.priceNumeric.toLocaleString('en-IN')}`;
  }
};

propertySchema.methods.getDistance = function(lat, lng) {
  if (!this.coordinates || !this.coordinates.latitude || !this.coordinates.longitude) {
    return null;
  }
  
  const R = 6371; // Earth's radius in km
  const dLat = (lat - this.coordinates.latitude) * Math.PI / 180;
  const dLng = (lng - this.coordinates.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.coordinates.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Static methods
propertySchema.statics.searchProperties = function(criteria = {}) {
  const query = { active: true };
  
  // Location search
  if (criteria.location) {
    query.$or = [
      { location: new RegExp(criteria.location, 'i') },
      { area: new RegExp(criteria.location, 'i') },
      { city: new RegExp(criteria.location, 'i') }
    ];
  }
  
  // Property type
  if (criteria.type) {
    query.type = new RegExp(criteria.type, 'i');
  }
  
  // BHK filter
  if (criteria.bhk) {
    query.bhk = criteria.bhk;
  }
  
  // Price range
  if (criteria.minPrice || criteria.maxPrice) {
    query.priceNumeric = {};
    if (criteria.minPrice) query.priceNumeric.$gte = criteria.minPrice;
    if (criteria.maxPrice) query.priceNumeric.$lte = criteria.maxPrice;
  }
  
  // Price type (rent/sale)
  if (criteria.priceType) {
    query.priceType = criteria.priceType;
  }
  
  // Size range
  if (criteria.minSize || criteria.maxSize) {
    query.sizeNumeric = {};
    if (criteria.minSize) query.sizeNumeric.$gte = criteria.minSize;
    if (criteria.maxSize) query.sizeNumeric.$lte = criteria.maxSize;
  }
  
  // Furnished status
  if (criteria.furnished) {
    query.furnished = criteria.furnished;
  }
  
  return this.find(query)
    .sort({ featured: -1, 'metadata.qualityScore': -1, createdAt: -1 })
    .limit(criteria.limit || 20);
};

propertySchema.statics.findNearby = function(lat, lng, maxDistance = 5, limit = 10) {
  return this.find({
    active: true,
    coordinates: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: maxDistance * 1000 // Convert km to meters
      }
    }
  }).limit(limit);
};

propertySchema.statics.getFeatured = function(limit = 10) {
  return this.find({ featured: true, active: true })
    .sort({ 'metadata.qualityScore': -1, createdAt: -1 })
    .limit(limit);
};

propertySchema.statics.getPopular = function(limit = 10) {
  return this.find({ active: true })
    .sort({ views: -1, inquiries: -1 })
    .limit(limit);
};

propertySchema.statics.getRecentlyAdded = function(limit = 10) {
  return this.find({ active: true })
    .sort({ createdAt: -1 })
    .limit(limit);
};

export const Property = mongoose.model('Property', propertySchema);