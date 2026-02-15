import axios from 'axios';

// Server configuration - MODIFY THESE FOR DIFFERENT ENVIRONMENTS
const API_CONFIG = {
  // For development with React proxy: leave empty
  // For direct server: e.g. 'http://localhost:3001'
  // For production: e.g. 'http://your-server-ip:3001'
  SERVER_URL: '',
  
  // API path prefix - DO NOT include leading slash when using with SERVER_URL
  API_PATH: 'api',
  
  // Timeout in milliseconds
  TIMEOUT: 15000
};

// Construct the base URL properly to avoid double slashes
const getBaseUrl = () => {
  // When running under Home Assistant Ingress or other proxies,
  // we need to detect the current path and use it as our base
  const currentPath = window.location.pathname;
  
  if (!API_CONFIG.SERVER_URL) {
    // Extract the base path (everything up to the last slash)
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    // Append the API_PATH to the base path
    return `${basePath}${API_CONFIG.API_PATH}`;
  }
  
  // When connecting to server directly with a specific URL
  const baseUrl = API_CONFIG.SERVER_URL.endsWith('/') 
    ? API_CONFIG.SERVER_URL.slice(0, -1) 
    : API_CONFIG.SERVER_URL;
  
  return `${baseUrl}/${API_CONFIG.API_PATH}`;
};

// Export for components that need the server address (like RtspPlayer)
export const SERVER_URL = API_CONFIG.SERVER_URL;
export const API_BASE_URL = getBaseUrl();

// Setup axios instance with base URL and timeouts
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Log the actual base URL being used (for debugging)
console.log('API is using base URL:', API_BASE_URL);

// Add a response interceptor to handle errors globally
apiClient.interceptors.response.use(
  response => response,
  error => {
    // Log the error
    console.error('API request failed:', error.message);
    
    // If it's a network error (server down or unreachable)
    if (error.message.includes('Network Error') || error.code === 'ECONNABORTED') {
      console.error('Server connection failed - ensure the server is running on port 3001');
      return Promise.resolve({
        data: {
          success: false,
          message: 'Cannot connect to server. Please ensure the server is running.',
          isConnectionError: true
        }
      });
    }
    
    return Promise.reject(error);
  }
);

/**
 * Fetch all cameras
 * @returns {Promise<Object>} Response with cameras array or error
 */
export const getCameras = async () => {
  try {
    const response = await apiClient.get('/cameras');
    return response.data;
  } catch (error) {
    console.error('Error fetching cameras:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch cameras',
      error: error.message
    };
  }
};

/**
 * Add or update a camera
 * @param {Object} cameraData - Camera configuration data
 * @returns {Promise<Object>} Response with success status
 */
export const addOrUpdateCamera = async (cameraData) => {
  try {
    const response = await apiClient.post('/cameras', cameraData);
    return response.data;
  } catch (error) {
    console.error('Error saving camera:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to save camera',
      error: error.message
    };
  }
};

/**
 * Remove a camera by name
 * @param {string} name - Camera name
 * @returns {Promise<Object>} Response with success status
 */
export const removeCamera = async (name) => {
  try {
    const response = await apiClient.delete(`/cameras/${name}`);
    return response.data;
  } catch (error) {
    console.error('Error removing camera:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to remove camera',
      error: error.message
    };
  }
};

/**
 * Test a stream URL
 * @param {string} streamUrl - RTSP URL to test
 * @returns {Promise<Object>} Response with stream test result
 */
export const testStream = async (camName, streamUrl) => {
  try {
    const response = await apiClient.get('/stream/test', { params: { camName, url: streamUrl } });
    return response.data;
  } catch (error) {
    console.error('Error testing stream:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to test stream',
      error: error.message
    };
  }
};

/**
 * Save configuration and restart services
 * @returns {Promise<Object>} Response with success status
 */
export const saveAndRestart = async () => {
  try {
    // First save the config
    const saveResponse = await apiClient.post('/config/save');
    
    // Then restart the service
    if (saveResponse.data.success) {
      const restartResponse = await apiClient.post('/config/restart');
      return restartResponse.data;
    }
    
    return saveResponse.data;
  } catch (error) {
    console.error('Error saving config and restarting:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to save and restart',
      error: error.message
    };
  }
};

/**
 * Get YAML config in plain text for display
 * @returns {Promise<Object>} Response with YAML config
 */
