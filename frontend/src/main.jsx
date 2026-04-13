import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#1C2333',
              color: '#FAF7F0',
              border: '1px solid rgba(212,168,67,.3)',
              borderRadius: '40px',
              padding: '12px 24px',
              fontFamily: "'Outfit', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              boxShadow: '0 4px 24px rgba(0,0,0,.35)',
            },
            success: { iconTheme: { primary: '#26A86A', secondary: '#0F3D2B' } },
            error:   { iconTheme: { primary: '#FC8181', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
