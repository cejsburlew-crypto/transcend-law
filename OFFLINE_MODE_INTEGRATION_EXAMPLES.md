# Offline Mode Integration Examples

This document provides practical examples for integrating offline mode into Transcend Law components.

## 1. App.tsx Setup

```typescript
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { OfflineProvider } from './context/OfflineContext';
import { OfflineIndicator } from './components/OfflineIndicator';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  return (
    <OfflineProvider enablePWA={true} enableAutoSync={true}>
      <BrowserRouter>
        {isAuthenticated && <OfflineIndicator position="top" />}
        
        {isAuthenticated ? <Dashboard /> : <Login />}
      </BrowserRouter>
    </OfflineProvider>
  );
}

export default App;
```

## 2. Service Provider Discovery with Offline Cache

```typescript
import React, { useEffect, useState } from 'react';
import { useOffline } from '../context/OfflineContext';
import { api } from '../services/api';

interface ServiceProvider {
  id: string;
  name: string;
  specialty: string;
  rating: number;
}

export function ServiceProviders() {
  const { 
    isOnline, 
    getCacheData, 
    setCacheData, 
    queueOperation 
  } = useOffline();
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      // Check cache first
      const cached = await getCacheData<ServiceProvider[]>('providers');
      if (cached) {
        setProviders(cached);
      }

      // If online, fetch fresh data
      if (isOnline) {
        const token = localStorage.getItem('token');
        if (token) {
          const data = await api.getProfessionals(token);
          setProviders(data);
          
          // Cache for 1 hour
          await setCacheData('providers', data, 3600000);
        }
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProvider = async (providerId: string) => {
    if (!isOnline) {
      // Queue operation for offline
      const opId = await queueOperation({
        type: 'create',
        entityType: 'referral',
        entityId: `new-${Date.now()}`,
        data: {
          providerId,
          timestamp: Date.now(),
          status: 'pending'
        }
      });
      console.log('Referral queued for sync:', opId);
    } else {
      // Send immediately if online
      const token = localStorage.getItem('token');
      if (token) {
        const response = await fetch('/api/referrals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ providerId })
        });
        if (response.ok) {
          console.log('Referral sent successfully');
        }
      }
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="service-providers">
      <h2>Available Providers</h2>
      {!isOnline && <p className="offline-notice">Working offline</p>}
      
      <div className="providers-grid">
        {providers.map(provider => (
          <div key={provider.id} className="provider-card">
            <h3>{provider.name}</h3>
            <p>{provider.specialty}</p>
            <p>Rating: {provider.rating}/5</p>
            <button onClick={() => handleSelectProvider(provider.id)}>
              Select Provider
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 3. Client Intake Form with Offline Support

```typescript
import React, { useState } from 'react';
import { useOffline } from '../context/OfflineContext';

interface IntakeFormData {
  name: string;
  email: string;
  phone: string;
  serviceType: string;
  description: string;
}

