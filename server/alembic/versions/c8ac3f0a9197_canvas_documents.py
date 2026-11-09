"""canvas connections, documents and deadlines

Adds course material from Canvas. A chunk now belongs to exactly one lecture
(with timestamps) or one document (with a page or slide number).

Existing chunks are not rewritten. Making columns nullable and adding nullable
columns only changes the catalogue; the new check constraints are added NOT
VALID and then validated, which reads the table once without blocking reads or
writes, rather than holding a lock while it scans.

Downgrading deletes every imported document (and with it every chunk that is
not from a lecture), then puts the old NOT NULL columns back.

Revision ID: c8ac3f0a9197
Revises: cbc5d28c211d
Create Date: 2026-10-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8ac3f0a9197'
down_revision: Union[str, Sequence[str], None] = 'cbc5d28c211d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('canvas_connections',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('base_url', sa.String(), nullable=False),
    sa.Column('auth_type', sa.String(), nullable=False),
    sa.Column('access_token_enc', sa.Text(), nullable=False),
    sa.Column('refresh_token_enc', sa.Text(), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('canvas_user_id', sa.BigInteger(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('sync_stage', sa.String(), server_default='idle', nullable=False),
    sa.Column('sync_progress', sa.Integer(), server_default='0', nullable=False),
    sa.Column('sync_detail', sa.String(), nullable=True),
    sa.Column('sync_error', sa.Text(), nullable=True),
    sa.Column('sync_started_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('sync_finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('sync_summary', sa.Text(), nullable=True),
    sa.CheckConstraint("auth_type in ('oauth', 'personal_token')", name='ck_canvas_auth_type'),
    sa.CheckConstraint("sync_stage in ('idle', 'queued', 'syncing', 'ready', 'failed')", name='ck_canvas_sync_stage'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )

    op.create_table('documents',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('workspace_id', sa.BigInteger(), nullable=True),
    sa.Column('source', sa.String(), nullable=False),
    sa.Column('canvas_course_id', sa.BigInteger(), nullable=True),
    sa.Column('canvas_id', sa.BigInteger(), nullable=True),
    sa.Column('title', sa.String(), nullable=False),
    sa.Column('mime_type', sa.String(), nullable=True),
    sa.Column('url', sa.String(), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('content_hash', sa.String(), nullable=True),
    sa.Column('module_name', sa.String(), nullable=True),
    sa.Column('module_position', sa.Integer(), nullable=True),
    sa.Column('num_pages', sa.Integer(), nullable=True),
    sa.Column('num_chunks', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('synced_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("source in ('canvas_file', 'canvas_page', 'canvas_syllabus', 'canvas_announcement', 'canvas_assignment')", name='ck_documents_source'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'source', 'canvas_course_id', 'canvas_id', name='uq_documents_canvas_item')
    )
    op.create_index('ix_documents_user_workspace', 'documents', ['user_id', 'workspace_id'], unique=False)

    op.create_table('deadlines',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('workspace_id', sa.BigInteger(), nullable=True),
    sa.Column('canvas_course_id', sa.BigInteger(), nullable=False),
    sa.Column('canvas_assignment_id', sa.BigInteger(), nullable=False),
    sa.Column('title', sa.String(), nullable=False),
    sa.Column('due_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('url', sa.String(), nullable=True),
    sa.Column('points_possible', sa.Float(), nullable=True),
    sa.Column('is_quiz', sa.Boolean(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'canvas_course_id', 'canvas_assignment_id', name='uq_deadlines_canvas_item')
    )
    op.create_index('ix_deadlines_user_workspace_due', 'deadlines', ['user_id', 'workspace_id', 'due_at'], unique=False)

    op.create_index(
        'uq_workspaces_user_canvas_course', 'workspaces', ['user_id', 'canvas_course_id'],
        unique=True, postgresql_where=sa.text('canvas_course_id is not null'),
    )

    # Chunks: a lecture's or a document's. Existing rows are all lecture chunks
    # and already satisfy both constraints.
    op.alter_column('chunks', 'video_id', existing_type=sa.BigInteger(), nullable=True)
    op.alter_column('chunks', 'start_s', existing_type=sa.Float(), nullable=True)
    op.alter_column('chunks', 'end_s', existing_type=sa.Float(), nullable=True)
    op.add_column('chunks', sa.Column('document_id', sa.BigInteger(), nullable=True))
    op.add_column('chunks', sa.Column('page', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'chunks_document_id_fkey', 'chunks', 'documents',
        ['document_id'], ['id'], ondelete='CASCADE',
    )
    op.execute(
        "alter table chunks add constraint ck_chunks_one_parent "
        "check ((video_id is null) <> (document_id is null)) not valid"
    )
    op.execute(
        "alter table chunks add constraint ck_chunks_video_times "
        "check (video_id is null or (start_s is not null and end_s is not null)) not valid"
    )
    op.execute("alter table chunks validate constraint ck_chunks_one_parent")
    op.execute("alter table chunks validate constraint ck_chunks_video_times")
    op.create_index('ix_chunks_user_document', 'chunks', ['user_id', 'document_id'], unique=False)

    # Answers cite document passages by their place in the list ([Doc 3]).
    op.add_column('message_sources', sa.Column('position', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('message_sources', 'position')

    # The old schema has nowhere to put a document's chunks.
    op.execute("delete from chunks where document_id is not null")
    op.drop_index('ix_chunks_user_document', table_name='chunks')
    op.drop_constraint('ck_chunks_video_times', 'chunks', type_='check')
    op.drop_constraint('ck_chunks_one_parent', 'chunks', type_='check')
    op.drop_constraint('chunks_document_id_fkey', 'chunks', type_='foreignkey')
    op.drop_column('chunks', 'page')
    op.drop_column('chunks', 'document_id')
    op.alter_column('chunks', 'end_s', existing_type=sa.Float(), nullable=False)
    op.alter_column('chunks', 'start_s', existing_type=sa.Float(), nullable=False)
    op.alter_column('chunks', 'video_id', existing_type=sa.BigInteger(), nullable=False)

    op.drop_index('uq_workspaces_user_canvas_course', table_name='workspaces', postgresql_where=sa.text('canvas_course_id is not null'))
    op.drop_index('ix_deadlines_user_workspace_due', table_name='deadlines')
    op.drop_table('deadlines')
    op.drop_index('ix_documents_user_workspace', table_name='documents')
    op.drop_table('documents')
    op.drop_table('canvas_connections')
