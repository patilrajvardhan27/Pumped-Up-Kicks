# Controllers Directory

Request handlers that process HTTP requests.

## What Goes Here

- Controller files for each resource/feature
- Examples:
  - `videoController.ts` - Video upload, retrieval, deletion
  - `transcriptionController.ts` - Transcription endpoints
  - `userController.ts` - User management
  - `authController.ts` - Authentication and authorization

## Best Practices

- Keep controllers thin - delegate business logic to services
- Handle request validation
- Format responses consistently
- Return appropriate HTTP status codes
- Catch and forward errors to error middleware
