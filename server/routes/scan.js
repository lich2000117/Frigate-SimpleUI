const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { 
  getNetworkInterfaces, 
  scanAllDevices,
  getStreamUrls
} = require('../utils/networkScanner');

/**
 * GET /api/scan/interfaces
 * Get all available network interfaces
 */
router.get('/interfaces', (req, res) => {
  try {
    const interfaces = getNetworkInterfaces();
    res.json({ success: true, interfaces });
  } catch (error) {
    logger.error(`Error getting network interfaces: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Failed to get network interfaces: ${error.message}` 
    });
  }
});

/**
 * POST /api/scan/all
 * Scan for all ONVIF devices without subnet filtering
 */
router.post('/all', async (req, res) => {
  try {
    // Run a global ONVIF scan without interface filtering
    const allDevices = await scanAllDevices();
    
    logger.info(`Found ${allDevices.length} ONVIF devices on the network`);
    
    res.json({ success: true, devices: allDevices });
  } catch (error) {
    logger.error(`Error scanning for devices: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Failed to scan for devices: ${error.message}` 
    });
  }
});

/**
 * GET /api/scan/streams
 * Get stream URLs and capabilities from an ONVIF device
 */
router.get('/streams', async (req, res) => {
  try {
    const { ip, onvifUrl, username = '', password = '' } = req.query;
    
    if (!ip || !onvifUrl) {
      return res.status(400).json({
        success: false,
        message: 'Device IP and ONVIF URL are required'
      });
    }
    
    logger.info(`Stream URL request for ${ip} with username ${username || '(none)'}`);
    
    try {
      const response = await getStreamUrls(ip, onvifUrl, username, password);
      
      // The response now contains both streams and capabilities
      res.json({ 
        success: true, 
        streams: response.streams,
        capabilities: response.capabilities
      });
    } catch (error) {
      logger.error(`Error getting stream URLs: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: `Failed to get stream URLs: ${error.message}` 
      });
    }
  } catch (error) {
    logger.error(`Error in stream URL endpoint: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Server error: ${error.message}` 
    });
  }
});

module.exports = router; 