"""single-use nonces for the Canvas sign-in

Revision ID: a41f6e0d7b52
Revises: dc3868b32385
Create Date: 2026-10-29 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a41f6e0d7b52'
down_revision: Union[str, Sequence[str], None] = 'dc3868b32385'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('oauth_nonces',
    sa.Column('nonce', sa.String(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('nonce')
    )
    op.create_index('ix_oauth_nonces_expires', 'oauth_nonces', ['expires_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_oauth_nonces_expires', table_name='oauth_nonces')
    op.drop_table('oauth_nonces')
