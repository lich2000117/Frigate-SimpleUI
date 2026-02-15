/**
 * Server Configuration
 * Centralized configuration for the server
 */
require('dotenv').config();

const config = {
  // Server settings
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS || '*'
  },
  
  // FrigateSimpleUI service settings
  frigatesimpleui: {
    url: process.env.FRIGATESIMPLEUI_URL || 'http://192.168.199.3:5000',
    endpoints: {
      // These are appended to the base URL
      config: '/api/config',
      configRaw: '/api/config/raw',
      saveConfig: '/api/config/save',
      restart: '/api/restart'
    },
  },

  // Go2RTC service settings
  go2rtc: {
    url: process.env.GO2RTC_URL || 'http://192.168.199.3:1984',
    endpoints: {
      restart: '/api/restart',
      streamCamera: '/stream.html?src=',
      getSnapshot: '/api/frame.jpeg?src='
    }
  },
  
  // Logging settings
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filename: process.env.LOG_FILE || 'server.log'
  }
};

// Computed properties
config.frigatesimpleui.urls = {
  config: `${config.frigatesimpleui.url}${config.frigatesimpleui.endpoints.config}`,
  configRaw: `${config.frigatesimpleui.url}${config.frigatesimpleui.endpoints.configRaw}`,
  saveConfig: `${config.frigatesimpleui.url}${config.frigatesimpleui.endpoints.saveConfig}`,
  restart: `${config.frigatesimpleui.url}${config.frigatesimpleui.endpoints.restart}`
};

module.exports = config; 