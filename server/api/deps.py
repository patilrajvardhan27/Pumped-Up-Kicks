"""
Request dependencies.

Deliberately, there is no plain `get_db`. The only way to obtain a session in a
route is `get_ctx`, which hands back a session *and* the authenticated user
together — so writing a query with no owner takes effort rather than being the
path of least resistance.
"""
from dataclasses import dataclass
from typing import Generator, Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from api.config import settings
from api.models.database import User, get_session
from api.services.auth import AuthError, claims_to_profile, dev_profile, verify_clerk_token


@dataclass
class RequestContext:
    """Everything a route needs to act on behalf of exactly one user."""

    db: Session
    user: User

    @property
    def user_id(self) -> str:
        return self.user.id


def _upsert_user(db: Session, profile: dict) -> User:
    """Identity lives in Clerk; this mirrors just enough of it to hang rows off."""
    user = db.get(User, profile["id"])

    if user is None:
        user = User(
            id=profile["id"],
            email=profile["email"],
            display_name=profile.get("display_name"),
            plan="free",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"[Auth] Created local user {user.id}")
        return user

    # Keep the mirror fresh when the profile changes upstream.
    changed = False
    if profile.get("email") and user.email != profile["email"]:
        user.email = profile["email"]
        changed = True
    if profile.get("display_name") and user.display_name != profile["display_name"]:
        user.display_name = profile["display_name"]
        changed = True
    if changed:
        db.commit()

    return user


def get_ctx(
    authorization: Optional[str] = Header(default=None),
) -> Generator[RequestContext, None, None]:
    """Resolve the caller, open a session, and guarantee it is closed."""
    db = get_session()
    try:
        if settings.auth_mode == "dev":
            profile = dev_profile()
        else:
            if not authorization or not authorization.lower().startswith("bearer "):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Sign in to continue.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            token = authorization.split(" ", 1)[1].strip()
            try:
                profile = claims_to_profile(verify_clerk_token(token))
            except AuthError as e:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=str(e),
                    headers={"WWW-Authenticate": "Bearer"},
                )

        user = _upsert_user(db, profile)
        yield RequestContext(db=db, user=user)
    finally:
        db.close()


Ctx = Depends(get_ctx)
