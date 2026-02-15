import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Card, Row, Col, Alert, Spinner, InputGroup, Image, Badge } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { BsSearch, BsCamera, BsX } from 'react-icons/bs';
import { getCameras, testStreamWithSnapshot, addOrUpdateCamera, getAvailableDetectObjects, getCameraSnapshotUrl } from '../services/api';
import FrigateSimpleUILogo from '../components/FrigateSimpleUILogo';
import '../styles/frigatesimpleui.css';

const EditCamera = () => {
  const navigate = useNavigate();
  const { name } = useParams();
  
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
  const [loading, setLoading] = useState({ fetch: false, test: false, save: false, objects: false });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [streamTested, setStreamTested] = useState(false);
  const [streamValid, setStreamValid] = useState(false);
  const [availableObjects, setAvailableObjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Fetch available objects in a memoized function to avoid dependency issues
  const fetchAvailableObjects = useCallback(async () => {
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
  }, []);
  
  // Memoize the saveCameraData function to avoid dependency issues
  const saveCameraData = useCallback(async () => {
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
        setSuccess('Camera updated successfully!');
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        setError(`Failed to update camera: ${response.message}`);
      }
    } catch (error) {
      setError(`Error updating camera: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, save: false }));
    }
  }, [formData, navigate, setError, setSuccess, setLoading]);
  
  const handleConfirmSave = useCallback(() => {
    setShowConfirmDialog(false);
    saveCameraData();
  }, [saveCameraData, setShowConfirmDialog]);
  
  // Fetch camera data with useCallback to avoid dependency issues
  const fetchCameraData = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, fetch: true }));
      const response = await getCameras();
      
      if (response.success) {
        const camera = response.cameras.find(cam => cam.name === name);
        
        if (camera) {
          console.log("Found camera data:", camera); // For debugging
          
          // Check if this is a custom URL camera
          const isCustom = camera.customCameraUrl && camera.customCameraUrl.length > 0;
          
          setFormData({
            name: camera.name || '',
            rtspUrl: camera.rtspUrl || '',
            subStreamUrl: camera.subStreamUrl || '',
            recordEnabled: camera.recordEnabled !== false,
            recordRetainMode: camera.recordRetainMode || 'motion',
            recordRetainDays: camera.recordRetainDays?.toString() || '7',
            detectWidth: camera.detectWidth?.toString() || '1024',
            detectHeight: camera.detectHeight?.toString() || '768',
            objectsToTrack: camera.objectsToTrack || ['person', 'car'],
            forceH264: camera.forceH264 === true,
            enableAac: camera.enableAac === true,
            enableOpus: camera.enableOpus === true,
            customCameraUrl: camera.customCameraUrl || '',
            useCustomUrl: isCustom
          });
          
          // Consider the stream valid since it was already saved
          setStreamTested(true);
          setStreamValid(true);
          
          // Set initial snapshot URL with RTSP URL for fallback
          if (camera.rtspUrl) {
            setSnapshotUrl(getCameraSnapshotUrl(camera.name, camera.rtspUrl));
          }
        } else {
          setError(`Camera "${name}" not found`);
          setTimeout(() => navigate('/'), 2000);
        }
      } else {
        setError('Failed to load cameras');
      }
    } catch (error) {
      setError(`Error loading camera: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, fetch: false }));
    }
  }, [name, navigate, setFormData, setError, setStreamTested, setStreamValid, setSnapshotUrl, setLoading]);

  // Load camera data and available objects on mount
  useEffect(() => {
    fetchCameraData();
    fetchAvailableObjects();
  }, [fetchCameraData, fetchAvailableObjects]);
  
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
        // Reset stream validation when switching URL modes
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
    if (name === 'customCameraUrl') {
      setStreamTested(false);
      setStreamValid(false);
      setSnapshotUrl('');
    }
  };
  
  // Handle selecting and deselecting objects to track
  const handleObjectToggle = (object) => {
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
  
  const handleTestStream = async () => {
    // If using custom URL, skip actual testing but mark as "tested"
    if (formData.useCustomUrl && formData.customCameraUrl) {
      setStreamTested(true);
      setStreamValid(true); // Assume valid for custom URLs
      setSuccess('Custom URL will be used as-is without testing');
      return;
    }
    
    if (!formData.rtspUrl) {
      setError('Please provide a valid RTSP URL');
      return;
    }
    
    try {
      setLoading(prev => ({ ...prev, test: true }));
      setError(null);
      
      const response = await testStreamWithSnapshot(formData.name, formData.rtspUrl);
      
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
  
  const validateForm = useCallback(() => {
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
    
    return true;
  }, [formData.name, formData.useCustomUrl, formData.customCameraUrl, formData.rtspUrl, setError]);
  
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    await saveCameraData();
  }, [validateForm, saveCameraData]);
  
  // Refresh snapshot image
  const refreshSnapshot = useCallback(() => {
    if (snapshotUrl && formData.name) {
      setSnapshotUrl(getCameraSnapshotUrl(formData.name, formData.rtspUrl));
    }
  }, [formData.name, formData.rtspUrl, snapshotUrl]);
  
  if (loading.fetch) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" className="text-frigatesimpleui-primary" />
        <p className="mt-3">Loading camera data...</p>
      </div>
    );
  }
  
  return (
    <div className="frigatesimpleui-container">
      <div className="d-flex align-items-center mb-4">
        <FrigateSimpleUILogo className="me-3" />
        <h2 className="mb-0 text-frigatesimpleui-primary">Edit Camera</h2>
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
          Edit your camera's stream connection below. For detailed adjustments like motion detection sensitivity and zones, 
          please use the FrigateSimpleUI web interface after completing this basic setup.
        </p>
      </div>
      
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
                  <Form.Control
                    type="text"
                    placeholder="front_door"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="frigatesimpleui-input"
                    disabled={true} // Lock the camera name field
                  />
                  <Form.Text className="text-muted">
                    Camera name cannot be changed as it is used by FrigateSimpleUI for stream identification.
                  </Form.Text>
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
                      <Form.Control
                        type="text"
                        placeholder="rtsp://username:password@192.168.1.100:554/stream"
                        name="rtspUrl"
                        value={formData.rtspUrl}
                        onChange={handleInputChange}
                        required
                        className="frigatesimpleui-input"
                      />
                      <Form.Text className="text-muted">
                        RTSP URL cannot be changed. If you need to change the URL, delete this camera and add a new one.
                      </Form.Text>
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
                        disabled={true} // Lock the Sub Stream URL field
                      />
                      <Form.Text className="text-muted">
                        Sub Stream URL cannot be changed. If you need to change the URL, delete this camera and add a new one.
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
                  <div className="mt-2">
                    {formData.objectsToTrack.map(obj => (
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
                  onClick={handleTestStream}
                  disabled={!formData.rtspUrl || loading.test}
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
                disabled={loading.save}
              >
                {loading.save ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
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
      
      {/* Footer */}
      <footer className="frigatesimpleui-footer mt-5">
        <div className="container">
          <p className="mb-0">FrigateSimpleUI Camera Setup - For advanced configuration options, visit the FrigateSimpleUI web interface.</p>
        </div>
      </footer>
    </div>
  );
};

export default EditCamera; 