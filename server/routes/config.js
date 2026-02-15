const express = require('express');
const router = express.Router();
const axios = require('axios');
const { logger } = require('../utils/logger');
const { 
  saveAndRestart,
  saveConfig,
  getAvailableDetectObjects,
  getCurrentConfigYAML,
  loadConfig
} = require('../utils/configManager');

// Need to get the REMOTE_SAVE_CONFIG_URL constant for the YAML endpoint
const FRIGATESIMPLEUI_URL = process.env.FRIGATESIMPLEUI_URL || 'http://192.168.199.3:5000';
const REMOTE_SAVE_CONFIG_URL = `${FRIGATESIMPLEUI_URL}/api/config/save?save_option=save`;

/**
 * POST /api/save-and-restart
 * Save the current configuration and restart FrigateSimpleUI
 */
router.post('/', async (req, res) => {
  try {
    logger.info('Saving configuration and restarting FrigateSimpleUI');
    const result = await saveAndRestart();
    
    if (result) {
      res.json({ 
        success: true, 
        message: 'Configuration saved and restart triggered' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to save configuration or restart FrigateSimpleUI' 
      });
    }
  } catch (error) {
    logger.error(`Error saving configuration and restarting: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Failed to save and restart: ${error.message}` 
    });
  }
});

/**
 * POST /api/save-and-restart/save
 * Save the current configuration without restarting
 */
router.post('/save', async (req, res) => {
  try {
    logger.info('Saving configuration without restart');
    const result = await saveConfig();
    
    if (result) {
      res.json({ 
        success: true, 
        message: 'Configuration saved successfully' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to save configuration' 
      });
    }
  } catch (error) {
    logger.error(`Error saving configuration: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Failed to save: ${error.message}` 
    });
  }
});

/**
 * GET /api/save-and-restart/objects
 * Get available objects for detection
 */
router.get('/objects', async (req, res) => {
  try {
    const objects = getAvailableDetectObjects();
    res.json({ 
      success: true, 
      objects: objects 
    });
  } catch (error) {
    logger.error(`Error getting available objects: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Failed to get objects: ${error.message}` 
    });
  }
});

/**
 * GET /api/save-and-restart/yaml
 * Get current configuration as YAML
 */
router.get('/yaml', async (req, res) => {
  try {
    const yaml = getCurrentConfigYAML();
    res.json({ 
      success: true, 
      yaml: yaml 
    });
  } catch (error) {
    logger.error(`Error getting configuration YAML: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Failed to get YAML: ${error.message}` 
    });
  }
});

/**
 * POST /api/save-and-restart/yaml
 * Save custom YAML configuration
 */
router.post('/yaml', async (req, res) => {
  try {
    const yamlConfig = req.body.yaml;
    if (!yamlConfig) {
      return res.status(400).json({
        success: false,
        message: 'No YAML configuration provided'
      });
    }

    logger.info('Saving custom YAML configuration');
    
    // For now, we'll just post directly to the remote endpoint
    const response = await axios.post(REMOTE_SAVE_CONFIG_URL, yamlConfig, {
      headers: {
        'Content-Type': 'text/plain',
        'Accept': 'application/json'
      },
      maxBodyLength: Infinity
    });

    if (response.data && response.data.success) {
      res.json({ 
        success: true, 
        message: 'Custom configuration saved successfully' 
      });
      
      // After saving custom YAML, reload our configuration to get the latest state
      await loadConfig();
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to save custom configuration' 
      });
    }
  } catch (error) {
    logger.error(`Error saving custom YAML: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Failed to save custom YAML: ${error.message}` 
    });
  }
});

/**
 * POST /api/save-and-restart/reload
 * Reload the configuration from the server
 */
router.post('/reload', async (req, res) => {
  try {
    logger.info('Reloading configuration from server');
    await loadConfig();
    
    res.json({ 
      success: true, 
      message: 'Configuration reloaded successfully' 
    });
  } catch (error) {
    logger.error(`Error reloading configuration: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Failed to reload configuration: ${error.message}` 
    });
  }
});

module.exports = router; 