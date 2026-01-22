# Jobs Directory

Background jobs and scheduled tasks.

## What Goes Here

- Video processing jobs
- Transcription workers
- Scheduled cleanup tasks
- Email notification jobs
- Periodic data updates
- Examples:
  - `videoProcessingJob.ts` - Process uploaded videos
  - `transcriptionJob.ts` - Generate transcriptions
  - `cleanupJob.ts` - Remove old/temporary files
  - `embeddingJob.ts` - Generate AI embeddings

## Technologies

May use job queues like:
- Bull (Redis-based)
- Agenda (MongoDB-based)
- node-cron for scheduled tasks

Jobs should be idempotent and handle failures gracefully.
