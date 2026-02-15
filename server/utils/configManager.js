// configManager.js
const axios = require('axios');
const yaml = require('js-yaml');
const { logger } = require('./logger');
const config = require('../config');

// Store available objects for detection from the model
let availableDetectObjects = [];

// This is our target config structure based on the correct format
const baseConfigSkeleton = {
  mqtt: {
    enabled: true,
    host: process.env.MQTT_HOST || '192.168.199.2',
    port: parseInt(process.env.MQTT_PORT) || 1883,
    topic_prefix: 'frigate',
    client_id: 'frigate',
    user: process.env.MQTT_USER || 'mqtt-user',
    password: process.env.MQTT_PASSWORD || 'mqttpassword'
  },
  go2rtc: {
    streams: {},
    webrtc: {
      candidates: (process.env.WEBRTC_CANDIDATES || 'localhost:8555,192.168.199.3:8555,127.0.0.1:8555,stun:8555').split(','),
      listen: process.env.WEBRTC_LISTEN || ':8555/tcp'
    }
  },
  detectors: {
    coral: {
      type: process.env.DETECTOR_TYPE || 'edgetpu',
      device: process.env.DETECTOR_DEVICE || 'pci'
    }
  },
  ffmpeg: {
    input_args: 'preset-rtsp-restream',
    output_args: {
      record: 'preset-record-generic-audio-copy'
    }
  },
  cameras: {}
  // Version field will be added at the end through our custom YAML formatting
};

// We'll store an **in-memory** array of cameras
// e.g. [{ name, rtspUrl, subStreamUrl, detectWidth, detectHeight, recordEnabled, ... }, ...]
let inMemoryCameras = [];

// Store detector configuration
let detectorConfig = {
  enabled: true,
  type: 'pci'
};

/**
 * 1) Load the current config from Frigate using the raw endpoint
 * 2) Parse the YAML content
 * 3) Extract available objects, camera details, and other config
 * 4) Populate inMemoryCameras so we can see/edit them
 */
async function loadConfig() {
  try {
    logger.info(`Loading raw config from: ${config.frigatesimpleui.urls.configRaw}`);
    const response = await axios.get(config.frigatesimpleui.urls.configRaw, {
      headers: { Accept: 'text/plain' }
    });

    // Response will be raw YAML text, we need to parse it
    const yamlContent = response.data;
    const remoteConfig = yaml.load(yamlContent);
    
    logger.info('Successfully fetched and parsed raw config.');
    // Clear our inMemoryCameras
    inMemoryCameras = [];

    // We still need to fetch available objects from the filtered config endpoint
    await fetchAvailableObjects();
    
    // Extract detector configuration if present
    if (remoteConfig && remoteConfig.detectors && remoteConfig.detectors.coral) {
      const coralConfig = remoteConfig.detectors.coral;
      detectorConfig = {
        enabled: true,
        type: coralConfig.device || 'pci'
      };
      logger.info(`Loaded detector configuration: enabled=true, type=${detectorConfig.type}`);
    } else {
      detectorConfig = { enabled: false, type: 'pci' };
      logger.info('Coral detector not found in config, setting to disabled');
    }

    // Attempt to parse cameras from the remote config
    if (remoteConfig && remoteConfig.cameras) {
      for (const cameraName of Object.keys(remoteConfig.cameras)) {
        const camObj = remoteConfig.cameras[cameraName];
        
        // Find the RTSP URL with credentials intact from go2rtc or ffmpeg inputs
        let rtspUrl = findRtspUrl(remoteConfig, cameraName);
        let subStreamUrl = findSubStreamUrl(remoteConfig, cameraName);
        
        // Check for custom URL instead of RTSP URL
        let customCameraUrl = '';
        if (
          remoteConfig.go2rtc && 
          remoteConfig.go2rtc.streams && 
          remoteConfig.go2rtc.streams[cameraName] && 
          Array.isArray(remoteConfig.go2rtc.streams[cameraName]) && 
          remoteConfig.go2rtc.streams[cameraName][0] && 
          !remoteConfig.go2rtc.streams[cameraName][0].includes('rtsp://')
        ) {
          // Only consider it a custom URL if it's not an RTSP URL and not a ffmpeg: prefix with RTSP
          const firstUrl = remoteConfig.go2rtc.streams[cameraName][0];
          if (!firstUrl.includes('ffmpeg:rtsp://')) {
            customCameraUrl = firstUrl;
            rtspUrl = ''; // Clear rtspUrl if custom URL is present
            logger.info(`Using custom URL for camera "${cameraName}": ${customCameraUrl}`);
          }
        }

        // Extract codec options from the go2rtc.streams entry
        // Check if H264 is forced
        const forceH264 = remoteConfig.go2rtc && 
                        remoteConfig.go2rtc.streams && 
                        remoteConfig.go2rtc.streams[cameraName] && 
                        Array.isArray(remoteConfig.go2rtc.streams[cameraName]) && 
                        remoteConfig.go2rtc.streams[cameraName][0] && 
                        remoteConfig.go2rtc.streams[cameraName][0].includes('#video=h264');
        
        // Check if AAC audio is enabled
        const enableAac = remoteConfig.go2rtc && 
                        remoteConfig.go2rtc.streams && 
                        remoteConfig.go2rtc.streams[cameraName] && 
                        Array.isArray(remoteConfig.go2rtc.streams[cameraName]) && 
                        remoteConfig.go2rtc.streams[cameraName][0] && 
                        remoteConfig.go2rtc.streams[cameraName][0].includes('#audio=aac');
        
        // Check if OPUS audio is enabled
        const enableOpus = remoteConfig.go2rtc && 
                         remoteConfig.go2rtc.streams && 
                         remoteConfig.go2rtc.streams[cameraName] && 
                         Array.isArray(remoteConfig.go2rtc.streams[cameraName]) && 
                         remoteConfig.go2rtc.streams[cameraName].some(url => url.includes('#audio=opus'));

        // Extract more detailed camera settings
        const detectWidth = camObj.detect?.width || 1024;
        const detectHeight = camObj.detect?.height || 768;
        const detectFps = camObj.detect?.fps || 3;
        const recordEnabled = camObj.record?.enabled === true;
        const recordRetainDays = camObj.record?.retain?.days || 3;
        const recordRetainMode = camObj.record?.retain?.mode || 'motion';
        const motionThreshold = camObj.motion?.threshold || 30;
        const motionContourArea = camObj.motion?.contour_area || 15;
        const motionImproveContrast = camObj.motion?.improve_contrast || 'true';
        
        // Extract selected objects to track
        const objectsToTrack = camObj.objects?.track || ['person', 'cat'];
        
        // Extract snapshots configuration
        const snapshotsEnabled = camObj.snapshots?.enabled || true;
        const snapshotsTimestamp = camObj.snapshots?.timestamp || true;
        const snapshotsBoundingBox = camObj.snapshots?.bounding_box || true;
        const snapshotsRetainDefault = camObj.snapshots?.retain?.default || 60;

        logger.info(`Camera "${cameraName}" codec options: H264=${forceH264}, AAC=${enableAac}, OPUS=${enableOpus}`);

        // Add to memory with the expanded details
        inMemoryCameras.push({
          name: cameraName,
          rtspUrl,
          subStreamUrl,
          detectWidth,
          detectHeight,
          detectFps,
          recordEnabled,
          recordRetainDays,
          recordRetainMode,
          motionThreshold,
          motionContourArea,
          motionImproveContrast,
          objectsToTrack,
          snapshotsEnabled,
          snapshotsTimestamp,
          snapshotsBoundingBox,
          snapshotsRetainDefault,
          forceH264,
          enableAac,
          enableOpus,
          customCameraUrl
        });
      }
      logger.info(`Extracted ${inMemoryCameras.length} cameras from the raw config.`);
    } else {
      logger.info('No cameras found in raw config.');
    }
  } catch (err) {
    logger.error(`Error loading raw config: ${err.message}`);
    // If we fail to load, we keep inMemoryCameras empty or fallback
    inMemoryCameras = [];
  }
}

/**
 * Specifically fetch available detection objects from the filtered config
 * This is the only info we need from the filtered config endpoint
 */
async function fetchAvailableObjects() {
  try {
    logger.info(`Fetching available detection objects from: ${config.frigatesimpleui.urls.config}`);
    const response = await axios.get(config.frigatesimpleui.urls.config, {
      headers: { Accept: 'application/json' }
    });
    
    const filteredConfig = response.data;
    
    // Try to extract labelmap from different possible locations
    let labelmap = null;
    
    // First check for merged labelmap in detectors
    if (filteredConfig.detectors && Object.keys(filteredConfig.detectors).length > 0) {
      for (const detector of Object.values(filteredConfig.detectors)) {
        if (detector.model && detector.model.labelmap) {
          labelmap = detector.model.labelmap;
          break;
        }
      }
    }
    
    // Then try model section directly
    if (!labelmap && filteredConfig.model && filteredConfig.model.merged_labelmap) {
      labelmap = filteredConfig.model.merged_labelmap;
    } else if (!labelmap && filteredConfig.model && filteredConfig.model.labelmap) {
      labelmap = filteredConfig.model.labelmap;
    }
    
    if (labelmap) {
      // Extract available objects from labelmap
      availableDetectObjects = Object.values(labelmap).filter(val => val);
      logger.info(`Found ${availableDetectObjects.length} detectable objects in labelmap`);
    } else {
      // Default to common objects
      availableDetectObjects = ['person', 'car', 'cat', 'dog', 'truck', 'bicycle'];
      logger.warn('Could not find labelmap in config, using default objects');
    }
  } catch (err) {
    logger.error(`Error fetching available objects: ${err.message}`);
    // Default to common objects if we can't get the labelmap
    availableDetectObjects = ['person', 'car', 'cat', 'dog', 'truck', 'bicycle'];
  }
}

/**
 * Return available objects that can be detected
 */
function getAvailableDetectObjects() {
  return availableDetectObjects;
}

/**
 * Attempt to find the RTSP URL for a given camera in the remote config
 *  - we might check go2rtc.streams
 *  - or fall back to the 'path' in ffmpeg inputs
 * This method will preserve any credentials in the URL
 */
function findRtspUrl(remoteConfig, cameraName) {
  try {
    // If remote has go2rtc -> streams -> cameraName
    if (
      remoteConfig.go2rtc &&
      remoteConfig.go2rtc.streams &&
      remoteConfig.go2rtc.streams[cameraName] &&
      Array.isArray(remoteConfig.go2rtc.streams[cameraName]) &&
      remoteConfig.go2rtc.streams[cameraName].length > 0
    ) {
      const entry = remoteConfig.go2rtc.streams[cameraName][0];
      // e.g. "rtsp://192.168.x.x:8554" or "ffmpeg:rtsp://..."
      if (typeof entry === 'string') {
        // The first URL might be either a plain RTSP URL or a URL with codec options
        if (entry.startsWith('ffmpeg:')) {
          // Return the RTSP part of the URL without the ffmpeg: prefix or any codec params
          const baseUrl = entry.substring(7).split('#')[0];
          return baseUrl;
        } else if (entry.startsWith('rtsp://')) {
          // Plain RTSP URL
          return entry.split('#')[0];
        } else {
          // This might be a custom URL, we'll return empty and handle it separately
          logger.info(`Custom URL detected for camera "${cameraName}": ${entry}`);
          return '';
        }
      }
    }

    // Otherwise, check cameras.<cameraName>.ffmpeg.inputs[0].path
    if (
      remoteConfig.cameras[cameraName].ffmpeg &&
      remoteConfig.cameras[cameraName].ffmpeg.inputs &&
      remoteConfig.cameras[cameraName].ffmpeg.inputs.length > 0
    ) {
      return remoteConfig.cameras[cameraName].ffmpeg.inputs[0].path;
    }
  } catch (e) {
    logger.warn(`Failed to find RTSP for camera "${cameraName}": ${e.message}`);
  }

  // default fallback
  return '';
}

/**
 * Attempt to find the substream URL for a given camera
 * This looks in go2rtc streams array for a second URL
 */
function findSubStreamUrl(remoteConfig, cameraName) {
  try {
    // If remote has go2rtc -> streams -> cameraName
    if (
      remoteConfig.go2rtc &&
      remoteConfig.go2rtc.streams &&
      remoteConfig.go2rtc.streams[cameraName] &&
      Array.isArray(remoteConfig.go2rtc.streams[cameraName]) &&
      remoteConfig.go2rtc.streams[cameraName].length > 1
    ) {
      const entry = remoteConfig.go2rtc.streams[cameraName][1];
      // e.g. "rtsp://192.168.x.x:8554" or "ffmpeg:rtsp://..."
      if (typeof entry === 'string') {
        // remove "ffmpeg:" prefix if it exists
        if (entry.startsWith('ffmpeg:')) {
          return entry.substring(7).split('#')[0]; // also remove any #audio=...
        } else {
          // might be raw RTSP
          return entry.split('#')[0];
        }
      }
    }
  } catch (e) {
    logger.warn(`Failed to find substream for camera "${cameraName}": ${e.message}`);
  }

  // No substream found
  return '';
}

/**
 * Add or update a camera in our local inMemoryCameras
 */
function addOrUpdateCamera(cam) {
  // Validate name
  if (!cam.name || !/^[a-zA-Z0-9_]+$/.test(cam.name)) {
    throw new Error('Camera name invalid. Must be alphanumeric or underscores.');
  }

  // Ensure boolean properties are properly set
  cam.forceH264 = !!cam.forceH264;
  cam.enableAac = !!cam.enableAac;
  cam.enableOpus = !!cam.enableOpus;
  
  // Handle custom URL case
  if (cam.customCameraUrl) {
    // If using custom URL, clear RTSP URLs
    cam.rtspUrl = '';
    cam.subStreamUrl = '';
    logger.info(`Camera "${cam.name}" using custom URL: ${cam.customCameraUrl}`);
  } else if (!cam.rtspUrl) {
    throw new Error('RTSP URL is required when not using a custom URL.');
  }
  
  // Check if existing
  const idx = inMemoryCameras.findIndex((c) => c.name === cam.name);
  if (idx >= 0) {
    inMemoryCameras[idx] = { ...inMemoryCameras[idx], ...cam };
    logger.info(`Updated camera "${cam.name}" in memory with codec options: H264=${cam.forceH264}, AAC=${cam.enableAac}, OPUS=${cam.enableOpus}`);
  } else {
    inMemoryCameras.push(cam);
    logger.info(`Added camera "${cam.name}" in memory with codec options: H264=${cam.forceH264}, AAC=${cam.enableAac}, OPUS=${cam.enableOpus}`);
  }
}

/**
 * Remove a camera by name
 */
function removeCamera(cameraName) {
  const oldCount = inMemoryCameras.length;
  inMemoryCameras = inMemoryCameras.filter((c) => c.name !== cameraName);
  if (inMemoryCameras.length < oldCount) {
    logger.info(`Removed camera "${cameraName}" from memory.`);
    return true;
  }
  logger.warn(`Camera "${cameraName}" not found.`);
  return false;
}

/**
 * Return the current in-memory list of cameras
 */
function getCameras() {
  return inMemoryCameras;
}

/**
 * Build a config matching the expected format based on inMemoryCameras
 */
