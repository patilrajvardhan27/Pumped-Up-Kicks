# Uploads Directory

Temporary storage for uploaded files before processing.

## What Goes Here

- User-uploaded video files (temporary)
- Uploaded images or documents
- Files waiting to be processed
- Intermediate processing files

## Important Notes

- This directory should be in `.gitignore`
- Files here are typically temporary
- Should have cleanup jobs to remove old files
- Consider using cloud storage (S3, GCS, Azure Blob) for production
- Set appropriate file size limits
- Implement virus scanning for security

## Workflow

1. User uploads file → saved here
2. File gets processed (transcoding, transcription, etc.)
3. Processed file moves to permanent storage
4. Original upload gets deleted

This directory should not be used for permanent file storage.
