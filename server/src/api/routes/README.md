# Routes Directory

Route definitions that map URLs to controllers.

## What Goes Here

- Route files for each resource
- Examples:
  - `videoRoutes.ts` - `/api/videos/*` endpoints
  - `transcriptionRoutes.ts` - `/api/transcriptions/*` endpoints
  - `authRoutes.ts` - `/api/auth/*` endpoints
  - `index.ts` - Main router combining all routes

## Structure Example

```typescript
router.get('/', controller.getAll);
router.post('/', middleware.authenticate, controller.create);
router.get('/:id', controller.getById);
router.put('/:id', middleware.authenticate, controller.update);
router.delete('/:id', middleware.authenticate, controller.delete);
```

Apply middleware (auth, validation) at the route level.