export function ClientIntakeForm() {
  const { isOnline, queueOperation, syncNow } = useOffline();
  const [formData, setFormData] = useState<IntakeFormData>({
    name: '',
    email: '',
    phone: '',
    serviceType: '',
    description: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isOnline) {
        // Send immediately if online
        const token = localStorage.getItem('token');
        const response = await fetch('/api/intakes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });

        if (response.ok) {
          setSubmitted(true);
          setFormData({
            name: '',
            email: '',
            phone: '',
            serviceType: '',
            description: ''
          });
        }
      } else {
        // Queue for offline
        const opId = await queueOperation({
          type: 'create',
          entityType: 'intake',
          entityId: `intake-${Date.now()}`,
          data: formData
        });

        setSubmitted(true);
        console.log('Intake form queued:', opId);
      }
    } catch (error) {
      console.error('Failed to submit intake:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSync = async () => {
    const result = await syncNow();
    console.log(`Sync complete: ${result.successful} successful, ${result.failed} failed`);
  };

  return (
    <div className="intake-form">
      <h2>Service Intake Form</h2>
      
      {!isOnline && (
        <div className="offline-banner">
          <p>You're working offline. Your submission will be sent when you reconnect.</p>
          <button onClick={handleManualSync}>Sync Now</button>
        </div>
      )}

      {submitted && (
        <div className="success-message">
          <p>
            {isOnline 
              ? 'Thank you! Your intake form has been submitted.'
              : 'Thank you! Your form will be submitted when you reconnect.'}
          </p>
        </div>
      )}

      {!submitted && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="serviceType">Service Type</label>
            <select
              id="serviceType"
              name="serviceType"
              value={formData.serviceType}
              onChange={handleChange}
              required
            >
              <option value="">Select a service</option>
              <option value="legal">Legal Services</option>
              <option value="notary">Notary Services</option>
              <option value="tax">Tax Preparation</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      )}
    </div>
  );
}
```

## 4. Payment Processing with Offline Queue

```typescript
import React, { useState } from 'react';
import { useOffline } from '../context/OfflineContext';

interface Payment {
  id: string;
  amount: number;
  description: string;
}

export function PaymentProcessor() {
  const { 
    isOnline, 
    isSyncing, 
    pendingOperations, 
    queueOperation, 
    syncNow 
  } = useOffline();
  const [payment, setPayment] = useState({ amount: '', description: '' });

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOnline) {
      // Queue payment for offline
      await queueOperation({
        type: 'create',
        entityType: 'payment',
        entityId: `payment-${Date.now()}`,
        data: {
          amount: parseFloat(payment.amount),
          description: payment.description,
          timestamp: Date.now()
        }
      });

      alert('Payment queued. It will be processed when you reconnect.');
      setPayment({ amount: '', description: '' });
    } else {
      // Process immediately
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            amount: parseFloat(payment.amount),
            description: payment.description
          })
        });

        if (response.ok) {
          alert('Payment processed successfully');
          setPayment({ amount: '', description: '' });
        }
      } catch (error) {
        console.error('Payment failed:', error);
      }
    }
  };

  const pendingPayments = pendingOperations.filter(op => op.entityType === 'payment');

  return (
    <div className="payment-processor">
      <h2>Process Payment</h2>

      {!isOnline && (
        <div className="offline-notice">
          <p>You're offline. Payments will be queued and processed when you reconnect.</p>
        </div>
      )}

      {isSyncing && (
        <div className="syncing-notice">
          <p>Syncing {pendingPayments.length} pending payments...</p>
        </div>
      )}

      <form onSubmit={handlePayment}>
        <div className="form-group">
          <label>Amount</label>
          <input
            type="number"
            value={payment.amount}
            onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
            placeholder="0.00"
            step="0.01"
            required
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <input
            type="text"
            value={payment.description}
            onChange={(e) => setPayment({ ...payment, description: e.target.value })}
            placeholder="Payment description"
            required
          />
        </div>

        <button type="submit" disabled={isSyncing}>
          {isSyncing ? 'Processing...' : 'Process Payment'}
        </button>
      </form>

      {pendingPayments.length > 0 && (
        <div className="pending-payments">
          <h3>Pending Payments</h3>
          <ul>
            {pendingPayments.map(op => (
              <li key={op.id}>
                ${op.data.amount} - {op.data.description}
              </li>
            ))}
          </ul>
          <button onClick={syncNow} disabled={isSyncing}>
            Manual Sync
          </button>
        </div>
      )}
    </div>
  );
}
```

## 5. Document Management with Offline Access

```typescript
import React, { useEffect, useState } from 'react';
import { useOffline } from '../context/OfflineContext';

interface Document {
  id: string;
  name: string;
  url: string;
  size: number;
  cached: boolean;
}

