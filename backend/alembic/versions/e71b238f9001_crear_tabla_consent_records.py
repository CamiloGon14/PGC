"""crear_tabla_consent_records

Revision ID: e71b238f9001
Revises: c82b7bee6bba
Create Date: 2026-10-05 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e71b238f9001'
down_revision: Union[str, None] = 'c82b7bee6bba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'consent_records',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('session_id', sa.String(length=64), nullable=False),
        sa.Column('consent_version', sa.String(length=20), nullable=False),
        sa.Column('granted', sa.Boolean(), nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('context', sa.String(length=30), nullable=False),
        sa.Column('user_agent_hash', sa.String(length=64), nullable=True),
        sa.Column('ip_hash', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_consent_records_session_id'), 'consent_records', ['session_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_consent_records_session_id'), table_name='consent_records')
    op.drop_table('consent_records')
