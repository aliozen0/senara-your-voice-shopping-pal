// Uygulama veri modelleri (JSDoc).

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {number} price
 * @property {string} imageUrl
 * @property {'trendyol'|'hepsiburada'|'n11'|'amazon'} store
 * @property {number} rating
 * @property {string} url
 * @property {string[]} images
 * @property {number} [reviewCount]
 */

/**
 * @typedef {Object} ReviewAnalysis
 * @property {string[]} positive
 * @property {string[]} negative
 * @property {string} sensoryDesc
 * @property {string} sizeAdvice
 * @property {number} score
 */

/**
 * @typedef {Object} PriceResult
 * @property {string} store
 * @property {number} price
 * @property {number} shipping
 * @property {string} url
 * @property {boolean} inStock
 */

/**
 * @typedef {Object} ConversationMessage
 * @property {'user'|'assistant'} role
 * @property {string} text
 * @property {number} timestamp
 */

/**
 * @typedef {Object} Intent
 * @property {string} query
 * @property {{ color?: string|null, size?: string|null, maxPrice?: number|null }} filters
 */

export {};
