# Contexts Directory

React Context providers for global state management.

## What Goes Here

- Authentication context (user state, login/logout)
- Theme context (dark mode, user preferences)
- Application-wide state that needs to be accessed by many components
- Each context file should include:
  - Context creation
  - Provider component
  - Custom hook for consuming the context

## Example Structure

```
AuthContext.tsx
ThemeContext.tsx
VideoContext.tsx
```

Use contexts for state that truly needs to be global. For local state, use component state or custom hooks.
