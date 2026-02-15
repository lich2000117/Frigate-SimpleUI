const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { 
  getdevConfigConfig,
  updatedevConfigConfig
} = require('../utils/configManager');

/**
 * GET /api/devConfig
 * Get devConfig configuration
 */
router.get('/detector', async (req, res) => {
  try {
    const devConfigConfig = getdevConfigConfig();
    
    res.json({
      success: true,
      config: devConfigConfig
    });
  } catch (error) {
    logger.error(`Error fetching devConfig config: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error fetching devConfig config: ${error.message}`
    });
  }
});

/**
 * POST /api/devConfig
 * Update devConfig configuration
 */
router.post('/detector', async (req, res) => {
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
    
    // Update devConfig config
    updatedevConfigConfig({ enabled, type });
    
    res.json({
      success: true,
      message: 'devConfig configuration updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating devConfig config: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error updating devConfig config: ${error.message}`
    });
  }
});


/**
 * GET /api/devConfig
 * Get devConfig configuration
 */
router.get('/detector', async (req, res) => {
  try {
    const devConfigConfig = getdevConfigConfig();
    
    res.json({
      success: true,
      config: devConfigConfig
    });
  } catch (error) {
    logger.error(`Error fetching devConfig config: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error fetching devConfig config: ${error.message}`
    });
  }
});

/**
 * POST /api/devConfig
 * Update devConfig configuration
 */
router.post('/detector', async (req, res) => {
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
    
    // Update devConfig config
    updatedevConfigConfig({ enabled, type });
    
    res.json({
      success: true,
      message: 'devConfig configuration updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating devConfig config: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error updating devConfig config: ${error.message}`
    });
  }
});


/**
 * GET /api/devConfig
 * Get devConfig configuration
 */
router.get('/webrtc', async (req, res) => {
  try {
    const devConfigConfig = getdevConfigConfig();
    
    res.json({
      success: true,
      config: devConfigConfig
    });
  } catch (error) {
    logger.error(`Error fetching devConfig config: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error fetching devConfig config: ${error.message}`
    });
  }
});

/**
 * POST /api/devConfig
 * Update devConfig configuration
 */
router.post('/webrtc', async (req, res) => {
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
    
    // Update devConfig config
    updatedevConfigConfig({ enabled, type });
    
    res.json({
      success: true,
      message: 'devConfig configuration updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating devConfig config: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error updating devConfig config: ${error.message}`
    });
  }
});


module.exports = router; 