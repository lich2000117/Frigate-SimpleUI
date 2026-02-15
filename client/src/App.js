import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import './styles/frigatesimpleui.css';

// Pages
import Dashboard from './pages/Dashboard';
import AddCamera from './pages/AddCamera';
import EditCamera from './pages/EditCamera';

function App() {
  useEffect(() => {
    // Log key information about the environment for debugging
    console.log('App mounted with:', {
      locationPath: window.location.pathname,
      locationOrigin: window.location.origin,
      routerBasename: window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))
    });
  }, []);

  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add-camera" element={<AddCamera />} />
        <Route path="/edit/:name" element={<EditCamera />} />
      </Routes>
    </div>
  );
}

export default App;