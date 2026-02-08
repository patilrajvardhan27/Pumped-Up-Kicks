'use client';

import { useState, useRef } from 'react';
import { videoService } from '@/services';
import Button from './Button';
import Input from './Input';
import Alert from './Alert';

export default function VideoUpload({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await videoService.uploadVideo(selectedFile, title);
      setSuccess(`Successfully uploaded: ${result.filename}`);
      setSelectedFile(null);
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="text-2xl font-bold text-charcoal-champion mb-4">
        Upload Video 📹
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-midnight-mystery mb-2">
            Select Video File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.avi,.mov,.mkv"
            onChange={handleFileSelect}
            disabled={uploading}
            className="block w-full text-sm text-storm-cloud
                     file:mr-4 file:py-2 file:px-4
                     file:rounded-lg file:border-0
                     file:text-sm file:font-semibold
                     file:bg-electric-blueberry file:text-snowflake-surprise
                     hover:file:bg-soft-serve file:cursor-pointer
                     disabled:opacity-50"
          />
          <p className="text-xs text-slate-skate mt-1">
            Supported formats: MP4, AVI, MOV, MKV
          </p>
        </div>

        {selectedFile && (
          <Input
            label="Video Title (Optional)"
            placeholder="Enter a title for this video"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={uploading}
          />
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={!selectedFile || uploading}
          className="w-full"
        >
          {uploading ? 'Uploading...' : 'Upload Video'}
        </Button>
      </form>

      {success && (
        <div className="mt-4">
          <Alert variant="success" title="Success!">
            {success}
          </Alert>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Alert variant="error" title="Error">
            {error}
          </Alert>
        </div>
      )}
    </div>
  );
}
