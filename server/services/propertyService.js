import { logger } from '../utils/logger.js';
import { Property } from '../models/Property.js';

export class PropertyService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
  }

  async searchProperties(entities = {}) {
    try {
      const cacheKey = JSON.stringify(entities);
      
      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          logger.info('Returning cached property search results');
          return cached.data;
        }
      }

      // Build search query
      const query = this.buildSearchQuery(entities);
      
      // Search properties in database
      const properties = await Property.find(query)
        .sort({ featured: -1, createdAt: -1 })
        .limit(10)
        .lean();

      // If no properties found in DB, return sample data
      let results = properties.length > 0 ? properties : this.getSampleProperties(entities);

      // Filter and rank results based on entities
      results = this.rankProperties(results, entities);

      // Cache results
      this.cache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
      });

      logger.info(`Found ${results.length} properties for search query`);
      return results;

    } catch (error) {
      logger.error('Error searching properties:', error);
      return this.getSampleProperties(entities);
    }
  }

  buildSearchQuery(entities) {
    const query = {};

    // Location filter
    if (entities.locations && entities.locations.length > 0) {
      query.$or = entities.locations.map(location => ({
        $or: [
          { location: new RegExp(location, 'i') },
          { area: new RegExp(location, 'i') },
          { city: new RegExp(location, 'i') }
        ]
      }));
    }

    // Property type filter
    if (entities.propertyTypes && entities.propertyTypes.length > 0) {
      query.type = { $in: entities.propertyTypes.map(type => new RegExp(type, 'i')) };
    }

    // Budget filter
    if (entities.budget) {
      const priceQuery = {};
      if (entities.budget.min) {
        priceQuery.$gte = entities.budget.min;
      }
      if (entities.budget.max) {
        priceQuery.$lte = entities.budget.max;
      }
      if (Object.keys(priceQuery).length > 0) {
        query.priceNumeric = priceQuery;
      }
    }

    // Size/BHK filter based on numbers
    if (entities.numbers && entities.numbers.length > 0) {
      const bhkNumbers = entities.numbers.filter(n => n >= 1 && n <= 5);
      if (bhkNumbers.length > 0) {
        query.bhk = { $in: bhkNumbers };
      }
    }

    return query;
  }

  rankProperties(properties, entities) {
    return properties.map(property => {
      let score = 0;

      // Location match scoring
      if (entities.locations) {
        entities.locations.forEach(location => {
          if (property.location?.toLowerCase().includes(location.toLowerCase()) ||
              property.area?.toLowerCase().includes(location.toLowerCase())) {
            score += 10;
          }
        });
      }

      // Property type match scoring
      if (entities.propertyTypes) {
        entities.propertyTypes.forEach(type => {
          if (property.type?.toLowerCase().includes(type.toLowerCase())) {
            score += 15;
          }
        });
      }

      // Budget match scoring
      if (entities.budget && property.priceNumeric) {
        const price = property.priceNumeric;
        if (entities.budget.min && entities.budget.max) {
          if (price >= entities.budget.min && price <= entities.budget.max) {
            score += 20;
          }
        } else if (entities.budget.min && price >= entities.budget.min) {
          score += 10;
        } else if (entities.budget.max && price <= entities.budget.max) {
          score += 10;
        }
      }

      // Featured properties get bonus points
      if (property.featured) {
        score += 5;
      }

      return { ...property, relevanceScore: score };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  getSampleProperties(entities = {}) {
    const sampleProperties = [
      {
        _id: 'sample1',
        title: 'Luxury 3BHK Apartment in Downtown',
        type: '3bhk apartment',
        location: 'Downtown, City Center',
        area: 'Downtown',
        city: 'Mumbai',
        price: '₹85,000/month',
        priceNumeric: 85000,
        size: '1450 sq ft',
        bhk: 3,
        features: ['Furnished', 'Parking', 'Gym', 'Swimming Pool', 'Security'],
        amenities: ['24/7 Security', 'Power Backup', 'Elevator', 'Garden'],
        contact: 'Call +91-9876543210',
        featured: true,
        description: 'Spacious 3BHK apartment with modern amenities in prime location',
        images: ['image1.jpg', 'image2.jpg'],
        available: true
      },
      {
        _id: 'sample2',
        title: 'Cozy 2BHK Near Metro Station',
        type: '2bhk apartment',
        location: 'Andheri East, Mumbai',
        area: 'Andheri East',
        city: 'Mumbai',
        price: '₹45,000/month',
        priceNumeric: 45000,
        size: '950 sq ft',
        bhk: 2,
        features: ['Semi-Furnished', 'Metro Connectivity', 'Shopping Mall Nearby'],
        amenities: ['Security', 'Elevator', 'Parking'],
        contact: 'Call +91-9876543211',
        featured: false,
        description: 'Well-connected 2BHK apartment near metro station',
        images: ['image3.jpg', 'image4.jpg'],
        available: true
      },
      {
        _id: 'sample3',
        title: 'Spacious 4BHK Villa with Garden',
        type: '4bhk villa',
        location: 'Bandra West, Mumbai',
        area: 'Bandra West',
        city: 'Mumbai',
        price: '₹1,50,000/month',
        priceNumeric: 150000,
        size: '2500 sq ft',
        bhk: 4,
        features: ['Fully Furnished', 'Private Garden', 'Parking for 2 cars', 'Terrace'],
        amenities: ['Security', 'Power Backup', 'Garden', 'Terrace'],
        contact: 'Call +91-9876543212',
        featured: true,
        description: 'Premium villa with private garden and modern amenities',
        images: ['image5.jpg', 'image6.jpg'],
        available: true
      },
      {
        _id: 'sample4',
        title: 'Modern 1BHK Studio Apartment',
        type: '1bhk studio',
        location: 'Powai, Mumbai',
        area: 'Powai',
        city: 'Mumbai',
        price: '₹28,000/month',
        priceNumeric: 28000,
        size: '600 sq ft',
        bhk: 1,
        features: ['Furnished', 'AC', 'WiFi', 'Near IT Parks'],
        amenities: ['Security', 'Elevator', 'Gym'],
        contact: 'Call +91-9876543213',
        featured: false,
        description: 'Modern studio apartment perfect for working professionals',
        images: ['image7.jpg', 'image8.jpg'],
        available: true
      },
      {
        _id: 'sample5',
        title: 'Commercial Office Space',
        type: 'commercial office',
        location: 'BKC, Mumbai',
        area: 'BKC',
        city: 'Mumbai',
        price: '₹2,00,000/month',
        priceNumeric: 200000,
        size: '3000 sq ft',
        bhk: 0,
        features: ['Fully Furnished', 'Conference Rooms', 'Parking', 'Metro Access'],
        amenities: ['24/7 Security', 'Power Backup', 'Elevator', 'Cafeteria'],
        contact: 'Call +91-9876543214',
        featured: true,
        description: 'Premium office space in business district',
        images: ['image9.jpg', 'image10.jpg'],
        available: true
      }
    ];

    // Filter sample properties based on entities
    let filtered = sampleProperties;

    if (entities.propertyTypes && entities.propertyTypes.length > 0) {
      filtered = filtered.filter(property => 
        entities.propertyTypes.some(type => 
          property.type.toLowerCase().includes(type.toLowerCase())
        )
      );
    }

    if (entities.budget) {
      filtered = filtered.filter(property => {
        if (entities.budget.min && property.priceNumeric < entities.budget.min) return false;
        if (entities.budget.max && property.priceNumeric > entities.budget.max) return false;
        return true;
      });
    }

    if (entities.locations && entities.locations.length > 0) {
      filtered = filtered.filter(property =>
        entities.locations.some(location =>
          property.location.toLowerCase().includes(location.toLowerCase()) ||
          property.area.toLowerCase().includes(location.toLowerCase())
        )
      );
    }

    return filtered.length > 0 ? filtered : sampleProperties.slice(0, 3);
  }

  async getPropertyById(id) {
    try {
      const property = await Property.findById(id).lean();
      return property || this.getSampleProperties()[0];
    } catch (error) {
      logger.error('Error fetching property by ID:', error);
      return this.getSampleProperties()[0];
    }
  }

  async getFeaturedProperties(limit = 5) {
    try {
      const properties = await Property.find({ featured: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      
      return properties.length > 0 ? properties : this.getSampleProperties().slice(0, limit);
    } catch (error) {
      logger.error('Error fetching featured properties:', error);
      return this.getSampleProperties().slice(0, limit);
    }
  }

  clearCache() {
    this.cache.clear();
    logger.info('Property search cache cleared');
  }
}