require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { logger } = require('./utils/logger');
const { 
  loadConfig, 
  saveConfig, 
  restartService, 
  getAvailableDetectObjects,
  getCurrentConfigYAML
} = require('./utils/configManager');

// Load configuration
const config = require('./config');

// Global configuration
// Remove this, using the config module instead
// const SERVER_CONFIG = {
//   PORT: process.env.PORT || 3001,
//   FRIGATESIMPLEUI_URL: process.env.FRIGATESIMPLEUI_URL || 'http://192.168.199.3:5000'
// };

// Import routes
const camerasRouter = require('./routes/cameras');
const streamRouter = require('./routes/stream');
const scanRouter = require('./routes/scan');
const detectorRouter = require('./routes/detector');

const app = express();

// Configure CORS
app.use(cors({
  origin: config.server.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.text({ type: 'text/plain' }));

// API Routes
app.use('/api/cameras', camerasRouter);
app.use('/api/stream', streamRouter);
app.use('/api/scan', scanRouter);
app.use('/api/detector', detectorRouter);

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
    const response = await axios.post(config.frigatesimpleui.urls.saveConfig, yamlConfig, {
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
    const saveOption = req.query.save_option || 'save';
    
    // Make sure we have a config body
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Config with body param is required'
      });
    }

    // Get YAML config from request body (already as text/plain)
    const yamlConfig = req.body;
    
    // Forward to FrigateSimpleUI with the appropriate save_option
    const saveUrl = `${config.frigatesimpleui.url}/api/config/save?save_option=${saveOption}`;
    logger.info(`Saving config with option ${saveOption} to: ${saveUrl}`);

    // also restart go2rtc if save_option is restart
    if (saveOption === 'restart') {
      const go2rtcUrl = `${config.go2rtc.url}/api/restart`;
      logger.info(`Restarting go2rtc at: ${go2rtcUrl}`);
      await axios.post(go2rtcUrl, {}, {
        headers: {
          'Accept': 'application/json'
        }
      });
    }

    const response = await axios.post(saveUrl, yamlConfig, {
      headers: {
        'Content-Type': 'text/plain',
        'Accept': 'application/json'
      },
      maxBodyLength: Infinity
    });
    
    // Return the response from FrigateSimpleUI
    if (response.data && response.data.success) {
      res.json({ 
        success: true, 
        message: saveOption === 'restart' 
          ? 'Configuration saved and restart triggered (this can take up to one minute)...'
          : 'Configuration saved successfully'
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: response.data?.message || 'Failed to save configuration' 
      });
    }
  } catch (error) {
    logger.error('Error saving config:', error);
    
    // If we have validation errors, pass them through
    if (error.response && error.response.data) {
      res.status(400).json({ 
        success: false, 
        message: error.response.data.message || 'Failed to save configuration'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to save configuration'
      });
    }
  }
});

app.post('/api/config/restart', async (req, res) => {
  try {
    await restartService();
    res.json({ 
      success: true, 
      message: 'Service restart triggered successfully' 
    });
  } catch (error) {
    logger.error('Error restarting service:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to restart service' 
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

// For backward compatibility with older code
app.get('/api/save-and-restart/objects', async (req, res) => {
  try {
    const objects = await getAvailableDetectObjects();
    res.json({ success: true, objects });
  } catch (error) {
    logger.error('Error getting available objects:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get available objects' 
    });
  }
});

// Add a simple health check endpoint
app.get('/api/ping', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Add new endpoint to get current config as YAML
app.get('/api/config/yaml', async (req, res) => {
  try {
    // Get the current config as YAML
    const yamlConfig = getCurrentConfigYAML();
    
    // Send as plain text
    res.setHeader('Content-Type', 'text/plain');
    res.send(yamlConfig);
  } catch (error) {
    logger.error('Error generating YAML config:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate YAML configuration' 
    });
  }
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  // Set up static file serving with proper MIME types
  app.use(express.static(path.join(__dirname, '../client/build'), {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Set appropriate content types to avoid MIME type issues
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (filePath.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json');
      } else if (filePath.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (filePath.endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
      }
      
      // Set cache control headers for better performance
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }));
  
  // Handle all routes by sending the React app
  app.get('*', (req, res) => {
    // For any other route that doesn't match an API endpoint, serve the React app
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ success: false, message: 'Server error' });
});

// Add after the error handling middleware
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
  // Keep the server running despite the error
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);
  // Keep the server running despite the rejection
});

// Start server
app.listen(config.server.port, '0.0.0.0', () => {
  logger.info(`Server running on port ${config.server.port} in ${config.server.env} mode`);
  logger.info(`Connected to FrigateSimpleUI at ${config.frigatesimpleui.url}`);
  
  // Load initial configuration
  loadConfig()
    .then(() => logger.info('Initial configuration loaded'))
    .catch(err => logger.error('Failed to load initial configuration:', err));
});

module.exports = app; 