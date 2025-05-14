/**
 * Utility functions for handling Map data structures and MongoDB Map types
 */

/**
 * Process the contributionsToNextInLine map for API response
 * Converts Map to plain object and handles various data formats
 * 
 * @param {Map|Object} contributionsMap - Map or object containing contribution data
 * @returns {Object} - Plain JavaScript object with numeric values
 */
function processContributionsMap(contributionsMap) {
  // If it's undefined/null, return empty object
  if (!contributionsMap) {
    return {};
  }
  
  // Create a plain object to store the processed values
  const plainObject = {};
  
  try {
    // Handle native JavaScript Map objects
    if (contributionsMap instanceof Map) {
      contributionsMap.forEach((value, key) => {
        // Convert MongoDB Decimal128 or other objects with toString() to numbers
        plainObject[key] = typeof value === 'object' && value.toString ? 
          parseFloat(value.toString()) : Number(value);
      });
      return plainObject;
    }
    
    // Handle MongoDB MapType objects with entries() method
    if (typeof contributionsMap.entries === 'function') {
      try {
        for (const [key, value] of contributionsMap.entries()) {
          // Convert MongoDB Decimal128 or other objects with toString() to numbers
          plainObject[key] = typeof value === 'object' && value.toString ? 
            parseFloat(value.toString()) : Number(value);
        }
        return plainObject;
      } catch (entriesError) {
        console.warn('Error using entries() method:', entriesError.message);
        // Fall through to next approach if entries() fails
      }
    }
    
    // Handle MongoDB object representation of Maps (BSON format)
    if (contributionsMap && typeof contributionsMap === 'object' && contributionsMap.constructor === Object) {
      // For plain objects that represent maps from MongoDB
      Object.keys(contributionsMap).forEach(key => {
        const value = contributionsMap[key];
        
        // Handle MongoDB Decimal128 type (has valueOf method)
        if (value && typeof value === 'object' && value.valueOf) {
          try {
            plainObject[key] = parseFloat(value.toString());
          } catch (e) {
            plainObject[key] = 0;
          }
        } 
        // Handle normal numeric values
        else {
          plainObject[key] = Number(value) || 0;
        }
      });
      return plainObject;
    }
    
    // Handle MongoDB document that might have been converted to toObject() already
    if (contributionsMap && typeof contributionsMap.toObject === 'function') {
      const obj = contributionsMap.toObject({ getters: true });
      return processContributionsMap(obj); // Recursively process the plain object
    }
  } catch (error) {
    console.error('Error processing contributionsMap:', error);
    // In case of any error, return an empty object rather than failing
    return {};
  }
  
  // If we reached here, log the format for debugging
  console.warn('Unknown contributionsToNextInLine format:', 
    typeof contributionsMap, 
    contributionsMap ? Object.getPrototypeOf(contributionsMap).constructor.name : 'null');
    
  // Return the original as a last resort, but attempt to coerce values to numbers
  if (typeof contributionsMap === 'object') {
    try {
      Object.keys(contributionsMap).forEach(key => {
        plainObject[key] = Number(contributionsMap[key]) || 0;
      });
      return plainObject;
    } catch (e) {
      // If all else fails, return empty object
      return {};
    }
  }
  
  return {};
}

module.exports = {
  processContributionsMap
};