export function DocumentManager() {
  const { 
    isOnline, 
    getCacheData, 
    setCacheData 
  } = useOffline();
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      // Try cache first
      const cached = await getCacheData<Document[]>('documents');
      if (cached) {
        setDocuments(cached);
      }

      // If online, fetch fresh list
      if (isOnline) {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/documents', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setDocuments(data);
          await setCacheData('documents', data, 3600000);
        }
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleCacheDocument = async (doc: Document) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(doc.url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const cachedDoc = {
          ...doc,
          cached: true,
          data: await blobToBase64(blob)
        };

        await setCacheData(`document-${doc.id}`, cachedDoc);
        alert(`Document "${doc.name}" cached for offline access`);
      }
    } catch (error) {
      console.error('Failed to cache document:', error);
    }
  };

  const handleViewDocument = async (doc: Document) => {
    if (doc.cached) {
      const cached = await getCacheData(`document-${doc.id}`);
      if (cached) {
        // Open cached document
        const base64 = cached.data;
        const blobUrl = 'data:application/pdf;base64,' + base64;
        window.open(blobUrl, '_blank');
        return;
      }
    }

    if (isOnline) {
      window.open(doc.url, '_blank');
    } else {
      alert('Document not cached. Please cache it while online.');
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  };

  return (
    <div className="document-manager">
      <h2>My Documents</h2>

      {!isOnline && <p className="offline-notice">Offline mode - Using cached documents</p>}

      <div className="documents-list">
        {documents.map(doc => (
          <div key={doc.id} className="document-item">
            <div className="document-info">
              <h3>{doc.name}</h3>
              <p>{(doc.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>

            <div className="document-actions">
              <button onClick={() => handleViewDocument(doc)}>
                View
              </button>

              {!doc.cached && isOnline && (
                <button onClick={() => handleCacheDocument(doc)}>
                  Cache for Offline
                </button>
              )}

              {doc.cached && (
                <span className="badge cached">✓ Cached</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 6. Conflict Resolution UI

```typescript
import React, { useState, useEffect } from 'react';
import { useOffline } from '../context/OfflineContext';

export function ConflictResolver() {
  const { isOnline, pendingOperations, resolveConflict } = useOffline();
  const [conflicts, setConflicts] = useState<string[]>([]);

  useEffect(() => {
    const handleConflict = (event: CustomEvent) => {
      const { operationId } = event.detail;
      setConflicts(prev => [...prev, operationId]);
    };

    window.addEventListener('offline-conflict', handleConflict as EventListener);
    return () => window.removeEventListener('offline-conflict', handleConflict as EventListener);
  }, []);

  const handleResolve = async (operationId: string, strategy: 'client-wins' | 'server-wins') => {
    await resolveConflict(operationId, strategy);
    setConflicts(prev => prev.filter(id => id !== operationId));
  };

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div className="conflict-resolver">
      <h2>Conflicting Changes Detected</h2>
      <p>You have conflicting changes to resolve:</p>

      {conflicts.map(operationId => {
        const op = pendingOperations.find(o => o.id === operationId);
        return (
          <div key={operationId} className="conflict-item">
            <h3>Conflict in {op?.entityType}</h3>
            <p>Your changes: {JSON.stringify(op?.data)}</p>
            
            <div className="resolution-options">
              <button 
                onClick={() => handleResolve(operationId, 'client-wins')}
                className="btn-client"
              >
                Keep My Changes
              </button>
              <button 
                onClick={() => handleResolve(operationId, 'server-wins')}
                className="btn-server"
              >
                Use Server Version
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

## Integration Checklist

- [ ] Add `OfflineProvider` to App.tsx
- [ ] Import and use `OfflineIndicator` component
- [ ] Add offline-first caching to critical pages
- [ ] Implement offline operation queuing in forms
- [ ] Add manual sync button in UI
- [ ] Handle conflict resolution UI
- [ ] Test offline functionality
- [ ] Verify service worker registration
- [ ] Check IndexedDB in DevTools
- [ ] Test sync after reconnection
- [ ] Monitor sync metrics in production
- [ ] Update API endpoints to support `/api/sync/*`

## Testing Commands

```bash
# Test offline mode in browser DevTools
# Chrome DevTools > Network > Offline

# Verify service worker
# Chrome DevTools > Application > Service Workers

# Check IndexedDB
# Chrome DevTools > Application > IndexedDB

# Simulate network speed
# Chrome DevTools > Network > Slow 3G
```
