const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { 
  getDetectorConfig,
  updateDetectorConfig
} = require('../utils/configManager');

/**
 * GET /api/detector
 * Get detector configuration
 */
router.get('/', async (req, res) => {
  try {
    const detectorConfig = getDetectorConfig();
    
    res.json({
      success: true,
      config: detectorConfig
    });
  } catch (error) {
    logger.error(`Error fetching detector config: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error fetching detector config: ${error.message}`
    });
  }
});

/**
 * POST /api/detector
 * Update detector configuration
 */
router.post('/', async (req, res) => {
  try {
    const { enabled, type } = req.body;
    
    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled must be a boolean'
      });
    }
    
    if (type !== 'pci' && type !== 'usb') {
      return res.status(400).json({
        success: false,
        message: 'type must be either "pci" or "usb"'
      });
    }
    
    // Update detector config
    updateDetectorConfig({ enabled, type });
    
    res.json({
      success: true,
      message: 'Detector configuration updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating detector config: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error updating detector config: ${error.message}`
    });
  }
});

module.exports = router; 