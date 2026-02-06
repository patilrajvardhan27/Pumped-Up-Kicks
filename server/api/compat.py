"""
Compatibility shim for ChromaDB 0.3.23 with Pydantic 2.x and Python 3.14.

This fixes the import error: `BaseSettings` has been moved to `pydantic-settings`.
"""
import sys


def patch_pydantic():
    """
    Monkey-patch pydantic to provide BaseSettings for ChromaDB 0.3.23.

    ChromaDB 0.3.23 expects BaseSettings to be in pydantic, but in Pydantic 2.x
    it's in pydantic_settings. This shim makes it available in both places.
    """
    try:
        # Import from pydantic_settings
        from pydantic_settings import BaseSettings

        # Make it available as pydantic.BaseSettings
        import pydantic
        pydantic.BaseSettings = BaseSettings

        print("[Compat] ✓ Pydantic compatibility shim applied")

    except Exception as e:
        print(f"[Compat] Warning: Could not apply compatibility shim: {e}")


# Apply patch on import
patch_pydantic()
