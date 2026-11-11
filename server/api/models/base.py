"""The declarative base every model shares."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
