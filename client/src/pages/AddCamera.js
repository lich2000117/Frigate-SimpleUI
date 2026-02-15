import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col, Alert, Spinner, ListGroup, InputGroup, Image, Badge, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { BsSearch, BsCamera, BsExclamationTriangle, BsX } from 'react-icons/bs';
import { 
  getNetworkInterfaces, 
  scanAllDevices,
  getStreamUrls, 
  testStreamWithSnapshot,
  addOrUpdateCamera,
  getAvailableDetectObjects,
  checkCameraNameExists,
  checkRtspUrlExists,
  getCameraSnapshotUrl
} from '../services/api';
import FrigateSimpleUILogo from '../components/FrigateSimpleUILogo';
import '../styles/frigatesimpleui.css';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const AddCamera = () => {
  const navigate = useNavigate();
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    rtspUrl: '',
    subStreamUrl: '',
    recordEnabled: true,
    recordRetainMode: 'motion',
    recordRetainDays: '7',
    detectWidth: '1024',
    detectHeight: '768',
    objectsToTrack: ['person', 'car'],
    forceH264: false,
    enableAac: false,
    enableOpus: false,
    customCameraUrl: '',
    useCustomUrl: false
  });
  
  // UI state
  const [interfaces, setInterfaces] = useState([]);
  const [selectedInterfaces, setSelectedInterfaces] = useState([]);
  const [loading, setLoading] = useState({ 
    interfaces: false, 
    scan: false, 
    test: false, 
    save: false, 
    objects: false,
    checkName: false,
    checkUrl: false
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [streamTested, setStreamTested] = useState(false);
  const [streamValid, setStreamValid] = useState(false);
  const [availableObjects, setAvailableObjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedObjects, setSelectedObjects] = useState(['person', 'car']);
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [nameExists, setNameExists] = useState(false);
  const [rtspUrlExists, setRtspUrlExists] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  
  // Update state to store both username and password
  const [cameraCredentials, setCameraCredentials] = useState({}); // ip → {username, password}
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('admin');
  const [selectedCameraForPassword, setSelectedCameraForPassword] = useState(null);
  
  // Add state for bulk add mode
  const [bulkAddMode, setBulkAddMode] = useState(false);
  const [defaultCredentials, setDefaultCredentials] = useState({
    username: 'admin',
    password: ''
  });
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [processingBulkAdd, setProcessingBulkAdd] = useState(false);
  const [bulkAddResults, setBulkAddResults] = useState([]);
  
  // Load network interfaces and available objects on mount
  useEffect(() => {
    loadNetworkInterfaces();
    fetchAvailableObjects();
    
    // Load saved credentials from localStorage
    const savedCredentials = localStorage.getItem('cameraCredentials');
    if (savedCredentials) {
      try {
        setCameraCredentials(JSON.parse(savedCredentials));
      } catch (e) {
        console.error('Error loading saved credentials:', e);
      }
    }
    
    const savedDefaultCredentials = localStorage.getItem('defaultCredentials');
    if (savedDefaultCredentials) {
      try {
        setDefaultCredentials(JSON.parse(savedDefaultCredentials));
      } catch (e) {
        console.error('Error loading default credentials:', e);
      }
    }
  }, []);
  
  // Check camera name when it changes
  useEffect(() => {
    const checkName = async () => {
      if (formData.name && formData.name.length > 2) {
        setLoading(prev => ({ ...prev, checkName: true }));
        const exists = await checkCameraNameExists(formData.name);
        setNameExists(exists);
        setLoading(prev => ({ ...prev, checkName: false }));
      } else {
        setNameExists(false);
      }
    };
    
    checkName();
  }, [formData.name]);
  
  // Check RTSP URL when it changes
  useEffect(() => {
    const checkUrl = async () => {
      if (formData.rtspUrl && !formData.useCustomUrl) {
        setLoading(prev => ({ ...prev, checkUrl: true }));
        const exists = await checkRtspUrlExists(formData.rtspUrl);
        setRtspUrlExists(exists);
        setLoading(prev => ({ ...prev, checkUrl: false }));
      } else {
        setRtspUrlExists(false);
      }
    };
    
    checkUrl();
  }, [formData.rtspUrl, formData.useCustomUrl]);
  
  const loadNetworkInterfaces = async () => {
    try {
      setLoading(prev => ({ ...prev, interfaces: true }));
      const response = await getNetworkInterfaces();
      if (response.success) {
        setInterfaces(response.interfaces);
        // Pre-select all interfaces
        setSelectedInterfaces(response.interfaces.map(iface => iface.address));
      } else {
        setError('Failed to load network interfaces');
      }
    } catch (error) {
      setError(`Error loading interfaces: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, interfaces: false }));
    }
  };

  const fetchAvailableObjects = async () => {
    try {
      setLoading(prev => ({ ...prev, objects: true }));
      const response = await getAvailableDetectObjects();
      
      if (response.success && response.objects) {
        // Filter out duplicate objects
        const uniqueObjects = [...new Set(response.objects)];
        setAvailableObjects(uniqueObjects);
      } else {
        // Fallback to common objects (with duplicates removed)
        setAvailableObjects(['person', 'car', 'cat', 'dog', 'truck', 'bicycle']);
      }
    } catch (error) {
      console.error('Error fetching available objects:', error);
      // Fallback to common objects
      setAvailableObjects(['person', 'car', 'cat', 'dog', 'truck', 'bicycle']);
    } finally {
      setLoading(prev => ({ ...prev, objects: false }));
    }
  };
  
  const handleInterfaceChange = (e) => {
    const { value, checked } = e.target;
    
    if (checked) {
      setSelectedInterfaces(prev => [...prev, value]);
    } else {
      setSelectedInterfaces(prev => prev.filter(iface => iface !== value));
    }
  };
  
  const handleScanDevices = async () => {
    try {
      setLoading(prev => ({ ...prev, scan: true }));
      setDiscoveredDevices([]);
      setError(null);
      
      toast.loading('Scanning for ONVIF cameras on all network interfaces...');
      
      // Use scanAllDevices which now scans all networks without filtering
      const response = await scanAllDevices();
      
      toast.dismiss();
      
      if (response.success) {
        if (response.devices.length === 0) {
          toast.success('Scan completed. No ONVIF cameras found.');
          setSuccess('Scan completed. No ONVIF cameras were found.');
        } else {
          toast.success(`Found ${response.devices.length} ONVIF cameras.`);
          setSuccess(`Found ${response.devices.length} ONVIF cameras.`);
        }
        setDiscoveredDevices(response.devices);
      } else {
        toast.error('Failed to scan for devices');
        setError('Failed to scan for devices');
      }
    } catch (error) {
      toast.dismiss();
      toast.error(`Error scanning: ${error.message}`);
      setError(`Error scanning for devices: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, scan: false }));
    }
  };
  
  const handleSelectDevice = async (device) => {
    try {
      setLoading(prev => ({ ...prev, scan: true }));
      setError(null);
      
      // Set the selected device
      setSelectedDevice(device);
      
      // Generate a default name based on vendor/manufacturer or IP
      let defaultName = '';
      
      if (device.vendor) {
        defaultName = device.vendor.toLowerCase().replace(/[^a-z0-9]/g, '_');
      } else if (device.manufacturer) {
        defaultName = device.manufacturer.toLowerCase().replace(/[^a-z0-9]/g, '_');
      } else {
        defaultName = `camera_${device.ip.split('.').pop()}`;
      }
      
      // Get the stored credentials for this device
      let username = 'admin';
      let password = '';
      
      if (cameraCredentials[device.ip]) {
        username = cameraCredentials[device.ip].username;
        password = cameraCredentials[device.ip].password;
      } else if (defaultCredentials.password) {
        username = defaultCredentials.username;
        password = defaultCredentials.password;
      }
      
      const fallbackUrl = `http://${device.ip}/onvif/device_service`; // if discovery didn't supply one
      
      toast.loading('Fetching stream details via ONVIF...');
      
      // Get stream URLs and capabilities for the selected device
      const streamResponse = await getStreamUrls(
        device.ip,
        device.onvifUrl || fallbackUrl,
        username,
        password
      );
      
      if (streamResponse.success) {
        toast.dismiss();
        toast.success('ONVIF stream details retrieved successfully');
        
        // Extract stream configurations from the response
        const { streams, capabilities } = streamResponse;
        
        // Determine optimal codec settings based on ONVIF capabilities
        let forceH264 = false;
        let enableAac = false;
        let enableOpus = false;
        
        // Parse codec information from capabilities if available
        if (capabilities) {
          // Check if H.264 is supported
          if (capabilities.videoEncoders && capabilities.videoEncoders.includes('H264')) {
            // If H.264 is explicitly supported, we don't need to force it
            forceH264 = false;
          } else if (capabilities.videoEncoders && !capabilities.videoEncoders.includes('H264')) {
            // If we know the encoders but H.264 is not included, we should force it
            forceH264 = true;
          }
          
          // Check audio codec capabilities
          if (capabilities.audioEncoders) {
            enableAac = capabilities.audioEncoders.includes('AAC');
            // OPUS is rarely directly supported, but enable it for WebRTC if any audio is available
            enableOpus = capabilities.audioEncoders.length > 0;
          }
        }
        
        // Extract resolution information if available
        let detectWidth = '1024';
        let detectHeight = '768';
        
        if (capabilities && capabilities.resolutions && capabilities.resolutions.length > 0) {
          // Get the highest resolution available for detection
          const highestRes = capabilities.resolutions.sort((a, b) => {
            const aPixels = a.width * a.height;
            const bPixels = b.width * b.height;
            return bPixels - aPixels; // Sort descending
          })[0];
          
          if (highestRes) {
            // Limit to reasonable max size for object detection
            const maxDetectPixels = 1920 * 1080;
            if (highestRes.width * highestRes.height <= maxDetectPixels) {
              detectWidth = highestRes.width.toString();
              detectHeight = highestRes.height.toString();
            } else {
              // Scale down to reasonable size while maintaining aspect ratio
              const aspectRatio = highestRes.width / highestRes.height;
              if (aspectRatio > 1) { // Wider than tall
                detectWidth = '1920';
                detectHeight = Math.round(1920 / aspectRatio).toString();
              } else {
                detectHeight = '1080';
                detectWidth = Math.round(1080 * aspectRatio).toString();
              }
            }
          }
        }
        
        // Update form with all information
        setFormData(prev => ({
          ...prev,
          name: defaultName,
          rtspUrl: streams.mainStream || device.rtspUrl || '',
          subStreamUrl: streams.subStream || '',
          forceH264,
          enableAac,
          enableOpus,
          detectWidth,
          detectHeight
        }));
        
        setSuccess(`Device selected: ${device.manufacturer || device.vendor || ''} ${device.model || ''}`);
        
        // If stream URL is available, test it directly with the retrieved values
        if (streams.mainStream) {
          // Pass direct values instead of relying on form state
          handleTestStream(streams.mainStream, defaultName);
        }
      } else {
        toast.dismiss();
        toast.error('Failed to get stream details via ONVIF');
        setError('Failed to get stream URLs: ' + streamResponse.message);
      }
    } catch (error) {
      toast.dismiss();
      toast.error('Error connecting to camera');
      setError(`Error getting stream URLs: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, scan: false }));
    }
  };
  
  const handleTestStream = async (directUrl = null, directName = null) => {
    // Use direct parameters if provided, otherwise use form state
    const rtspUrl = directUrl || formData.rtspUrl;
    const name = directName || formData.name;

    // If using custom URL, skip actual testing but mark as "tested"
    if (formData.useCustomUrl && formData.customCameraUrl) {
      setStreamTested(true);
      setStreamValid(true); // Assume valid for custom URLs
      setSuccess('Custom URL will be used as-is without testing');
      return;
    }
    
    if (!rtspUrl) {
      setError('Please provide a valid RTSP URL');
      return;
    }
    
    if (!name) {
      setError('Please provide a camera name before testing the stream');
      return;
    }
    
    if (nameExists && !directName) {
      setError('A camera with this name already exists. Please use a unique name.');
      return;
    }
    
    if (rtspUrlExists && !directUrl) {
      setError('This RTSP URL is already in use by another camera.');
      return;
    }
    
    try {
      setLoading(prev => ({ ...prev, test: true }));
      setError(null);
      
      const response = await testStreamWithSnapshot(name, rtspUrl);
      
      if (response.success) {
        setStreamTested(true);
        setStreamValid(response.isAccessible);
        
        if (response.isAccessible) {
          setSuccess('Stream connection successful!');
          setSnapshotUrl(response.snapshotUrl);
        } else {
          setError('Stream test failed: Cannot connect to stream');
        }
      } else {
        setStreamTested(true);
        setStreamValid(false);
        setError(`Stream test failed: ${response.message}`);
      }
    } catch (error) {
      setStreamTested(true);
      setStreamValid(false);
      setError(`Error testing stream: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, test: false }));
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Handle checkbox (boolean) inputs
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
      
      // If toggling useCustomUrl
      if (name === 'useCustomUrl') {
        setStreamTested(false);
        setStreamValid(false);
        setSnapshotUrl('');
      }
      
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Reset stream validation when input changes
    if (name === 'rtspUrl' || name === 'customCameraUrl') {
      setStreamTested(false);
      setStreamValid(false);
      setSnapshotUrl('');
    }
    
    // Reset snapshot when camera name changes
    if (name === 'name') {
      setSnapshotUrl('');
    }
  };
  
  // Handle selecting and deselecting objects to track
  const handleObjectToggle = (object) => {
    setSelectedObjects(prev => {
      if (prev.includes(object)) {
        return prev.filter(obj => obj !== object);
      } else {
        return [...prev, object];
      }
    });
    
    // Also update the form data
    setFormData(prev => {
      if (prev.objectsToTrack.includes(object)) {
        return {
          ...prev,
          objectsToTrack: prev.objectsToTrack.filter(obj => obj !== object)
        };
      } else {
        return {
          ...prev,
          objectsToTrack: [...prev.objectsToTrack, object]
        };
      }
    });
  };
  
  // Filter objects based on search query
  const filteredObjects = availableObjects.filter(obj => 
    obj.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Refresh snapshot image
  const refreshSnapshot = () => {
    if (snapshotUrl && formData.name && formData.rtspUrl) {
      setSnapshotUrl(getCameraSnapshotUrl(formData.name, formData.rtspUrl));
    }
  };
  
  const validateForm = () => {
    if (!formData.name) {
      setError('Camera name is required.');
      return false;
    }
    
    if (formData.useCustomUrl && !formData.customCameraUrl) {
      setError('Custom camera URL is required when using custom URL mode.');
      return false;
    }
    
    if (!formData.useCustomUrl && !formData.rtspUrl) {
      setError('Stream URL is required when not using custom URL mode.');
      return false;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(formData.name)) {
      setError('Camera name can only contain letters, numbers, and underscores.');
      return false;
    }
    
    if (formData.name.length > 32) {
      setError('Camera name must be 32 characters or less.');
      return false;
    }
    
    if (nameExists) {
      setError('A camera with this name already exists. Please use a unique name.');
      return false;
    }
    
    if (!formData.useCustomUrl && rtspUrlExists) {
      setError('This RTSP URL is already in use by another camera.');
      return false;
    }
    
    // For custom URL, we skip stream testing
    if (formData.useCustomUrl) {
      return true;
    }
    
    // For RTSP URLs, if the stream has been tested and is invalid, warn but allow saving
    if (!streamValid && streamTested) {
      setShowConfirmDialog(true);
      return false;
    }
    
    if (!streamTested) {
      setError('Please test the stream before saving.');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    await saveCameraData();
  };
  
  const saveCameraData = async () => {
    try {
      setLoading(prev => ({ ...prev, save: true }));
      
      // Prepare the camera data
      const cameraData = {
        name: formData.name,
        rtspUrl: formData.useCustomUrl ? '' : formData.rtspUrl,
        subStreamUrl: formData.useCustomUrl ? '' : formData.subStreamUrl,
        detectWidth: parseInt(formData.detectWidth) || 1024,
        detectHeight: parseInt(formData.detectHeight) || 768,
        recordEnabled: formData.recordEnabled,
        recordRetainMode: formData.recordRetainMode,
        recordRetainDays: parseInt(formData.recordRetainDays) || 7,
        objectsToTrack: formData.objectsToTrack,
        forceH264: formData.forceH264,
        enableAac: formData.enableAac,
        enableOpus: formData.enableOpus,
        customCameraUrl: formData.useCustomUrl ? formData.customCameraUrl : ''
      };
      
      console.log("Saving camera data:", cameraData); // For debugging
      
      const response = await addOrUpdateCamera(cameraData);
      
      if (response.success) {
        setSuccess('Camera added successfully!');
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        setError(`Failed to add camera: ${response.message}`);
      }
    } catch (error) {
      setError(`Error adding camera: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, save: false }));
    }
  };
  
  const handleConfirmSave = () => {
    setShowConfirmDialog(false);
    saveCameraData();
  };
  
  // Update the deviceState mapping to show ONVIF status instead of activation status
  const getDeviceState = (device) => {
    if (!device) return '';
    return device.onvifUrl ? 'onvif_ready' : 'onvif_missing';
  };

  // Update handleDeviceClick to use stored credentials
  const handleDeviceClick = (device) => {
    // If we already have credentials for this camera, use them directly
    if (cameraCredentials[device.ip]) {
      handleSelectDevice(device);
    } else if (defaultCredentials.password) {
      // Use default credentials if provided
      setCameraCredentials(prev => ({
        ...prev,
        [device.ip]: {
          username: defaultCredentials.username,
          password: defaultCredentials.password
        }
      }));
      handleSelectDevice(device);
    } else {
      // Otherwise, show password dialog
      setSelectedCameraForPassword(device);
      setUsernameInput('admin'); // Default username
      setPasswordInput('');
      setShowPasswordDialog(true);
    }
  };

  // Update handlePasswordSubmit to save credentials to localStorage
  const handlePasswordSubmit = () => {
    if (!selectedCameraForPassword || !passwordInput) return;
    
    // Save both username and password
    const newCredentials = {
      ...cameraCredentials,
      [selectedCameraForPassword.ip]: {
        username: usernameInput,
        password: passwordInput
      }
    };
    
    setCameraCredentials(newCredentials);
    
    // Save to localStorage
    try {
      localStorage.setItem('cameraCredentials', JSON.stringify(newCredentials));
    } catch (e) {
      console.error('Error saving camera credentials:', e);
    }
    
    // Use the device with the provided credentials
    handleSelectDevice(selectedCameraForPassword);
    
    // Close dialog and reset
    setShowPasswordDialog(false);
    setPasswordInput('');
  };

  // Update the button in device list to just "Select"
  const getDeviceActionButton = (device) => {
    return (
      <Button
        variant={device.onvifUrl ? "success" : "secondary"}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          handleDeviceClick(device);
        }}
      >
        {device.onvifUrl ? "Use" : "Select"}
      </Button>
    );
  };

  // Update Password Dialog to include username input
  const renderPasswordDialog = () => (
    <Modal show={showPasswordDialog} onHide={() => setShowPasswordDialog(false)}>
      <Modal.Header closeButton>
        <Modal.Title>Enter Camera Credentials</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Please enter the credentials for this camera:</p>
        <p className="text-muted small mb-3">
          These will be used to access the camera's ONVIF services.
        </p>
        <Form.Group className="mb-3">
          <Form.Label>Username</Form.Label>
          <Form.Control
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="Enter camera username (usually admin)"
          />
        </Form.Group>
        <Form.Group>
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Enter camera password"
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
        <Button 
          variant="primary" 
          onClick={handlePasswordSubmit}
          disabled={!passwordInput}
        >
          Connect to Camera
        </Button>
      </Modal.Footer>
    </Modal>
  );
  
  // Show credentials dialog before scanning
  const handleStartScan = () => {
    setShowCredentialsDialog(true);
  };

  // Update handleCredentialsSubmit to save default credentials to localStorage
  const handleCredentialsSubmit = () => {
    // Save to localStorage
    try {
      localStorage.setItem('defaultCredentials', JSON.stringify(defaultCredentials));
    } catch (e) {
      console.error('Error saving default credentials:', e);
    }

    setShowCredentialsDialog(false);
    handleScanDevices();
  };

  // Bulk add all discovered cameras
  const handleBulkAdd = async () => {
    if (discoveredDevices.length === 0) {
      toast.error('No cameras found to add');
      return;
    }
    
    try {
      setProcessingBulkAdd(true);
      setBulkAddResults([]);
      toast.loading(`Adding ${discoveredDevices.length} cameras...`);
      
      const results = [];
      
      // Process cameras one by one
      for (let i = 0; i < discoveredDevices.length; i++) {
        const device = discoveredDevices[i];
        const result = { camera: device, status: 'pending' };
        results.push(result);
        setBulkAddResults([...results]);
        
        try {
          // Generate a unique name
          const baseName = device.manufacturer?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 
                           device.vendor?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 
                           'camera';
          const nameIndex = i + 1;
          const cameraName = `${baseName}_${nameIndex}`;
          
          // Update credential retrieval
          let username = 'admin';
          let password = '';
          
          if (cameraCredentials[device.ip]) {
            username = cameraCredentials[device.ip].username;
            password = cameraCredentials[device.ip].password;
          } else if (defaultCredentials.password) {
            username = defaultCredentials.username;
            password = defaultCredentials.password;
          }
          
          const deviceOnvifUrl = `http://${device.ip}/onvif/device_service`;
          
          const streamResponse = await getStreamUrls(
            device.ip,
            device.onvifUrl || deviceOnvifUrl,
            username,
            password
          );
          
          if (!streamResponse.success) {
            result.status = 'failed';
            result.error = 'Failed to get stream URLs';
            continue;
          }
          
          // Prepare camera data
          const { streams, capabilities } = streamResponse;
          
          // Check if the RTSP URL already exists in the system
          if (streams.mainStream) {
            const rtspExists = await checkRtspUrlExists(streams.mainStream);
            if (rtspExists) {
              result.status = 'failed';
              result.error = 'Camera with this RTSP URL already exists';
              continue;
            }
          } else {
            result.status = 'failed';
            result.error = 'No valid stream URL found';
            continue;
          }
          
          // Determine codec settings
          let forceH264 = false;
          let enableAac = false;
          let enableOpus = false;
          
          if (capabilities) {
            if (capabilities.videoEncoders && capabilities.videoEncoders.includes('H264')) {
              forceH264 = false;
            } else if (capabilities.videoEncoders && !capabilities.videoEncoders.includes('H264')) {
              forceH264 = true;
            }
            
            if (capabilities.audioEncoders) {
              enableAac = capabilities.audioEncoders.includes('AAC');
              enableOpus = capabilities.audioEncoders.length > 0;
            }
          }
          
          // Determine resolution
          let detectWidth = '1024';
          let detectHeight = '768';
          
          if (capabilities && capabilities.resolutions && capabilities.resolutions.length > 0) {
            const highestRes = capabilities.resolutions.sort((a, b) => {
              const aPixels = a.width * a.height;
              const bPixels = b.width * b.height;
              return bPixels - aPixels;
            })[0];
            
            if (highestRes) {
              const maxDetectPixels = 1920 * 1080;
              if (highestRes.width * highestRes.height <= maxDetectPixels) {
                detectWidth = highestRes.width.toString();
                detectHeight = highestRes.height.toString();
              } else {
                const aspectRatio = highestRes.width / highestRes.height;
                if (aspectRatio > 1) {
                  detectWidth = '1920';
                  detectHeight = Math.round(1920 / aspectRatio).toString();
                } else {
                  detectHeight = '1080';
                  detectWidth = Math.round(1080 * aspectRatio).toString();
                }
              }
            }
          }
          
          // Create camera data
          const cameraData = {
            name: cameraName,
            rtspUrl: streams.mainStream || '',
            subStreamUrl: streams.subStream || '',
            detectWidth: parseInt(detectWidth) || 1024,
            detectHeight: parseInt(detectHeight) || 768,
            recordEnabled: true,
            recordRetainMode: 'motion',
            recordRetainDays: 7,
            objectsToTrack: ['person', 'car'],
            forceH264,
            enableAac,
            enableOpus,
            customCameraUrl: ''
          };
          
          // Add the camera
          const addResponse = await addOrUpdateCamera(cameraData);
          
          if (addResponse.success) {
            result.status = 'success';
            result.name = cameraName;
          } else {
            result.status = 'failed';
            result.error = addResponse.message;
          }
        } catch (error) {
          result.status = 'failed';
          result.error = error.message;
        }
        
        // Update results
        setBulkAddResults([...results]);
      }
      
      toast.dismiss();
      
      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = results.filter(r => r.status === 'failed').length;
      const duplicateCount = results.filter(r => r.error === 'Camera with this RTSP URL already exists').length;
      
      if (successCount > 0) {
        toast.success(`Added ${successCount} of ${discoveredDevices.length} cameras`);
      } else {
        if (duplicateCount > 0) {
          toast.error(`Failed to add any cameras (${duplicateCount} already exist)`);
        } else {
          toast.error('Failed to add any cameras');
        }
      }
      
    } catch (error) {
      toast.dismiss();
      toast.error(`Error during bulk add: ${error.message}`);
    } finally {
      setProcessingBulkAdd(false);
    }
  };

  // Add Default Credentials Dialog Component
  const renderCredentialsDialog = () => (
    <Modal show={showCredentialsDialog} onHide={() => setShowCredentialsDialog(false)}>
      <Modal.Header closeButton>
        <Modal.Title>ONVIF Authentication</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Enter default credentials for ONVIF cameras:</p>
        <p className="text-muted small mb-3">
          These will be used for all cameras unless individual passwords are provided.
        </p>
        <Form.Group className="mb-3">
          <Form.Label>Username</Form.Label>
          <Form.Control
            type="text"
            value={defaultCredentials.username}
            onChange={(e) => setDefaultCredentials({...defaultCredentials, username: e.target.value})}
            placeholder="Enter default username (usually admin)"
          />
        </Form.Group>
        <Form.Group>
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            value={defaultCredentials.password}
            onChange={(e) => setDefaultCredentials({...defaultCredentials, password: e.target.value})}
            placeholder="Enter default password"
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setShowCredentialsDialog(false)}>Cancel</Button>
        <Button 
          variant="primary" 
          onClick={handleCredentialsSubmit}
        >
          Start Scan
        </Button>
      </Modal.Footer>
    </Modal>
  );

  // Add Bulk Add Results Dialog
  const renderBulkAddResults = () => (
    <Modal show={processingBulkAdd || bulkAddResults.length > 0} 
           onHide={() => setBulkAddResults([])} 
           backdrop={processingBulkAdd ? 'static' : true}
           keyboard={!processingBulkAdd}
           size="lg">
      <Modal.Header closeButton={!processingBulkAdd}>
        <Modal.Title>Bulk Add Results</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{maxHeight: '60vh', overflowY: 'auto'}}>
        {processingBulkAdd && (
          <div className="text-center mb-3">
            <Spinner animation="border" />
            <p className="mt-2">Processing cameras...</p>
          </div>
        )}
        
        {bulkAddResults.length > 0 && (
          <>
            {/* Summary section */}
            {!processingBulkAdd && (
              <div className="mb-3">
                <strong>Summary: </strong>
                <Badge bg="success" className="me-2">Success: {bulkAddResults.filter(r => r.status === 'success').length}</Badge>
                <Badge bg="warning" className="me-2">Duplicates: {bulkAddResults.filter(r => r.error === 'Camera with this RTSP URL already exists').length}</Badge>
                <Badge bg="danger">Other Failures: {bulkAddResults.filter(r => r.status === 'failed' && r.error !== 'Camera with this RTSP URL already exists').length}</Badge>
              </div>
            )}

            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Camera</th>
                  <th>IP</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {bulkAddResults.map((result, index) => (
                  <tr key={index} className={result.error === 'Camera with this RTSP URL already exists' ? 'table-warning' : ''}>
                    <td>{result.camera.manufacturer || result.camera.vendor || 'Camera'} {result.name || ''}</td>
                    <td>{result.camera.ip}</td>
                    <td>
                      {result.status === 'pending' && <Spinner animation="border" size="sm" />}
                      {result.status === 'success' && <span className="text-success">Success</span>}
                      {result.status === 'failed' && result.error === 'Camera with this RTSP URL already exists' && (
                        <span className="text-warning">Duplicate</span>
                      )}
                      {result.status === 'failed' && result.error !== 'Camera with this RTSP URL already exists' && (
                        <span className="text-danger">Failed</span>
                      )}
                    </td>
                    <td>
                      {result.status === 'failed' && result.error}
                      {result.status === 'success' && `Added as ${result.name}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        {!processingBulkAdd && (
          <Button variant="primary" onClick={() => setBulkAddResults([])}>
            Close
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
  
  return (
    <div className="frigatesimpleui-container">
      <div className="d-flex align-items-center mb-4">
        <FrigateSimpleUILogo className="me-3" />
        <h2 className="mb-0 text-frigatesimpleui-primary">Add Camera</h2>
      </div>
      
      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
          {success}
        </Alert>
      )}
      
      <div className="mb-4 alert alert-frigatesimpleui">
        <p className="mb-0">
          Set up your camera's stream connection below. For advanced settings like motion detection zones, 
          please use the FrigateSimpleUI web interface after completing this basic setup.
        </p>
      </div>
      
      {/* Network Scan Section */}
      <Card className="mb-4 frigatesimpleui-card">
        <Card.Header>
          <h5 className="mb-0">Find ONVIF Cameras on Your Network</h5>
        </Card.Header>
        <Card.Body>
          <div className="d-flex gap-2">
            <Button 
              variant="primary" 
              className="btn-frigatesimpleui-primary"
              onClick={handleStartScan}
              disabled={loading.scan}
            >
              {loading.scan ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Scanning...
                </>
              ) : (
                <>
                  <BsSearch className="me-2" />
                  Scan for ONVIF Cameras
                </>
              )}
            </Button>
            
            {discoveredDevices.length > 0 && (
              <Button 
                variant="success"
                onClick={handleBulkAdd}
                disabled={processingBulkAdd || discoveredDevices.length === 0}
              >
                Bulk Add All Cameras ({discoveredDevices.length})
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
      
      {/* Discovered Devices Section - Updated to show camera state */}
      {discoveredDevices.length > 0 && (
        <Card className="mb-4 frigatesimpleui-card">
          <Card.Header className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Discovered ONVIF Cameras</h5>
          </Card.Header>
          <ListGroup variant="flush">
            {discoveredDevices.map((device, index) => {
              // Display the IP as the main identifier
              const deviceIp = device.ip;
              
              // Get the device state (ONVIF ready or missing)
              const deviceState = getDeviceState(device);
              
              return (
                <ListGroup.Item 
                  key={index} 
                  action 
                  onClick={() => handleDeviceClick(device)}
                  className={`d-flex justify-content-between align-items-center device-item ${
                    selectedDevice?.ip === device.ip ? 'active' : ''
                  }`}
                >
                  <div className="device-info">
                    <div className="device-name">
                      <strong>{deviceIp}</strong>
                      {deviceState === 'onvif_ready' && (
                        <Badge bg="success" className="ms-2">ONVIF Ready</Badge>
                      )}
                      {cameraCredentials[device.ip] && (
                        <Badge bg="info" className="ms-2">Credentials Saved</Badge>
                      )}
                    </div>
                    <div className="device-model text-muted">
                      {device.model || 'Unknown Model'} | {device.manufacturer || device.vendor || 'Unknown Manufacturer'}
                    </div>
                  </div>
                  <div>
                    {getDeviceActionButton(device)}
                  </div>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        </Card>
      )}
      
      {/* Camera Form */}
      <Card className="frigatesimpleui-card">
        <Card.Header>
          <h5 className="mb-0">Camera Details</h5>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Camera Name*</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      placeholder="front_door"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className={`frigatesimpleui-input ${nameExists ? 'is-invalid' : ''}`}
                      isInvalid={nameExists}
                    />
                    {loading.checkName && (
                      <InputGroup.Text>
                        <Spinner animation="border" size="sm" />
                      </InputGroup.Text>
                    )}
                    {nameExists && (
                      <InputGroup.Text className="bg-danger text-white">
                        <BsExclamationTriangle />
                      </InputGroup.Text>
                    )}
                  </InputGroup>
                  {nameExists ? (
                    <Form.Text className="text-danger">
                      A camera with this name already exists. Please use a unique name.
                    </Form.Text>
                  ) : (
                    <Form.Text className="text-muted">
                      Use only letters, numbers, and underscores. Max 32 characters.
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Days to Save Recordings</Form.Label>
                  <Form.Control
                    type="number"
                    placeholder="7"
                    name="recordRetainDays"
                    value={formData.recordRetainDays}
                    onChange={handleInputChange}
                    min="1"
                    max="90"
                    className="frigatesimpleui-input"
                  />
                  <Form.Text className="text-muted">
                    Number of days to keep recordings before auto-deletion
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Use Custom Camera URL"
                name="useCustomUrl"
                checked={formData.useCustomUrl}
                onChange={handleInputChange}
                className="mb-3"
              />
            </Form.Group>
            
            {formData.useCustomUrl ? (
              <Row>
                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label>Custom Camera URL*</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Enter any custom URL format for go2rtc"
                      name="customCameraUrl"
                      value={formData.customCameraUrl}
                      onChange={handleInputChange}
                      required
                      className="frigatesimpleui-input"
                    />
                    <Form.Text className="text-muted">
                      Enter any custom URL format to be passed directly to go2rtc
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>
            ) : (
              <>
                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>Main Stream URL*</Form.Label>
                      <InputGroup>
                        <Form.Control
                          type="text"
                          placeholder="rtsp://username:password@192.168.1.100:554/stream"
                          name="rtspUrl"
                          value={formData.rtspUrl}
                          onChange={handleInputChange}
                          required
                          className={`frigatesimpleui-input ${rtspUrlExists ? 'is-invalid' : ''}`}
                          isInvalid={rtspUrlExists}
                        />
                        {loading.checkUrl && (
                          <InputGroup.Text>
                            <Spinner animation="border" size="sm" />
                          </InputGroup.Text>
                        )}
                        {rtspUrlExists && (
                          <InputGroup.Text className="bg-danger text-white">
                            <BsExclamationTriangle />
                          </InputGroup.Text>
                        )}
                      </InputGroup>
                      {rtspUrlExists ? (
                        <Form.Text className="text-danger">
                          This RTSP URL is already in use by another camera.
                        </Form.Text>
                      ) : (
                        <Form.Text className="text-muted">
                          Enter the complete RTSP URL including any username/password
                        </Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                </Row>
                
                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>Sub Stream URL (Optional)</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="rtsp://username:password@192.168.1.100:554/substream"
                        name="subStreamUrl"
                        value={formData.subStreamUrl}
                        onChange={handleInputChange}
                        className="frigatesimpleui-input"
                      />
                      <Form.Text className="text-muted">
                        If your camera has a lower resolution sub-stream, enter it here
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                
                <Row>
                  <Col md={12}>
                    <Card className="mb-3">
                      <Card.Header className="bg-light">
                        <h6 className="mb-0">Stream Options</h6>
                      </Card.Header>
                      <Card.Body className="py-2">
                        <Row className="align-items-center">
                          <Col md={4}>
                            <Form.Check
                              type="checkbox"
                              id="force-h264"
                              label="Force H264 codec for video"
                              name="forceH264"
                              checked={formData.forceH264}
                              onChange={handleInputChange}
                              className="mb-2"
                            />
                          </Col>
                          <Col md={4}>
                            <Form.Check
                              type="checkbox"
                              id="enable-aac"
                              label="Enable AAC audio"
                              name="enableAac"
                              checked={formData.enableAac}
                              onChange={handleInputChange}
                              className="mb-2"
                            />
                          </Col>
                          <Col md={4}>
                            <Form.Check
                              type="checkbox"
                              id="enable-opus"
                              label="Enable OPUS audio"
                              name="enableOpus"
                              checked={formData.enableOpus}
                              onChange={handleInputChange}
                              className="mb-2"
                            />
                          </Col>
                        </Row>
                        <div className="text-muted small mt-2">
                          <p className="mb-0">These options help with compatibility for different camera models.</p>
                          <ul className="ps-3 mb-0 mt-1">
                            <li>H264: Forces video transcoding to H264 format</li>
                            <li>AAC: Enables AAC audio format for better compatibility</li>
                            <li>OPUS: Adds a stream with OPUS audio for WebRTC support</li>
                          </ul>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </>
            )}
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Enable Recording"
                    name="recordEnabled"
                    checked={formData.recordEnabled}
                    onChange={handleInputChange}
                    className="mb-3"
                  />
                  
                  <Form.Label>Recording Mode</Form.Label>
                  <Form.Select
                    name="recordRetainMode"
                    value={formData.recordRetainMode}
                    onChange={handleInputChange}
                    disabled={!formData.recordEnabled}
                    className="frigatesimpleui-input"
                  >
                    <option value="motion">Motion Detection</option>
                    <option value="active_objects">Active Objects</option>
                    <option value="all">Continuous (24/7)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Objects to Detect</Form.Label>
                  <InputGroup className="mb-2">
                    <Form.Control
                      type="text"
                      placeholder="Search objects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="frigatesimpleui-input"
                    />
                    <InputGroup.Text>
                      <BsSearch />
                    </InputGroup.Text>
                  </InputGroup>
                  
                  <div className="border rounded p-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {loading.objects ? (
                      <div className="text-center py-2">
                        <Spinner animation="border" size="sm" className="text-frigatesimpleui-primary" />
                        <span className="ms-2">Loading...</span>
                      </div>
                    ) : filteredObjects.length === 0 ? (
                      <p className="text-center mb-0 py-2">No objects match your search</p>
                    ) : (
                      filteredObjects.map(obj => (
                        <Form.Check 
                          key={obj}
                          type="checkbox"
                          id={`object-${obj}`}
                          label={obj}
                          checked={formData.objectsToTrack.includes(obj)}
                          onChange={() => handleObjectToggle(obj)}
                          className="mb-1"
                        />
                      ))
                    )}
                  </div>
                  <Form.Text className="text-muted">
                    Select which objects you want to detect and track
                  </Form.Text>
                  {/* Selected Object Labels */}
                  <div className="mt-2">
                    {selectedObjects.map(obj => (
                      <Badge 
                        key={obj} 
                        bg="primary" 
                        className="me-2" 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleObjectToggle(obj)}
                      >
                        {obj} <BsX className="ms-1" />
                      </Badge>
                    ))}
                  </div>
                </Form.Group>
              </Col>
            </Row>
            
            {/* Camera Preview Section */}
            {!formData.useCustomUrl && (
              <Row className="mt-3">
                <Col md={12}>
                  <Card className="mb-4">
                    <Card.Header className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-0">Camera Preview</h5>
                      {snapshotUrl && (
                        <Button 
                          variant="outline-secondary" 
                          size="sm" 
                          onClick={refreshSnapshot}
                          disabled={loading.test}
                        >
                          <BsCamera className="me-1" /> Refresh
                        </Button>
                      )}
                    </Card.Header>
                    <Card.Body className="text-center">
                      {snapshotUrl ? (
                        <Image 
                          src={snapshotUrl} 
                          alt="Camera Preview" 
                          thumbnail 
                          className="mw-100" 
                          style={{ maxHeight: '300px', objectFit: 'contain' }}
                        />
                      ) : (
                        <div className="text-center p-4 bg-light">
                          <BsCamera size={48} className="mb-3 text-muted" />
                          <p>Test the stream to see a camera preview</p>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            )}
            
            <div className="d-flex gap-2 mt-4">
              {!formData.useCustomUrl && (
                <Button 
                  variant="outline-primary" 
                  className="btn-outline-frigatesimpleui"
                  onClick={() => handleTestStream(null, null)}
                  disabled={!formData.rtspUrl || loading.test || nameExists || rtspUrlExists}
                  type="button"
                >
                  {loading.test ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Testing...
                    </>
                  ) : (
                    'Test Stream'
                  )}
                </Button>
              )}
              
              <Button 
                variant="primary" 
                className="btn-frigatesimpleui-primary"
                type="submit"
                disabled={loading.save || (!formData.useCustomUrl && !streamTested && !streamValid) || nameExists || (!formData.useCustomUrl && rtspUrlExists)}
              >
                {loading.save ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Saving...
                  </>
                ) : (
                  'Add Camera'
                )}
              </Button>
              
              <Button 
                variant="outline-secondary" 
                onClick={() => navigate('/')}
                type="button"
              >
                Cancel
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
      
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Warning: Stream Test Failed</h5>
                <button type="button" className="btn-close" onClick={() => setShowConfirmDialog(false)}></button>
              </div>
              <div className="modal-body">
                <p>The stream test failed, but you can still save this camera configuration.</p>
                <p>Are you sure you want to continue?</p>
              </div>
              <div className="modal-footer">
                <Button variant="secondary" onClick={() => setShowConfirmDialog(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleConfirmSave}>
                  Save Anyway
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Password Dialog */}
      {renderPasswordDialog()}
      
      {/* Credentials Dialog */}
      {renderCredentialsDialog()}
      
      {/* Bulk Add Results Dialog */}
      {renderBulkAddResults()}
      
      {/* Footer */}
      <footer className="frigatesimpleui-footer mt-5">
        <div className="container">
          <p className="mb-0">FrigateSimpleUI Camera Setup - For advanced configuration options, visit the FrigateSimpleUI web interface.</p>
        </div>
      </footer>
    </div>
  );
};

export default AddCamera;
