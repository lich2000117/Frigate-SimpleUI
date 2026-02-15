const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { testStream } = require('../utils/streamManager');
const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FRIGATESIMPLEUI_URL = process.env.FRIGATESIMPLEUI_URL || 'http://192.168.199.3:5000';
const GO2RTC_URL = process.env.GO2RTC_URL || 'http://192.168.199.3:1984';
const config = require('../config');
const { getCameraByName, getCamerasConfig } = require('../utils/configManager');

/**
 * GET /api/stream/snapshot/:name
 * Get a snapshot from a camera by name
 */
router.get('/snapshot/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { rtspUrl } = req.query; // Get the RTSP URL from query parameter
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Camera name is required'
      });
    }
    
    logger.info(`Getting snapshot for camera: ${name}`);
    
    // First try getting snapshot from go2rtc API
    try {
      const snapshotUrl = `${GO2RTC_URL}${config.go2rtc.endpoints.getSnapshot}${encodeURIComponent(name)}`;
      logger.info(`Fetching snapshot from: ${snapshotUrl}`);
      
      const response = await axios({
        method: 'get',
        url: snapshotUrl,
        responseType: 'arraybuffer',
        timeout: 5000
      });
      
      // If successful, return the image
      if (response.status === 200 && response.headers['content-type'].includes('image')) {
        res.set('Content-Type', response.headers['content-type']);
        return res.send(response.data);
      }
      
      throw new Error('Non-image response from go2rtc API');
    } catch (error) {
      logger.warn(`Failed to get snapshot from go2rtc: ${error.message}, falling back to RTSP method`);
      // Continue to fallback method if go2rtc failed
    }
    
    // Fallback to RTSP direct method
    // Check if RTSP URL was provided
    if (!rtspUrl) {
      // Try to get the RTSP URL from the camera configuration
      try {
        const camera = getCameraByName(name);
        
        if (!camera || !camera.rtspUrl) {
          return res.status(404).json({
            success: false,
            message: 'Camera RTSP URL not found and not provided'
          });
        }
        
        // Use the RTSP URL from the camera configuration
        return captureAndSendRtspSnapshot(camera.rtspUrl, name, res);
      } catch (configError) {
        logger.error(`Error getting camera config: ${configError.message}`);
        return res.status(500).json({
          success: false,
          message: 'Failed to get camera configuration'
        });
      }
    } else {
      // Use the provided RTSP URL
      return captureAndSendRtspSnapshot(rtspUrl, name, res);
    }
  } catch (error) {
    logger.error(`Error capturing snapshot: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to capture snapshot from stream'
    });
  }
});

/**
 * Helper function to capture and send an RTSP snapshot
 */
function captureAndSendRtspSnapshot(rtspUrl, name, res) {
  // Create a temporary file path for the snapshot
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `snapshot_${name}_${Date.now()}.jpg`);
  
  // Include the -rtsp_transport tcp flag (often necessary for RTSP on certain networks)
  // Also run ffmpeg under a shell by specifying { shell: true }
  const ffmpegCmd = `ffmpeg -y -rtsp_transport tcp -i "${rtspUrl}" -frames:v 1 -update 1 "${tmpFile}"`;
  
  logger.info(`Capturing RTSP snapshot with command: ${ffmpegCmd}`);
  
  exec(ffmpegCmd, { shell: true }, (error, stdout, stderr) => {
    if (error) {
      logger.error(`Failed to capture snapshot: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to capture snapshot from stream'
      });
    }
    
    // Check if the snapshot file was created
    if (fs.existsSync(tmpFile)) {
      res.sendFile(tmpFile, (err) => {
        if (err) {
          logger.error(`Error sending snapshot file: ${err.message}`);
        }
        
        // Clean up the temporary file
        fs.unlink(tmpFile, (unlinkErr) => {
          if (unlinkErr) {
            logger.error(`Error cleaning up snapshot file: ${unlinkErr.message}`);
          }
        });
      });
    } else {
      logger.error('Snapshot file was not created');
      res.status(500).json({
        success: false,
        message: 'Failed to create snapshot from stream'
      });
    }
  });
}

/**
 * GET /api/stream/snapshot
 * Grab a snapshot from the RTSP stream
 */
router.get('/snapshot', async (req, res) => {
  const streamUrl = req.query.url;

  if (!streamUrl) {
    return res.status(400).json({
      success: false,
      message: 'Stream URL is required'
    });
  }

  try {
    // Create a temporary file path for the snapshot
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `snapshot_${Date.now()}.jpg`);

    // Include the -rtsp_transport tcp flag (often necessary for RTSP on certain networks)
    // Also run ffmpeg under a shell by specifying { shell: true }
    const ffmpegCmd = `ffmpeg -y -rtsp_transport tcp -i "${streamUrl}" -frames:v 1 -update 1 "${tmpFile}"`;

    exec(ffmpegCmd, { shell: true }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Failed to capture snapshot: ${error.message}`);
        return res.status(500).json({
          success: false,
          message: 'Failed to capture snapshot from stream'
        });
      }

      // Check if the snapshot file was created
      if (fs.existsSync(tmpFile)) {
        res.sendFile(tmpFile, (err) => {
          if (err) {
            logger.error(`Error sending snapshot file: ${err.message}`);
          }

          // Clean up the temporary file
          fs.unlink(tmpFile, (unlinkErr) => {
            if (unlinkErr) {
              logger.error(`Error cleaning up snapshot file: ${unlinkErr.message}`);
            }
          });
        });
      } else {
        logger.error('Snapshot file was not created');
        res.status(500).json({
          success: false,
          message: 'Failed to create snapshot from stream'
        });
      }
    });
  } catch (error) {
    logger.error(`Error capturing snapshot: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to capture snapshot from stream'
    });
  }
});

/**
 * GET /api/stream/frigatesimpleui-status
 * Check if FrigateSimpleUI server is running
 */
router.get('/frigatesimpleui-status', async (req, res) => {
  try {
    // Try to access the FrigateSimpleUI health endpoint
    const response = await axios.get(`${FRIGATESIMPLEUI_URL}/api/`, {
      timeout: 3000 // 3 second timeout
    });
    
    if (response.status === 200 && response.data === "Frigate is running. Alive and healthy!") {
      res.json({
        success: true,
        status: 'running',
        message: 'FrigateSimpleUI server is running',
        frigatesimpleUIUrl: FRIGATESIMPLEUI_URL
      });
    } else {
      res.json({
        success: false,
        status: 'error',
        message: 'FrigateSimpleUI server responded but with unexpected data',
        frigatesimpleUIUrl: FRIGATESIMPLEUI_URL
      });
    }
  } catch (error) {
    logger.error(`Error checking FrigateSimpleUI status: ${error.message}`);
    res.json({
      success: false,
      status: 'not_running',
      message: 'FrigateSimpleUI server is not running or not accessible',
      frigatesimpleUIUrl: FRIGATESIMPLEUI_URL
    });
  }
});

/**
 * GET /api/stream/test
 * Test if a stream is accessible
 */
router.get('/test', async (req, res) => {
  try {
    const { camName, url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Stream URL is required'
      });
    }
    
    logger.info(`Testing stream: ${url}`);
    const isAccessible = await testStream(camName, url);
    
    res.json({ 
      success: true, 
      isAccessible 
    });
  } catch (error) {
    logger.error(`Error testing stream: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Failed to test stream: ${error.message}` 
    });
  }
});

module.exports = router;
