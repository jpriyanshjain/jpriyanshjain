import React from 'react';
import { MapPin, Home, Car, Wifi, Shield, Phone } from 'lucide-react';

const PropertyCard = ({ property }) => {
  const getPropertyIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'apartment':
      case 'flat':
        return <Home size={16} className="text-primary-600" />;
      case 'villa':
      case 'house':
        return <Home size={16} className="text-green-600" />;
      case 'commercial':
      case 'office':
        return <Home size={16} className="text-blue-600" />;
      default:
        return <Home size={16} className="text-gray-600" />;
    }
  };

  const getFeatureIcon = (feature) => {
    const featureLower = feature.toLowerCase();
    if (featureLower.includes('parking')) return <Car size={14} />;
    if (featureLower.includes('wifi')) return <Wifi size={14} />;
    if (featureLower.includes('security')) return <Shield size={14} />;
    return null;
  };

  const handleContactClick = () => {
    // Handle contact action (could open phone dialer, WhatsApp, etc.)
    if (property.contact) {
      console.log('Contact clicked:', property.contact);
    }
  };

  const handleViewDetails = () => {
    // Handle view details action
    console.log('View details clicked:', property._id);
  };

  return (
    <div className="property-card bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:border-primary-300">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getPropertyIcon(property.type)}
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">
            {property.title}
          </h3>
        </div>
        {property.featured && (
          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
            Featured
          </span>
        )}
      </div>

      {/* Location */}
      <div className="flex items-center space-x-1 text-gray-600 mb-2">
        <MapPin size={14} />
        <span className="text-sm">{property.location}</span>
      </div>

      {/* Property Details */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
        <div>
          <span className="text-gray-500">Type:</span>
          <span className="ml-1 font-medium capitalize">{property.type}</span>
        </div>
        <div>
          <span className="text-gray-500">Size:</span>
          <span className="ml-1 font-medium">{property.size}</span>
        </div>
      </div>

      {/* Price */}
      <div className="mb-3">
        <span className="text-lg font-bold text-primary-600">{property.price}</span>
        {property.priceType && (
          <span className="text-sm text-gray-500 ml-1">
            ({property.priceType === 'rent' ? 'per month' : 'total'})
          </span>
        )}
      </div>

      {/* Features */}
      {property.features && property.features.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {property.features.slice(0, 3).map((feature, index) => (
              <span
                key={index}
                className="inline-flex items-center space-x-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
              >
                {getFeatureIcon(feature)}
                <span>{feature}</span>
              </span>
            ))}
            {property.features.length > 3 && (
              <span className="text-xs text-gray-500">
                +{property.features.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      {property.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {property.description}
        </p>
      )}

      {/* Actions */}
      <div className="flex space-x-2 pt-2 border-t border-gray-100">
        <button
          onClick={handleViewDetails}
          className="flex-1 bg-primary-50 text-primary-600 text-sm py-2 px-3 rounded hover:bg-primary-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
        >
          View Details
        </button>
        {property.contact && (
          <button
            onClick={handleContactClick}
            className="flex items-center space-x-1 bg-green-50 text-green-600 text-sm py-2 px-3 rounded hover:bg-green-100 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
          >
            <Phone size={14} />
            <span>Contact</span>
          </button>
        )}
      </div>

      {/* Availability Status */}
      {property.available !== undefined && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                property.available ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
            <span className="text-xs text-gray-500">
              {property.available ? 'Available' : 'Not Available'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyCard;