const os = require('os');
const onvif = require('node-onvif');
// Removed SADP dependency as we're focusing only on ONVIF
const pLimit = require('p-limit');
const { logger } = require('./logger');
// const { sadpProbe } = require('./sadp'); // Commented out SADP
// const { activateHikvision } = require('./hikvision'); // Commented out Hikvision-specific code

let cachedProbe = null;             // Promise | null
let probeStartedAt = 0;             // unix ms

/**
 * Get all available network interfaces
 * @returns {Array} List of network interfaces with name and IP addresses
 */
const getNetworkInterfaces = () => {
  try {
    const interfaces = os.networkInterfaces();
    const result = [];

    Object.keys(interfaces).forEach(ifaceName => {
      interfaces[ifaceName].forEach(iface => {
        // Only get IPv4 addresses and skip internal/loopback interfaces
        if (iface.family === 'IPv4' && !iface.internal) {
          result.push({
            name: ifaceName,
            address: iface.address,
            netmask: iface.netmask
          });
        }
      });
    });

    return result;
  } catch (error) {
    logger.error(`Error getting network interfaces: ${error.message}`);
    return [];
  }
};

/**
 * Scan for ONVIF devices on a specific network interface
 * @param {string} interfaceAddress - IP address of the interface to scan from (optional)
 * @returns {Promise<Array>} Discovered devices
 */
const scanOnvifDevices = async () => {
  const now = Date.now();
  // refresh cache after 15s so successive "Scan" clicks are fresh
  if (!cachedProbe || now - probeStartedAt > 15000) {
    logger.info('Starting ONE global ONVIF probe (5s)');
    probeStartedAt = now;
    cachedProbe = onvif.startProbe({ timeout: 5000 })
      .catch(err => {
        logger.warn('ONVIF probe failed:', err.message);
        return [];
      });
  }

  try {
    const deviceInfoList = await cachedProbe;
    logger.info(`ONVIF probe complete, found ${deviceInfoList.length} devices`);
    console.log(deviceInfoList);
    // Map all ONVIF devices to a common format
    // vendor and hardware information follows this format     'onvif://www.onvif.org/hardware/DS-2CD2355FWD-I',
    //     'onvif://www.onvif.org/name/HIKVISION%20DS-2CD2355FWD-I',
    const devices = deviceInfoList
      .map(info => ({
        ip: info.xaddrs?.[0]?.match(/http:\/\/([\d.]+)\//)?.[1] ?? null,
        manufacturer: info.scopes?.find(s => s.includes('onvif://www.onvif.org/name/'))?.split('/').pop()?.split('%20')[0] || 'Unknown',
        model: info.scopes?.find(s => s.includes('onvif://www.onvif.org/hardware/'))?.split('/').pop() || 'Unknown',
        onvifUrl: info.xaddrs?.[0] ?? null
      }));

    return devices;
  } catch (error) {
    logger.error(`ONVIF discovery error: ${error.message}`);
    return [];
  }
};

/**
 * Fetch RTSP stream URLs and capabilities from an ONVIF device
 * @param {string} deviceIp - IP address of the device
 * @param {string} onvifUrl - ONVIF URL of the device
 * @param {string} username - Username for ONVIF authentication
 * @param {string} password - Password for ONVIF authentication
 * @returns {Promise<Object>} Object containing streams and capabilities information
 */
const getStreamUrls = async (deviceIp, onvifUrl, username = '', password = '') => {
  try {
    // 'onvif' is a different package than 'node-onvif', but still works for direct Cam usage
    const { Cam } = require('onvif');
    
    logger.info(`Getting stream URLs for camera at ${deviceIp} with username "${username}"`);

    return new Promise((resolve, reject) => {
      try {
        // Parse the URL properly
        let u;
        try {
          u = new URL(onvifUrl);
        } catch (err) {
          // If the URL is invalid, try prefixing with http://
          if (!onvifUrl.startsWith('http://') && !onvifUrl.startsWith('https://')) {
            try {
              u = new URL(`http://${onvifUrl}`);
            } catch (e) {
              throw new Error(`Invalid ONVIF URL: ${onvifUrl}`);
            }
          } else {
            throw err;
          }
        }
        
        // Extract hostname (without protocol) and port
        const hostname = u.hostname;
        const port = u.port || 80;
        
        logger.info(`Parsed ONVIF URL: hostname=${hostname}, port=${port}`);
        
        // Ensure username and port are properly set
        const connOptions = {
          hostname,
          port,
        };
        
        // Only add auth credentials if provided
        if (username) {
          connOptions.username = username;
          connOptions.password = password;
        }
        
        logger.info(`Connecting to camera with options: ${JSON.stringify(connOptions)}`);
        
        const cam = new Cam(connOptions, (err) => {
          if (err) {
            logger.error(`Error connecting to camera at ${deviceIp}: ${err.message}`);
            return reject(err);
          }

          // Collect camera capabilities
          const capabilities = {
            videoEncoders: [],
            audioEncoders: [],
            resolutions: []
          };

          // Get profile information first
          cam.getProfiles((err, profiles) => {
            if (err) {
              logger.error(`Error getting profiles for camera at ${deviceIp}: ${err.message}`);
              return reject(err);
            }

            // If we have profiles, try to get encoder configurations
            if (profiles && profiles.length > 0) {
              // Extract codec and resolution info from profiles
              profiles.forEach(profile => {
                try {
                  if (profile.videoEncoderConfiguration) {
                    const videoConfig = profile.videoEncoderConfiguration;
                    
                    // Add video encoder type if not already in list
                    if (videoConfig.encoding && !capabilities.videoEncoders.includes(videoConfig.encoding)) {
                      capabilities.videoEncoders.push(videoConfig.encoding);
                    }
                    
                    // Add resolution if available
                    if (videoConfig.resolution) {
                      const { width, height } = videoConfig.resolution;
                      // Check if this resolution is already in the list
                      const exists = capabilities.resolutions.some(
                        r => r.width === width && r.height === height
                      );
                      if (!exists) {
                        capabilities.resolutions.push({ width, height });
                      }
                    }
                  }
                  
                  // Extract audio encoder info if available
                  if (profile.audioEncoderConfiguration) {
                    const audioConfig = profile.audioEncoderConfiguration;
                    if (audioConfig.encoding && !capabilities.audioEncoders.includes(audioConfig.encoding)) {
                      capabilities.audioEncoders.push(audioConfig.encoding);
                    }
                  }
                } catch (error) {
                  logger.warn(`Error parsing profile configuration: ${error.message}`);
                }
              });
              
              console.log(capabilities);
              // Now get the stream URLs
              const result = { mainStream: '', subStream: '' };
              
              // First profile is typically the main stream
              cam.getStreamUri({ profileToken: profiles[0].token }, (err, stream) => {
                if (err) {
                  logger.error(`Error getting main stream URI: ${err.message}`);
                  return reject(err);
                }
                result.mainStream = stream.uri;
                // add username and password to the main stream
                result.mainStream = result.mainStream.replace('rtsp://', `rtsp://${username}:${password}@`);

                // Second profile, if present, is often the sub-stream
                if (profiles.length > 1) {
                  cam.getStreamUri({ profileToken: profiles[1].token }, (err, stream) => {
                    if (err) {
                      logger.error(`Error getting sub-stream URI: ${err.message}`);
                      // Return main stream even if sub-stream fetch fails
                      return resolve({ 
                        streams: result,
                        capabilities
                      });
                    }
                    result.subStream = stream.uri;
                    // add username and password to the sub stream
                    result.subStream = result.subStream.replace('rtsp://', `rtsp://${username}:${password}@`);
                    // if the sub stream is the same as the main stream, set the sub stream to an empty string
                    if (result.subStream==result.mainStream) {
                      result.subStream = '';
                    }
                    resolve({ 
                      streams: result,
                      capabilities
                    });
                  });
                } else {
                  resolve({ 
                    streams: result,
                    capabilities
                  });
                }
              });
            } else {
              resolve({ 
                streams: { mainStream: '', subStream: '' },
                capabilities
              });
            }
          });
        });
      } catch (error) {
        logger.error(`Error setting up ONVIF connection: ${error.message}`);
        reject(error);
      }
    });
  } catch (error) {
    logger.error(`Error getting stream URLs for ${deviceIp}: ${error.message}`);
    return {
      streams: {
        mainStream: '',
        subStream: ''
      },
      capabilities: {
        videoEncoders: [],
        audioEncoders: [],
        resolutions: []
      }
    };
  }
};

/**
 * Scan all cameras using ONVIF only
 */
const scanAllDevices = async () => {
  // Only use ONVIF scanning now - removed SADP
  const onvifDevices = await scanOnvifDevices();
  
  // Return all discovered ONVIF devices
  return onvifDevices;
};

// Remove bulkActivate since we're removing Hikvision-specific code
// const bulkActivate = async (ips, password) => { ... }

module.exports = {
  getNetworkInterfaces,
  scanOnvifDevices,
  getStreamUrls,
  scanAllDevices
  // Removed bulkActivate export
};