function buildMinimalConfig() {
  // clone the skeleton
  const config = JSON.parse(JSON.stringify(baseConfigSkeleton));

  // For each camera in memory, add go2rtc stream + cameras block
  inMemoryCameras.forEach((cam) => {
    // go2rtc.streams.<camera_name> format - ensure no null values
    const streams = [];
    
    // If custom URL is provided, use it directly
    if (cam.customCameraUrl) {
      streams.push(cam.customCameraUrl);
      logger.info(`Using custom URL for camera "${cam.name}": ${cam.customCameraUrl}`);
    } else if (cam.rtspUrl) {
      // Build the stream URL with any codec options
      let streamUrl = cam.rtspUrl;
      
      // Add codec parameters if needed
      if (cam.forceH264 || cam.enableAac) {
        streamUrl = 'ffmpeg:' + streamUrl;
        
        if (cam.forceH264) {
          streamUrl += '#video=h264';
        }
        
        if (cam.enableAac) {
          streamUrl += '#audio=aac';
        }
      }
      
      logger.info(`Camera "${cam.name}" stream URL: ${streamUrl} (H264=${cam.forceH264}, AAC=${cam.enableAac}, OPUS=${cam.enableOpus})`);
      streams.push(streamUrl);
      
      // Add OPUS audio stream if enabled
      if (cam.enableOpus) {
        const opusStream = `ffmpeg:${cam.name}#audio=opus`;
        logger.info(`Camera "${cam.name}" adding OPUS stream: ${opusStream}`);
        streams.push(opusStream);
      }
    } else {
      // If rtspUrl is null or empty, use a placeholder to indicate it needs to be fixed
      logger.warn(`Camera ${cam.name} has no RTSP URL`);
      streams.push('rtsp://missing/url');
    }
    
    // Add substream if available and no custom URL is set
    if (cam.subStreamUrl && !cam.customCameraUrl) {
      streams.push(cam.subStreamUrl);
    }
    
    config.go2rtc.streams[cam.name] = streams;

    // cameras.<camera_name> format
    config.cameras[cam.name] = {
      enabled: true,
      ffmpeg: {
        inputs: [
          {
            path: `rtsp://127.0.0.1:8554/${cam.name}?video&audio`,
            roles: ['record', 'detect']
          }
        ]
      },
      detect: {
        fps: cam.detectFps || 3,
        width: cam.detectWidth,
        height: cam.detectHeight
      },
      objects: {
        track: cam.objectsToTrack || ['person', 'cat']
      },
      record: {
        enabled: cam.recordEnabled,
        retain: {
          days: cam.recordRetainDays || 3,
          mode: cam.recordRetainMode || 'motion'
        }
      },
      motion: {
        threshold: cam.motionThreshold,
        contour_area: cam.motionContourArea,
        improve_contrast: cam.motionImproveContrast || 'true'
      },
      snapshots: {
        enabled: cam.snapshotsEnabled || true,
        timestamp: cam.snapshotsTimestamp || true,
        bounding_box: cam.snapshotsBoundingBox || true,
        retain: {
          default: cam.snapshotsRetainDefault || 60
        }
      }
    };
  });

  return config;
}

/**
 * Get the current configuration as YAML for user review
 */
function getCurrentConfigYAML() {
  const config = buildMinimalConfig();
  return customYamlStringify(config);
}

/**
 * Custom YAML stringify function to ensure proper formatting
 * This helps generate YAML that matches the expected format
 */
function customYamlStringify(config) {
  // Modify baseConfigSkeleton to include updated detector configuration
  if (detectorConfig.enabled) {
    config.detectors = {
      coral: {
        type: 'edgetpu',
        device: detectorConfig.type
      }
    };
  } else {
    // Remove coral detector if disabled
    delete config.detectors.coral;
  }

  // Convert to YAML with js-yaml
  let yamlStr = yaml.dump(config, {
    lineWidth: -1, // No line wrapping
    noRefs: true,
    quotingType: "'", // Use single quotes for strings that need quotes
    noCompatMode: true,
    sortKeys: false // Keep the order of keys as they are
  });

  // Optional: Add comments or formatting tweaks if needed
  yamlStr = yamlStr
    // Add comment for MQTT section
    .replace(/^mqtt:/m, '# MQTT configuration\nmqtt:')
    // Add comment for go2rtc
    .replace(/^go2rtc:/m, '\n# Use go2rtc as media source\ngo2rtc:')
    // Add comment for webrtc
    .replace(/^webrtc:/m, '\n# For 2 Way Audio\nwebrtc:')
    // Add comment for detector
    .replace(/^detectors:/m, '\n# Detector settings\ndetectors:')
    // Add comment for ffmpeg
    .replace(/^ffmpeg:/m, '\n# FFMPEG configuration\nffmpeg:')
    // Add comment for cameras
    .replace(/^cameras:/m, '\n# Camera configurations\ncameras:');

  // Add version at the end (after cameras block)
  yamlStr += '\nversion: 0.14\n';

  return yamlStr;
}

