# Config Directory

Configuration files and environment setup.

## What Goes Here

- `database.ts` - Database connection configuration
- `redis.ts` - Redis/cache configuration
- `storage.ts` - File storage configuration
- `env.ts` - Environment variable validation and access
- `constants.ts` - Application-wide constants
- API keys and service configurations

## Best Practices

- Never commit secrets or API keys
- Use environment variables for sensitive data
- Provide sensible defaults for development
- Validate required configuration on startup
- Export typed configuration objects
