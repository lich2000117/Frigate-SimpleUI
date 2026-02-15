// const axios = require("axios");
// const https = require("https");
// const cp = require("child_process");
// const { logger } = require('./logger');

// const httpsAgent = new https.Agent({ rejectUnauthorized: false });
// const wait = (ms) => new Promise((res) => setTimeout(res, ms));

// function addAlias(iface = "eth0", alias = "192.168.1.250/24") {
//   try {
//     cp.execSync(`ip addr add ${alias} dev ${iface}`, { stdio: "ignore" });
//     return true;
//   } catch (err) {
//     return false;
//   }
// }
// function delAlias(iface = "eth0", alias = "192.168.1.250/24") {
//   try {
//     cp.execSync(`ip addr del ${alias} dev ${iface}`, { stdio: "ignore" });
//   } catch (_) {/*noop*/}
// }

// /**
//  * Only enable ONVIF on a Hikvision camera
//  * @param {string} cameraIp - IP address of the already activated camera
//  * @param {string} password - Admin password for the camera
//  * @param {object} opts - Optional parameters
//  * @returns {Promise<{success: boolean, message: string}>}
//  */
// async function enableOnvifOnly(cameraIp, password, opts = {}) {
//   const onvifUser = opts.onvifUser || "onvif";
//   const iface = opts.iface || "eth0";
//   const aliasCidr = opts.alias || "192.168.1.250/24";
//   let aliasAdded = false;

//   try {
//     // Check camera reachability, add alias if needed
//     try {
//       await axios.get(`http://${cameraIp}`, { timeout: 2000 });
//     } catch (err) {
//       logger.info(`Camera at ${cameraIp} unreachable, adding alias...`);
//       aliasAdded = addAlias(iface, aliasCidr);
//       if (aliasAdded) await wait(1000); // Wait for ARP + routing
//     }

//     // Set up HTTPS PUT request helper with admin auth
//     const tryPut = (url, xml) =>
//       axios.put(url, xml, {
//         httpsAgent,
//         timeout: 5000,
//         auth: {
//           username: "onvif",
//           password: password
//         },
//         headers: { "Content-Type": "application/xml" },
//       });

//     // Enable ONVIF and create ONVIF user
//     const userXml = `<User><userName>${onvifUser}</userName><password>${password}</password><level>Administrator</level></User>`;
//     try {
//       // First try HTTPS
//       await tryPut(`https://${cameraIp}/ISAPI/System/ONVIF/user`, userXml);
//       logger.info(`ONVIF user added successfully`);
//     } catch (err) {
//       // If HTTPS fails, try HTTP
//       if (err.response?.status === 409) {
//         logger.info(`ONVIF user already exists`);
//       } else {
//         // Try with HTTP instead
//         await tryPut(`http://${cameraIp}/ISAPI/System/ONVIF/user`, userXml);
//         logger.info(`ONVIF user added successfully via HTTP`);
//       }
//     }

//     // Clean up temporary network alias if added
//     if (aliasAdded) {
//       delAlias(iface, aliasCidr);
//     }

//     // Verify ONVIF access with the onvif user credentials
//     try {
//       const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
//         <s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
//                     xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
//           <s:Body>
//             <tds:GetCapabilities><tds:Category>Media</tds:Category></tds:GetCapabilities>
//           </s:Body>
//         </s:Envelope>`;
      
//       const rsp = await axios.post(`http://${cameraIp}/onvif/device_service`, soapBody, {
//         auth: {
//           username: onvifUser,
//           password: password
//         },
//         headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
//         timeout: 4000,
//       });
      
//       if (rsp.status === 200) {
//         return { success: true, message: "ONVIF enabled and verified" };
//       }
//     } catch (err) {
//       logger.error(`Failed to verify ONVIF: ${err.message}`);
//       return { success: false, message: "ONVIF enabled but verification failed" };
//     }

//     return { success: true, message: "ONVIF user added successfully" };
//   } catch (error) {
//     logger.error(`Error enabling ONVIF: ${error.message}`);
//     return { success: false, message: error.message };
//   }
// }


// module.exports = { enableOnvifOnly };
