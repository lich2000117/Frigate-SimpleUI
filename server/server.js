const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const { logger } = require('./utils/logger');
const camerasRouter = require('./routes/cameras');
const streamRouter = require('./routes/stream');
const scanRouter = require('./routes/scan');
const { 
  loadConfig, 
  saveConfig, 
  getAvailableDetectObjects 
} = require('./utils/configManager');

// Remote config endpoints
const FRIGATESIMPLEUI_URL = process.env.FRIGATESIMPLEUI_URL || 'http://192.168.199.3:5000';
const REMOTE_SAVE_CONFIG_URL = `${FRIGATESIMPLEUI_URL}/api/config/save?save_option=save`;

const app = express();
const PORT = process.env.PORT || 3333;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));
app.use(express.static(path.join(__dirname, '../client/build')));

// API routes
app.use('/api/cameras', camerasRouter);
app.use('/api/stream', streamRouter);
app.use('/api/scan', scanRouter);

// Configuration endpoints
app.get('/api/config/raw', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json(config);
  } catch (error) {
    logger.error('Error getting raw config:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get config' 
    });
  }
});

app.post('/api/config/raw', async (req, res) => {
  try {
    const yamlConfig = req.body;
    
    if (!yamlConfig) {
      return res.status(400).json({
        success: false,
        message: 'YAML configuration is required'
      });
    }
    
    // Use the remote config endpoint to save the raw YAML
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
        message: 'Raw configuration saved successfully' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: response.data?.message || 'Failed to save raw configuration' 
      });
    }
  } catch (error) {
    logger.error('Error saving raw config:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save raw configuration' 
    });
  }
});

app.post('/api/config/save', async (req, res) => {
  try {
    await saveConfig();
    res.json({ 
      success: true, 
      message: 'Configuration saved successfully' 
    });
  } catch (error) {
    logger.error('Error saving config:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save configuration' 
    });
  }
});

app.post('/api/config/reload', async (req, res) => {
  try {
    await loadConfig();
    res.json({ 
      success: true, 
      message: 'Configuration reloaded successfully' 
    });
  } catch (error) {
    logger.error('Error reloading config:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reload configuration' 
    });
  }
});

app.get('/api/config/objects', async (req, res) => {
  try {
    const objects = await getAvailableDetectObjects();
    res.json(objects);
  } catch (error) {
    logger.error('Error getting available objects:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get available objects' 
    });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0',() => {
  logger.info(`Server running on port ${PORT}`);
  
  // Load initial configuration
  loadConfig()
    .then(() => logger.info('Initial configuration loaded'))
    .catch(err => logger.error('Failed to load initial configuration:', err));
}); 