/**
 * Save the config and restart the service (now separate calls)
 */
async function saveAndRestart() {
  try {
    // First, save the configuration
    const saveResult = await saveConfig();
    
    if (!saveResult) {
      logger.error('Failed to save configuration, aborting restart');
      return false;
    }
    
    
    return restartResult;
  } catch (err) {
    logger.error(`Error in save and restart sequence: ${err.message}`);
    return false;
  }
}

/**
 * Just save the configuration without restarting
 */
async function saveConfig() {
  try {
    const finalConfig = buildMinimalConfig();
    
    // Use our custom YAML formatter
    const yamlPayload = customYamlStringify(finalConfig);

    logger.info('Saving config to remote server...');
    
    // Use the restart parameter if requested
    const saveUrl = config.frigatesimpleui.urls.saveConfig;
    
    logger.info(`Using save URL: ${saveUrl}`);

    const response = await axios.post(saveUrl, yamlPayload, {
      headers: {
        'Content-Type': 'text/plain',
        'Accept': 'application/json'
      },
      maxBodyLength: Infinity
    });

    if (response.data && response.data.success) {
      logger.info(`Config saved successfully: ${response.data.message}`);
      return true;
    } else {
      logger.error(`Error saving config: ${response.data?.message || 'Unknown error'}`);
      return false;
    }
  } catch (err) {
    if (err.response && err.response.data) {
      logger.error(`Server rejected config: ${err.response.data.message}`);
    } else {
      logger.error(`Error saving remote config: ${err.message}`);
    }
    return false;
  }
}

/**
 * Just restart the service
 */

/**
 * Returns the array of camera configurations
 * @returns {Array} Array of camera configuration objects
 */
function getCamerasConfig() {
  return inMemoryCameras;
}

/**
 * Returns a specific camera configuration by name
 * @param {string} cameraName - The name of the camera to retrieve
 * @returns {Object|null} Camera configuration object or null if not found
 */
function getCameraByName(cameraName) {
  if (!cameraName) return null;
  return inMemoryCameras.find(cam => cam.name.toLowerCase() === cameraName.toLowerCase()) || null;
}

/**
 * Update detector configuration
 * @param {Object} config - Detector configuration
 * @param {boolean} config.enabled - Whether the coral detector is enabled
 * @param {string} config.type - Device type ('pci' or 'usb')
 */
function updateDetectorConfig(config) {
  if (config) {
    detectorConfig = {
      ...detectorConfig,
      ...config,
      type: config.type || process.env.DETECTOR_DEVICE || 'usb'
    };
    logger.info(`Updated detector configuration: enabled=${detectorConfig.enabled}, type=${detectorConfig.type}`);
  }
}

/**
 * Get the current detector configuration
 * @returns {Object} Current detector configuration
 */
function getDetectorConfig() {
  return {...detectorConfig};
}

// Export all methods
module.exports = {
  loadConfig,
  addOrUpdateCamera,
  removeCamera,
  getCameras,
  getAvailableDetectObjects,
  saveAndRestart,
  saveConfig,
  getCurrentConfigYAML,
  buildMinimalConfig,
  customYamlStringify,
  getCamerasConfig,
  getCameraByName,
  updateDetectorConfig,
  getDetectorConfig
};
