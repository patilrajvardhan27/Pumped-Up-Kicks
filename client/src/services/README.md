# Services Directory

API clients and external service integrations.

## What Goes Here

- API client functions that communicate with the backend
- HTTP request wrappers (axios, fetch)
- WebSocket clients
- Third-party service integrations
- Examples:
  - `api.ts` - Base API configuration
  - `videoService.ts` - Video-related API calls
  - `authService.ts` - Authentication endpoints
  - `transcriptionService.ts` - Transcription API
  - `uploadService.ts` - File upload handling

## Best Practices

- Keep services separate from components
- Handle errors consistently
- Return typed responses
- Use async/await for cleaner code
