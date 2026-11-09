"""Settings are read once at import, so the test environment is set before anything loads."""
import os

os.environ["ENV"] = "development"
os.environ["AUTH_MODE"] = "dev"
