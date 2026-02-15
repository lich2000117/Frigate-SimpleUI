const config = require('../config');
const { logger } = require('./logger');
/**
 * Test if an RTSP stream is accessible
 * @param {string} streamUrl - URL of the RTSP stream
 * @returns {Promise<boolean>} Whether the stream is accessible
 */

const testStream = async (camName, fallbackRtspUrl) => {
    const streamUrl = `${config.go2rtc.url}${config.go2rtc.endpoints.getSnapshot}${camName}`;
    const { spawn } = require('child_process');
    const axios = require('axios');
  
    try {
      const response = await axios.get(streamUrl, { timeout: 5000 });
      console.log('✅ go2rtc response:', response.data);
      return true;
    } catch (apiError) {
      logger.error(`go2rtc API error: ${apiError.message}`);
      logger.info(`Attempting direct RTSP stream test for: ${fallbackRtspUrl}`);
    }
  
    return new Promise((resolve) => {
      let errorOutput = '';
      const ffmpeg = spawn('ffmpeg', [
        '-hide_banner',
        '-v', 'error',
        '-fflags', 'nobuffer',
        '-flags', 'low_delay',
        '-timeout', '5000000',
        '-rtsp_flags', 'prefer_tcp',
        '-rtsp_transport', 'tcp',
        '-i', fallbackRtspUrl,
        '-t', '2',
        '-f', 'null',
        '-'
      ]);
  
      let timeout = setTimeout(() => {
        if (!ffmpeg.killed) {
          ffmpeg.kill('SIGKILL');
          logger.error(`FFmpeg test timed out for: ${fallbackRtspUrl}`);
          resolve(false);
        }
      }, 10000);
  
      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
  
      ffmpeg.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(true);
        } else {
          logger.error(`Direct stream test failed for ${fallbackRtspUrl}\n${errorOutput}`);
          resolve(false);
        }
      });
  
      ffmpeg.on('error', (err) => {
        clearTimeout(timeout);
        logger.error(`Failed to spawn ffmpeg: ${err.message}`);
        resolve(false);
      });
    });
  };

module.exports = { testStream };