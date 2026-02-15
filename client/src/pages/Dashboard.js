import React, { useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Image,
  Modal,
  Row,
  Spinner,
  Badge,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import {
  BsArrowClockwise,
  BsCameraVideo,
  BsCode,
  BsDownload,
  BsPencil,
  BsPlusCircleFill,
  BsTrash,
  BsCpu
} from 'react-icons/bs';

import {
  checkFrigateSimpleUIStatus,
  checkServerConnection,
  getCameras,
  getCameraSnapshotUrl,
  getYamlConfig,
  removeCamera,
  saveConfig,
  getDetectorConfig,
  updateDetectorConfig
} from '../services/api';

import FrigateSimpleUILogo from '../components/FrigateSimpleUILogo';
import '../styles/frigatesimpleui.css';

/**
 * Mask out the password portion of an RTSP URL (if present).
 * E.g. rtsp://user:pass@somehost => rtsp://user:******@somehost
 */
const maskRtspPassword = (url) => {
  if (!url) return 'Not set';

  try {
    const regex = /(rtsp:\/\/)([^:@]+):([^@]+)@(.*)/;
    return regex.test(url)
      ? url.replace(regex, '$1$2:******@$4')
      : url;
  } catch (e) {
    return url;
  }
};

const Dashboard = () => {
  // ----------------------------------
  // States
  // ----------------------------------
  const [cameraList, setCameraList] = useState([]);
  const [isCamerasLoading, setIsCamerasLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);

  // FrigateSimpleUI server
  const [isFrigateSimpleUILoading, setIsFrigateSimpleUILoading] = useState(true);
  const [frigatesimpleUIError, setFrigateSimpleUIError] = useState(null);
  const [setFrigateSimpleUIUrl] = useState('');
  const [isFrigateSimpleUIRestarting, setIsFrigateSimpleUIRestarting] = useState(false);

  // Modals (view YAML, loading)
  const [showFrigateSimpleUILoadingModal, setShowFrigateSimpleUILoadingModal] = useState(false);
  const [showYamlModal, setShowYamlModal] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [isYamlLoading, setIsYamlLoading] = useState(false);

  // Saving config
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Detector configuration states
  const [showDetectorModal, setShowDetectorModal] = useState(false);
  const [detectorConfig, setDetectorConfig] = useState({ enabled: true, type: 'pci' });
  const [isDetectorLoading, setIsDetectorLoading] = useState(false);
  const [detectorError, setDetectorError] = useState(null);

  const navigate = useNavigate();

  // ----------------------------------
  // Effects
  // ----------------------------------

  /**
   * Fetch cameras and check FrigateSimpleUI health on mount.
   */
  useEffect(() => {
    fetchCameras();
    checkFrigateSimpleUIHealth();
  }, []);

  /**
   * Re-check FrigateSimpleUI server status every 5 seconds.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      checkFrigateSimpleUIHealth();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  /**
   * If we're restarting FrigateSimpleUI, show the modal until it's back up.
   */
  useEffect(() => {
    if (isFrigateSimpleUIRestarting) {
      setShowFrigateSimpleUILoadingModal(true);
      if (!isFrigateSimpleUILoading && !frigatesimpleUIError) {
        setShowFrigateSimpleUILoadingModal(false);
        setIsFrigateSimpleUIRestarting(false);
      }
    }
  }, [isFrigateSimpleUIRestarting, isFrigateSimpleUILoading, frigatesimpleUIError]);

  /**
   * Fetch detector configuration when modal is opened
   */
  useEffect(() => {
    if (showDetectorModal) {
      fetchDetectorConfig();
    }
  }, [showDetectorModal]);

  // ----------------------------------
  // Handlers & Helpers
  // ----------------------------------

  /**
   * Check the health of FrigateSimpleUI server.
   * If online, store the URL and clear errors; else record an error.
   */
  const checkFrigateSimpleUIHealth = async () => {
    try {
      const response = await checkFrigateSimpleUIStatus();
      if (response.success) {
        setIsFrigateSimpleUILoading(false);
        setFrigateSimpleUIError(null);
        if (response.frigatesimpleUIUrl) {
          setFrigateSimpleUIUrl(response.frigatesimpleUIUrl);
        }
      } else {
        setFrigateSimpleUIError(response.message || 'FrigateSimpleUI server is not responding');
        setIsFrigateSimpleUILoading(false);
      }
    } catch (error) {
      setFrigateSimpleUIError('Cannot connect to FrigateSimpleUI server');
      setIsFrigateSimpleUILoading(false);
    }
  };

  /**
   * Load cameras from the server, after checking basic server connectivity.
   */
  const fetchCameras = async () => {
    try {
      setIsCamerasLoading(true);
      setGlobalError(null);

      const connectionStatus = await checkServerConnection();
      if (!connectionStatus.connected) {
        setGlobalError('Cannot connect to the server. Please ensure it is running.');
        setIsCamerasLoading(false);
        return;
      }

      const response = await getCameras();
      if (response.success) {
        setCameraList(response.cameras || []);
      } else {
        setGlobalError('Failed to load cameras');
      }
    } catch (error) {
      setGlobalError(`Error loading data: ${error.message}`);
    } finally {
      setIsCamerasLoading(false);
    }
  };

  /**
   * Prompt user, then remove a camera by name, and refresh the list.
   */
  const handleDeleteCamera = async (cameraName) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete camera "${cameraName}"?`
    );
    if (!confirmDelete) return;

    try {
      const response = await removeCamera(cameraName);
      if (response.success) {
        fetchCameras();
      } else {
        setGlobalError('Failed to delete camera');
      }
    } catch (error) {
      setGlobalError(`Error deleting camera: ${error.message}`);
    }
  };

  /**
   * Load the YAML config and display it in a modal.
   */
  const handleViewYaml = async () => {
    try {
      setIsYamlLoading(true);
      const response = await getYamlConfig();
      if (response.success && response.yaml) {
        setYamlContent(response.yaml);
        setShowYamlModal(true);
      } else {
        setGlobalError('Failed to load YAML configuration');
      }
    } catch (error) {
      setGlobalError(`Error loading YAML: ${error.message}`);
    } finally {
      setIsYamlLoading(false);
    }
  };

  /**
   * Save the configuration. Optionally restart the server.
   */
  const handleSaveConfig = async (shouldRestart = false) => {
    try {
      setIsSavingConfig(true);
      const response = await saveConfig(shouldRestart);

      if (response.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);

        if (shouldRestart) {
          // Trigger FrigateSimpleUI server restart flow
          setIsFrigateSimpleUIRestarting(true);
          setIsFrigateSimpleUILoading(true);
          setTimeout(fetchCameras, 5000); // buffer before re-fetch
        } else {
          // Just reload cameras
          fetchCameras();
        }
      } else {
        setGlobalError(`Failed to save config: ${response.message}`);
      }
    } catch (error) {
      setGlobalError(`Error saving config: ${error.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  /**
   * Force-refresh the snapshot image for a specific camera by updating its src.
   */
  const refreshCameraSnapshot = (cameraName) => {
    const imgElement = document.querySelector(`img[data-camera="${cameraName}"]`);
    if (!imgElement) return;

    const camera = cameraList.find((cam) => cam.name === cameraName);
    if (camera) {
      imgElement.src = getCameraSnapshotUrl(camera.name, camera.rtspUrl);
    }
  };

  /**
   * Fetch the current detector configuration
   */
  const fetchDetectorConfig = async () => {
    try {
      setIsDetectorLoading(true);
      setDetectorError(null);
      
      const response = await getDetectorConfig();
      if (response.success) {
        setDetectorConfig(response.config);
      } else {
        setDetectorError('Failed to load detector configuration');
      }
    } catch (error) {
      setDetectorError(`Error loading detector configuration: ${error.message}`);
    } finally {
      setIsDetectorLoading(false);
    }
  };
  
  /**
   * Save detector configuration
   */
  const handleSaveDetectorConfig = async () => {
    try {
      setIsDetectorLoading(true);
      setDetectorError(null);
      
      const response = await updateDetectorConfig(detectorConfig);
      if (response.success) {
        setShowDetectorModal(false);
      } else {
        setDetectorError(`Failed to save detector configuration: ${response.message}`);
      }
    } catch (error) {
      setDetectorError(`Error saving detector configuration: ${error.message}`);
    } finally {
      setIsDetectorLoading(false);
    }
  };

  // ----------------------------------
  // Rendering
  // ----------------------------------

  /**
   * If camera data is still loading, show a spinner.
   */
  if (isCamerasLoading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" className="text-frigatesimpleui-primary" />
        <p className="mt-3">Loading cameras...</p>
      </div>
    );
  }

  /**
   * Detector configuration modal
   */
  const renderDetectorConfigModal = () => (
    <Modal show={showDetectorModal} onHide={() => setShowDetectorModal(false)}>
      <Modal.Header closeButton>
        <Modal.Title>
          <BsCpu className="me-2" />
          Detector Configuration
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {detectorError && (
          <Alert variant="danger" dismissible onClose={() => setDetectorError(null)}>
            {detectorError}
          </Alert>
        )}
        
        <Alert variant="warning">
          <strong>Advanced Setting</strong>
          <p className="mb-0">
            This is an advanced configuration and should only be modified if you understand the implications.
            Incorrect settings may cause FrigateSimpleUI to fail to start or operate incorrectly.
          </p>
        </Alert>
        
        {isDetectorLoading ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
            <p className="mt-3">Loading detector configuration...</p>
          </div>
        ) : (
          <Form>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="enable-coral"
                label="Enable Coral EdgeTPU Detector"
                checked={detectorConfig.enabled}
                onChange={(e) => setDetectorConfig({...detectorConfig, enabled: e.target.checked})}
              />
              <Form.Text className="text-muted">
                Enable hardware acceleration for object detection with Google Coral EdgeTPU.
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Device Type</Form.Label>
              <Form.Select
                value={detectorConfig.type}
                onChange={(e) => setDetectorConfig({...detectorConfig, type: e.target.value})}
                disabled={!detectorConfig.enabled}
              >
                <option value="pci">PCI (M.2/PCIe)</option>
                <option value="usb">USB</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Select the type of Coral device connected to your system.
              </Form.Text>
            </Form.Group>
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setShowDetectorModal(false)}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSaveDetectorConfig}
          disabled={isDetectorLoading}
        >
          {isDetectorLoading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Saving...
            </>
          ) : 'Save Changes'}
        </Button>
      </Modal.Footer>
    </Modal>
  );

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center">
          <FrigateSimpleUILogo className="me-3" />
        </div>
      </div>

      {/* Global Error Alert */}
      {globalError && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setGlobalError(null)}
          className="mb-4"
        >
          {globalError}
        </Alert>
      )}

      {/* Success Alert after saving config */}
      {saveSuccess && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setSaveSuccess(false)}
          className="mb-4"
        >
          Configuration saved successfully!
        </Alert>
      )}

      {/* Intro/Instructions */}
      <div className="mb-4">
        <h1>Setting Up Camera Connections</h1>
        <p className="mb-3">
          <strong>1)</strong> Add a camera → <strong>2)</strong> Save &amp; Restart → <strong>3)</strong> Confirm changes in FrigateSimpleUI Web UI
        </p>
        <Button variant="success" onClick={() => navigate('/add-camera')}>
          <BsPlusCircleFill className="me-2" />
          Add Camera
        </Button>
      </div>

      {/* Camera List */}
      {cameraList.length === 0 ? (
        <div className="text-center my-5">
          <h4>No cameras configured</h4>
          <p>
            Click <strong>Add Camera</strong> to add a new camera, or <strong>Reload Config</strong> if you expect previously configured cameras.
          </p>
        </div>
      ) : (
        <Row>
          {cameraList.map((camera) => (
            <Col key={camera.name} md={6} lg={4} className="mb-4">
              <Card className="frigatesimpleui-card h-100">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <div className="fw-bold">{camera.name}</div>
                  <div>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="me-2"
                      onClick={() => refreshCameraSnapshot(camera.name)}
                      title="Refresh snapshot"
                    >
                      <BsArrowClockwise />
                    </Button>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="me-2 btn-outline-frigatesimpleui"
                      onClick={() => navigate(`/edit/${camera.name}`)}
                    >
                      <BsPencil className="me-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDeleteCamera(camera.name)}
                    >
                      <BsTrash />
                    </Button>
                  </div>
                </Card.Header>
                <div className="camera-snapshot-container">
                  <Image
                    src={getCameraSnapshotUrl(camera.name, camera.rtspUrl)}
                    alt={`${camera.name} preview`}
                    className="card-img-top camera-snapshot"
                    style={{ height: '150px', objectFit: 'cover' }}
                    data-camera={camera.name}
                  />
                </div>
                <Card.Body>
                  <Card.Text>
                    <div>
                      <strong>Main Stream:</strong> {maskRtspPassword(camera.rtspUrl)}
                    </div>
                    {camera.subStreamUrl && (
                      <div>
                        <strong>Sub Stream:</strong> {maskRtspPassword(camera.subStreamUrl)}
                      </div>
                    )}
                    <div className="mt-2">
                      <strong>Days to Save:</strong>{' '}
                      <Badge bg="info">{camera.recordRetainDays || '3'}</Badge>
                    </div>
                    <div className="mt-2">
                      <strong>Recording Mode:</strong>{' '}
                      <Badge bg="secondary">
                        {camera.recordRetainMode === 'motion'
                          ? 'Motion Only'
                          : camera.recordRetainMode === 'all'
                          ? 'Continuous'
                          : camera.recordRetainMode === 'active_objects'
                          ? 'Active Objects'
                          : 'Motion'}
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <strong>Detect:</strong>{' '}
                      {camera.objectsToTrack && camera.objectsToTrack.length > 0
                        ? camera.objectsToTrack.map((obj, index) => (
                            <Badge key={index} bg="primary" className="me-1">
                              {obj}
                            </Badge>
                          ))
                        : <Badge bg="primary" className="me-1">person</Badge>}
                    </div>
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* YAML Configuration Modal */}
      <Modal show={showYamlModal} onHide={() => setShowYamlModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Configuration YAML</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isYamlLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
              <p className="mt-2">Loading configuration...</p>
            </div>
          ) : (
            <Form.Control
              as="textarea"
              rows={20}
              value={yamlContent}
              readOnly
              style={{ fontFamily: 'monospace' }}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowYamlModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* FrigateSimpleUI Loading / Restart Modal */}
      <Modal
        show={showFrigateSimpleUILoadingModal}
        backdrop="static"
        keyboard={false}
        centered
      >
        <Modal.Header>
          <Modal.Title>FrigateSimpleUI Server Status</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-5">
          <BsCameraVideo size={48} className="mb-3 text-primary" />
          <h4>Waiting for FrigateSimpleUI Server</h4>
          <p className="mb-4">Please wait while the FrigateSimpleUI server is starting...</p>
          <Spinner animation="border" variant="primary" />
          <p className="mt-4 small text-muted">
            This may take up to a minute. The window will automatically close when ready.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFrigateSimpleUILoadingModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={checkFrigateSimpleUIHealth}>
            Check Status
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Render detector config modal */}
      {renderDetectorConfigModal()}

      {/* Bottom Control Buttons */}
      <div className="d-flex mb-5">
        <Button
          variant="outline-primary"
          className="btn-outline-frigatesimpleui me-2"
          onClick={handleViewYaml}
        >
          <BsCode className="me-2" />
          View Config
        </Button>
        
        <OverlayTrigger
          placement="top"
          overlay={
            <Tooltip id="detector-config-tooltip">
              Configure Coral EdgeTPU detector (advanced)
            </Tooltip>
          }
        >
          <Button
            variant="outline-secondary"
            className="me-2"
            onClick={() => setShowDetectorModal(true)}
          >
            <BsCpu />
          </Button>
        </OverlayTrigger>
        
        <Button
          variant="warning"
          disabled={isSavingConfig}
          onClick={() => handleSaveConfig(true)}
        >
          <BsDownload className="me-2" />
          Save &amp; Restart
        </Button>
      </div>

      {/* Footer */}
      <footer className="frigatesimpleui-footer mt-5">
        <div className="container">
          <p className="mb-0 text-center">
            FrigateSimpleUI Camera Setup — For advanced configuration, visit the main FrigateSimpleUI interface.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
