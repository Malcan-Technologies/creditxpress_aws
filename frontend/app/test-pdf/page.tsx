'use client';

import { useState } from 'react';

export default function TestPDF() {
  const [status, setStatus] = useState('');

  const testDirectDownload = async () => {
    try {
      setStatus('Testing direct signing orchestrator...');
      
      // Test direct call to signing orchestrator
      const response = await fetch('http://localhost:4010/api/signed/cmffiizeo0001zrm14r0geg8o/download', {
        method: 'GET',
        headers: {
          'X-API-Key': 'dev-api-key'
        }
      });
      
      console.log('Direct response status:', response.status);
      console.log('Direct response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const blob = await response.blob();
        console.log('Direct blob size:', blob.size);
        
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setStatus('Direct download successful!');
      } else {
        setStatus(`Direct download failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Direct test error:', error);
      setStatus(`Direct test error: ${error}`);
    }
  };

  const testBackendProxy = async () => {
    try {
      setStatus('Testing backend proxy...');
      
      // Get token
      const token = localStorage.getItem('token');
      if (!token) {
        setStatus('No token found!');
        return;
      }
      
      console.log('Using token:', token.substring(0, 20) + '...');
      
      // Test backend proxy
      const response = await fetch('http://localhost:4001/api/loan-applications/cmffiizeo0001zrm14r0geg8o/pki-pdf', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Backend response status:', response.status);
      console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const blob = await response.blob();
        console.log('Backend blob size:', blob.size);
        
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setStatus('Backend proxy successful!');
      } else {
        const errorText = await response.text();
        console.error('Backend error:', errorText);
        setStatus(`Backend proxy failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Backend test error:', error);
      setStatus(`Backend test error: ${error}`);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>PDF Download Test</h1>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={testDirectDownload} style={{ marginRight: '10px', padding: '10px' }}>
          Test Direct Download (Signing Orchestrator)
        </button>
        <button onClick={testBackendProxy} style={{ padding: '10px' }}>
          Test Backend Proxy
        </button>
      </div>
      <div>
        <strong>Status:</strong> {status}
      </div>
      <div style={{ marginTop: '20px' }}>
        <p>Open browser console (F12) to see detailed logs.</p>
      </div>
    </div>
  );
}
