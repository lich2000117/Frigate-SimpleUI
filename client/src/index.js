import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Dynamically determine the basename from the current path when running under Ingress
const getBasename = () => {
  const path = window.location.pathname;
  // If path has multiple segments (like /api/ingress/token/), use everything up to the last slash
  if (path.split('/').filter(Boolean).length > 1) {
    return path.substring(0, path.lastIndexOf('/'));
  }
  // Otherwise use empty string (root)
  return '';
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter basename={getBasename()}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(); 