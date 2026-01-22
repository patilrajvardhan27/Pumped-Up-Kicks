# Hooks Directory

Custom React hooks for reusable component logic.

## What Goes Here

- Data fetching hooks (`useVideos`, `useTranscription`)
- Form handling hooks (`useForm`, `useValidation`)
- Browser API hooks (`useLocalStorage`, `useMediaQuery`)
- Business logic hooks that can be shared across components
- Each hook file should follow the naming convention: `useHookName.ts`

## Examples

```
useAuth.ts - Authentication logic
useDebounce.ts - Debouncing values
useFetch.ts - Generic data fetching
useWebSocket.ts - WebSocket connection management
```

Hooks should be pure, testable, and focused on a single responsibility.
