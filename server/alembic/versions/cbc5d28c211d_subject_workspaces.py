"""subject workspaces

Adds one workspace per subject, files videos and conversations under them, and
records what each conversation searches.

Existing rows are left in place: every video and conversation starts in
Unsorted (workspace_id null), and every conversation keeps searching what it
searched before, one lecture if it had a video_id and everything otherwise.

Downgrading drops the workspaces. Conversations that searched one subject keep
their messages but go back to searching every lecture, since the old schema
has no way to express a subject.

Revision ID: cbc5d28c211d
Revises: fc71a20a8909
Create Date: 2026-10-09 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cbc5d28c211d'
down_revision: Union[str, Sequence[str], None] = 'fc71a20a8909'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('workspaces',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('color', sa.String(), nullable=False),
    sa.Column('icon', sa.String(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('canvas_course_id', sa.BigInteger(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'name', name='uq_workspaces_user_name')
    )
    op.create_index('ix_workspaces_user_position', 'workspaces', ['user_id', 'position'], unique=False)

    op.add_column('videos', sa.Column('workspace_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        'videos_workspace_id_fkey', 'videos', 'workspaces',
        ['workspace_id'], ['id'], ondelete='SET NULL',
    )
    op.create_index('ix_videos_user_workspace', 'videos', ['user_id', 'workspace_id'], unique=False)

    op.add_column('conversations', sa.Column('workspace_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        'conversations_workspace_id_fkey', 'conversations', 'workspaces',
        ['workspace_id'], ['id'], ondelete='SET NULL',
    )
    op.add_column(
        'conversations',
        sa.Column('scope', sa.String(), server_default='all', nullable=False),
    )
    # Before workspaces, a thread with a lecture searched that lecture alone.
    op.execute("update conversations set scope = 'video' where video_id is not null")
    op.create_check_constraint(
        'ck_conversations_scope', 'conversations', "scope in ('video', 'workspace', 'all')"
    )
    op.create_check_constraint(
        'ck_conversations_scope_video', 'conversations', "(scope = 'video') = (video_id is not null)"
    )
    op.create_check_constraint(
        'ck_conversations_scope_all', 'conversations', "scope <> 'all' or workspace_id is null"
    )
    op.create_index(
        'ix_conversations_user_workspace', 'conversations',
        ['user_id', 'workspace_id', 'updated_at'], unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_conversations_user_workspace', table_name='conversations')
    op.drop_constraint('ck_conversations_scope_all', 'conversations', type_='check')
    op.drop_constraint('ck_conversations_scope_video', 'conversations', type_='check')
    op.drop_constraint('ck_conversations_scope', 'conversations', type_='check')
    op.drop_column('conversations', 'scope')
    op.drop_constraint('conversations_workspace_id_fkey', 'conversations', type_='foreignkey')
    op.drop_column('conversations', 'workspace_id')

    op.drop_index('ix_videos_user_workspace', table_name='videos')
    op.drop_constraint('videos_workspace_id_fkey', 'videos', type_='foreignkey')
    op.drop_column('videos', 'workspace_id')

    op.drop_index('ix_workspaces_user_position', table_name='workspaces')
    op.drop_table('workspaces')
