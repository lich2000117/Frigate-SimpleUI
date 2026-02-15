const express = require('express');
const router = express.Router();
const validator = require('validator');
const { logger } = require('../utils/logger');
const { 
  getCameras, 
  addOrUpdateCamera, 
  removeCamera,
  loadConfig 
} = require('../utils/configManager');

/**
 * GET /api/cameras
 * Returns all configured cameras
 */
router.get('/', async (req, res) => {
  try {
    const cameras = await getCameras();
    res.json({ success: true, cameras });
  } catch (error) {
    logger.error('Error getting cameras:', error);
    res.status(500).json({ success: false, message: 'Failed to get cameras', error: error.message });
  }
});

/**
 * POST /api/cameras
 * Adds or updates a camera
 */
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      rtspUrl, 
      subStreamUrl, 
      objectsToTrack, 
      detectWidth, 
      detectHeight, 
      recordEnabled, 
      recordRetainMode, 
      recordRetainDays,
      forceH264,
      enableAac,
      enableOpus,
      customCameraUrl
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ success: false, message: 'Camera name is required' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return res.status(400).json({ success: false, message: 'Camera name can only contain letters, numbers, and underscores' });
    }

    if (name.length > 32) {
      return res.status(400).json({ success: false, message: 'Camera name must be 32 characters or less' });
    }

    // If custom URL is provided, don't require RTSP URL
    if (!customCameraUrl && !rtspUrl) {
      return res.status(400).json({ success: false, message: 'RTSP URL or Custom URL is required' });
    }

    const cameraData = {
      name,
      rtspUrl: rtspUrl || '',
      subStreamUrl: subStreamUrl || '',
      objectsToTrack: objectsToTrack || ['person', 'car'],
      detectWidth: parseInt(detectWidth) || 1024,
      detectHeight: parseInt(detectHeight) || 768,
      recordEnabled: recordEnabled !== false,
      recordRetainMode: recordRetainMode || 'motion',
      recordRetainDays: parseInt(recordRetainDays) || 7,
      forceH264: forceH264 === true,
      enableAac: enableAac === true,
      enableOpus: enableOpus === true,
      customCameraUrl: customCameraUrl || ''
    };

    logger.info(`Adding/updating camera with codec options: H264=${cameraData.forceH264}, AAC=${cameraData.enableAac}, OPUS=${cameraData.enableOpus}, CustomURL=${cameraData.customCameraUrl || 'none'}`);
    
    await addOrUpdateCamera(cameraData);
    res.json({ success: true, message: 'Camera added/updated successfully' });
  } catch (error) {
    logger.error('Error adding/updating camera:', error);
    res.status(500).json({ success: false, message: 'Failed to add/update camera', error: error.message });
  }
});

/**
 * DELETE /api/cameras/:name
 * Removes a camera by name
 */
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Camera name is required' });
    }
    
    const result = await removeCamera(name);
    
    if (!result) {
      return res.status(404).json({ success: false, message: 'Camera not found or could not be removed' });
    }
    
    res.json({ success: true, message: 'Camera removed successfully' });
  } catch (error) {
    logger.error('Error removing camera:', error);
    res.status(500).json({ success: false, message: 'Failed to remove camera', error: error.message });
  }
});

/**
 * POST /api/cameras/reload
 * Reload all cameras from the configuration file
 */
router.post('/reload', async (req, res) => {
  try {
    await loadConfig();
    res.json({ 
      success: true, 
      message: 'Cameras reloaded successfully' 
    });
  } catch (error) {
    logger.error(`Error reloading cameras: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Failed to reload cameras: ${error.message}` 
    });
  }
});

module.exports = router; 