export const getYamlConfig = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/config/yaml`, {
      headers: {
        'Accept': 'text/plain'
      },
      responseType: 'text'
    });
    
    return {
      success: true,
      yaml: response.data
    };
  } catch (error) {
    console.error('Error fetching YAML config:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch YAML configuration',
      error: error.message
    };
  }
};

/**
 * Save configuration with optional restart
 * @param {boolean} restart - Whether to restart after saving
 * @returns {Promise<Object>} Response with success status
 */
export const saveConfig = async (restart = false) => {
  try {
    // The save_option parameter needs to be included as a query parameter
    const saveOption = restart ? 'restart' : 'save';
    const response = await axios.post(`${API_BASE_URL}/config/save?save_option=${saveOption}`, 
      // Send the YAML as text/plain in the body - this matches the API expectation
      await getCurrentConfigYAML(), 
      {
        headers: {
          'Content-Type': 'text/plain',
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error saving config:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to save configuration',
      error: error.message
    };
  }
};

/**
 * Restart the service
 * @returns {Promise<Object>} Response with success status
 */
export const restartService = async () => {
  try {
    const response = await apiClient.post('/config/restart');
    return response.data;
  } catch (error) {
    console.error('Error restarting service:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to restart service',
      error: error.message
    };
  }
};

/**
 * Get raw YAML config
 * @returns {Promise<Object>} Response with YAML config
 */
export const getRawConfig = async () => {
  try {
    const response = await apiClient.get('/config/raw');
    return {
      success: true,
      yaml: response.data
    };
  } catch (error) {
    console.error('Error fetching raw config:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch raw configuration',
      error: error.message
    };
  }
};

/**
 * Get available detection objects
 * @returns {Promise<Object>} Response with available objects
 */
export const getAvailableDetectObjects = async () => {
  try {
    const response = await apiClient.get('/config/objects');
    return {
      success: true,
      objects: response.data
    };
  } catch (error) {
    console.error('Error fetching available objects:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch available objects',
      error: error.message
    };
  }
};

/**
 * Reload configuration from disk
 * @returns {Promise<Object>} Response with success status
 */
export const reloadConfig = async () => {
  try {
    const response = await apiClient.post('/config/reload');
    return response.data;
  } catch (error) {
    console.error('Error reloading config:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to reload configuration',
      error: error.message
    };
  }
};

/**
 * Get available network interfaces
 * @returns {Promise<Object>} Response with interfaces array
 */
export const getNetworkInterfaces = async () => {
  try {
    const response = await apiClient.get('/scan/interfaces');
    return response.data;
  } catch (error) {
    console.error('Error getting network interfaces:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to get network interfaces',
      error: error.message
    };
  }
};

/**
 * Scan network for all ONVIF cameras without subnet filtering
 * @returns {Promise<Object>} Response with discovered devices
 */
export const scanAllDevices = async () => {
  try {
    const response = await apiClient.post('/scan/all');
    return response.data;
  } catch (error) {
    console.error('Error scanning for devices:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to scan for devices',
      error: error.message
    };
  }
};

/**
 * Get stream URLs from an ONVIF device
 * @param {string} ip - IP address of the device
 * @param {string} onvifUrl - ONVIF URL of the device
 * @param {string} username - Username for authentication
 * @param {string} password - Password for authentication
 * @returns {Promise<Object>} Response with stream URLs
 */
export const getStreamUrls = async (ip, onvifUrl, username, password) => {
  try {
    const response = await apiClient.get('/scan/streams', {
      params: { ip, onvifUrl, username, password }
    });
    return response.data;
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to get stream URLs',
      error: error.message
    };
  }
};

// Add after the API_BASE_URL declaration
// Simple health check endpoint to verify server connection
export const checkServerConnection = async () => {
  try {
    // Use a short timeout for quick feedback
    const response = await axios.get(`${API_BASE_URL}/ping`, { timeout: 2000 });
    return { 
      connected: true,
      data: response.data
    };
  } catch (error) {
    console.error('Server connection check failed:', error.message);
    return { 
      connected: false,
      message: 'Cannot connect to server'
    };
  }
};

/**
 * Helper function to get current YAML config for saving
 * @returns {Promise<string>} YAML config as string
 */
const getCurrentConfigYAML = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/config/yaml`, {
      headers: { 'Accept': 'text/plain' },
      responseType: 'text'
    });
    return response.data;
  } catch (error) {
    console.error('Error getting current YAML config:', error);
    throw error;
  }
};

/**
 * Check FrigateSimpleUI server status
 * @returns {Promise<Object>} Response indicating if FrigateSimpleUI server is running
 */
export const checkFrigateSimpleUIStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/stream/frigatesimpleui-status`);
    return await response.json();
  } catch (error) {
    console.error('Error checking FrigateSimpleUI status:', error);
    return {
      success: false,
      status: 'error',
      message: 'Failed to check FrigateSimpleUI server status'
    };
  }
};

/**
 * Get camera snapshot URL
 * @param {string} cameraName - The name of the camera
 * @param {string} rtspUrl - Optional RTSP URL for fallback
 * @returns {string} URL for the camera snapshot
 */
export const getCameraSnapshotUrl = (cameraName, rtspUrl = '') => {
  const baseUrl = `${API_BASE_URL}/stream/snapshot/${encodeURIComponent(cameraName)}`;
  const queryParams = [`key=${Date.now()}`];
  
  // Add rtspUrl as a query parameter if provided
  if (rtspUrl) {
    queryParams.push(`rtspUrl=${encodeURIComponent(rtspUrl)}`);
  }
  
  return `${baseUrl}?${queryParams.join('&')}`;
};

/**
 * Test a camera stream and get a snapshot if successful
 * @param {string} camName - The name of the camera
 * @param {string} streamUrl - The RTSP URL to test
 * @returns {Promise<Object>} Response with test result and snapshot url if successful
 */
export const testStreamWithSnapshot = async (camName, streamUrl) => {
  try {
    // First test if the stream is accessible
    const response = await fetch(`${API_BASE_URL}/stream/test?camName=${encodeURIComponent(camName)}&url=${encodeURIComponent(streamUrl)}`);
    const data = await response.json();
    
    if (data.success && data.isAccessible) {
      // If stream is accessible, include the snapshot URL
      return {
        success: true,
        isAccessible: true,
        snapshotUrl: getCameraSnapshotUrl(camName, streamUrl),
        message: 'Stream is accessible'
      };
    }
    
    return {
      success: true,
      isAccessible: false,
      message: 'Stream is not accessible'
    };
  } catch (error) {
    console.error('Error testing stream:', error);
    return {
      success: false,
      isAccessible: false,
      message: `Failed to test stream: ${error.message}`
    };
  }
};

/**
 * Check if a camera name already exists (case-insensitive)
 * @param {string} cameraName - The name to check
 * @param {string} excludeCamera - Optional camera name to exclude from check (for edit mode)
 * @returns {Promise<boolean>} True if camera name exists, false otherwise
 */
export const checkCameraNameExists = async (cameraName, excludeCamera = '') => {
  try {
    const response = await getCameras();
    
    if (response.success) {
      return response.cameras.some(camera => 
        camera.name.toLowerCase() === cameraName.toLowerCase() && 
        camera.name.toLowerCase() !== excludeCamera.toLowerCase()
      );
    }
    
    return false;
  } catch (error) {
    console.error('Error checking camera name:', error);
    return false;
  }
};

/**
 * Check if a RTSP URL already exists (exact match)
 * @param {string} rtspUrl - The RTSP URL to check
 * @param {string} excludeCamera - Optional camera name to exclude from check (for edit mode)
 * @returns {Promise<boolean>} True if URL exists, false otherwise
 */
export const checkRtspUrlExists = async (rtspUrl, excludeCamera = '') => {
  try {
    if (!rtspUrl) return false;
    
    const response = await getCameras();
    
    if (response.success) {
      return response.cameras.some(camera => 
        camera.rtspUrl === rtspUrl && 
        camera.name.toLowerCase() !== excludeCamera.toLowerCase()
      );
    }
    
    return false;
  } catch (error) {
    console.error('Error checking RTSP URL:', error);
    return false;
  }
};

/**
 * Get the current detector configuration
 */
export const getDetectorConfig = async () => {
  try {
    const response = await apiClient.get('/detector');
    return response.data;
  } catch (error) {
    console.error('Error fetching detector config:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to fetch detector configuration',
      error: error.message
    };
  }
};

/**
 * Update the detector configuration
 * @param {Object} config - Detector configuration
 * @param {boolean} config.enabled - Whether the coral detector is enabled
 * @param {string} config.type - Device type ('pci' or 'usb')
 */
export const updateDetectorConfig = async (config) => {
  try {
    const response = await apiClient.post('/detector', config);
    return response.data;
  } catch (error) {
    console.error('Error updating detector config:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to update detector configuration',
      error: error.message
    };
  }
};

export default {
  getCameras,
  addOrUpdateCamera,
  removeCamera,
  testStream,
  saveAndRestart,
  getYamlConfig,
  saveConfig,
  restartService,
  getRawConfig,
  getAvailableDetectObjects,
  reloadConfig,
  getNetworkInterfaces,
  scanAllDevices,
  getStreamUrls
}; 