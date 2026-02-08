'use client';

import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '@/services';

export default function ServerStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    checkServer();
    const interval = setInterval(checkServer, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const checkServer = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.HEALTH);
      if (response.ok) {
        setStatus('online');
      } else {
        setStatus('offline');
      }
    } catch {
      setStatus('offline');
    }
  };

  const statusColors = {
    checking: 'bg-golden-glow text-honey-buzz',
    online: 'bg-limelight text-forest-friend',
    offline: 'bg-blush-berry text-crimson-crisis',
  };

  const statusText = {
    checking: 'Checking...',
    online: 'Server Online',
    offline: 'Server Offline',
  };

  const statusIcon = {
    checking: '⏳',
    online: '✅',
    offline: '❌',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[status]}`}>
      <span>{statusIcon[status]}</span>
      <span>{statusText[status]}</span>
    </div>
  );
}
