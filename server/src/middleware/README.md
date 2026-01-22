# Middleware Directory

Express middleware functions.

## What Goes Here

- `auth.ts` - Authentication middleware
- `errorHandler.ts` - Global error handling
- `validation.ts` - Request validation middleware
- `cors.ts` - CORS configuration
- `rateLimit.ts` - Rate limiting
- `logging.ts` - Request/response logging
- `upload.ts` - File upload handling (multer)

## Middleware Pattern

```typescript
export const middlewareName = (req, res, next) => {
  // Process request
  // Modify req or res
  // Call next() or send response
};
```

Middleware executes in the order it's registered in the app.
