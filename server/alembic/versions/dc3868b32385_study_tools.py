"""study guides, practice sets and full-text search

Adds stored study guides (one per lecture) and practice sets (per subject), a
ledger of what those Claude calls cost (counted in the monthly quota), and a
full-text index over chunk text for search.

The search index is on the expression to_tsvector('english', text) rather than
a stored column, so the chunks table is not rewritten. It is built
CONCURRENTLY, outside the migration's transaction, so a large table stays
readable and writable while it builds.

Revision ID: dc3868b32385
Revises: c8ac3f0a9197
Create Date: 2026-10-09 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dc3868b32385'
down_revision: Union[str, Sequence[str], None] = 'c8ac3f0a9197'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('usage_charges',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('purpose', sa.String(), nullable=False),
    sa.Column('model', sa.String(), nullable=True),
    sa.Column('input_tokens', sa.Integer(), nullable=True),
    sa.Column('output_tokens', sa.Integer(), nullable=True),
    sa.Column('cost_usd', sa.Numeric(precision=10, scale=6), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("purpose in ('study_guide', 'practice')", name='ck_usage_charges_purpose'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_usage_charges_user_created', 'usage_charges', ['user_id', 'created_at'], unique=False)

    op.create_table('study_guides',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('video_id', sa.BigInteger(), nullable=False),
    sa.Column('summary', sa.Text(), nullable=False),
    sa.Column('key_terms', sa.Text(), nullable=False),
    sa.Column('outline', sa.Text(), nullable=False),
    sa.Column('covered_until_s', sa.Float(), nullable=True),
    sa.Column('model', sa.String(), nullable=True),
    sa.Column('input_tokens', sa.Integer(), nullable=True),
    sa.Column('output_tokens', sa.Integer(), nullable=True),
    sa.Column('cost_usd', sa.Numeric(precision=10, scale=6), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['video_id'], ['videos.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('video_id')
    )
    op.create_index('ix_study_guides_user', 'study_guides', ['user_id'], unique=False)

    op.create_table('study_sets',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('workspace_id', sa.BigInteger(), nullable=False),
    sa.Column('kind', sa.String(), nullable=False),
    sa.Column('focus', sa.String(), nullable=True),
    sa.Column('items', sa.Text(), nullable=False),
    sa.Column('model', sa.String(), nullable=True),
    sa.Column('input_tokens', sa.Integer(), nullable=True),
    sa.Column('output_tokens', sa.Integer(), nullable=True),
    sa.Column('cost_usd', sa.Numeric(precision=10, scale=6), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("kind in ('questions', 'flashcards')", name='ck_study_sets_kind'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_study_sets_user_workspace', 'study_sets', ['user_id', 'workspace_id', 'created_at'], unique=False)

    with op.get_context().autocommit_block():
        op.execute(
            "create index concurrently if not exists ix_chunks_text_search "
            "on chunks using gin (to_tsvector('english', text))"
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.get_context().autocommit_block():
        op.execute("drop index concurrently if exists ix_chunks_text_search")
    op.drop_index('ix_study_sets_user_workspace', table_name='study_sets')
    op.drop_table('study_sets')
    op.drop_index('ix_study_guides_user', table_name='study_guides')
    op.drop_table('study_guides')
    op.drop_index('ix_usage_charges_user_created', table_name='usage_charges')
    op.drop_table('usage_charges')
