"""
The schema migrations, upgraded and downgraded against real Postgres with data
in the tables. Uses its own throwaway database, separate from the other tests.

Run from server/ with: python -m tests.test_migrations
"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, OperationalError

from tests import support

BASE = "fc71a20a8909"
WORKSPACES = "cbc5d28c211d"
CANVAS = "c8ac3f0a9197"
STUDY = "dc3868b32385"

_TEST_URL = make_url(support.TEST_DATABASE_URL)
URL = _TEST_URL.set(database=f"{_TEST_URL.database}_migrations").render_as_string(hide_password=False)


def fresh_database():
    try:
        support.ensure_database(URL, recreate=True)
    except OperationalError as e:
        support.skip(f"Postgres not reachable: {str(e).splitlines()[0]}")
    return create_engine(URL)


def columns(engine, table):
    return {c["name"] for c in inspect(engine).get_columns(table)}


def seed_before_workspaces(conn):
    """Rows as they existed before subjects: one lecture, a thread about it, one about everything."""
    vector = "[" + ",".join(["0.1"] * 384) + "]"
    conn.execute(text("insert into users (id, email, plan) values ('u1', 'u1@test.local', 'free')"))
    conn.execute(text(
        "insert into videos (id, user_id, filename, storage_key, stage, progress) "
        "values (1, 'u1', 'l.mp4', 'users/u1/l.mp4', 'ready', 100)"
    ))
    conn.execute(text(
        "insert into chunks (id, video_id, user_id, text, start_s, end_s, embedding) "
        "values (1, 1, 'u1', 'hello', 0, 30, :v)"
    ), {"v": vector})
    conn.execute(text("insert into conversations (id, user_id, video_id, title) values (1, 'u1', 1, 'about it')"))
    conn.execute(text("insert into conversations (id, user_id, video_id, title) values (2, 'u1', null, 'everything')"))


def test_workspaces_upgrade_keeps_existing_rows_unsorted():
    engine = fresh_database()
    try:
        support.migrate(URL, BASE)
        with engine.begin() as conn:
            seed_before_workspaces(conn)

        support.migrate(URL, WORKSPACES)

        assert "workspaces" in inspect(engine).get_table_names()
        assert {"workspace_id"} <= columns(engine, "videos")
        assert {"workspace_id", "scope"} <= columns(engine, "conversations")

        with engine.connect() as conn:
            assert conn.execute(text("select workspace_id from videos")).scalar() is None
            scopes = dict(conn.execute(text("select id, scope from conversations")).all())
            assert scopes == {1: "video", 2: "all"}, "threads keep searching what they searched before"
            assert conn.execute(text("select text from chunks where id = 1")).scalar() == "hello"
    finally:
        engine.dispose()


def test_scope_constraints_hold_after_upgrade():
    engine = fresh_database()
    try:
        support.migrate(URL, WORKSPACES)
        with engine.begin() as conn:
            conn.execute(text("insert into users (id, email, plan) values ('u1', 'u1@test.local', 'free')"))
            conn.execute(text(
                "insert into workspaces (id, user_id, name, color, icon, position) "
                "values (1, 'u1', 'Physics', 'blue', 'book', 0)"
            ))

        invalid = [
            "insert into conversations (user_id, scope) values ('u1', 'video')",
            "insert into conversations (user_id, scope, workspace_id) values ('u1', 'all', 1)",
            "insert into conversations (user_id, scope) values ('u1', 'nonsense')",
            "insert into workspaces (user_id, name, color, icon, position) values ('u1', 'Physics', 'red', 'book', 1)",
        ]
        for statement in invalid:
            try:
                with engine.begin() as conn:
                    conn.execute(text(statement))
            except IntegrityError:
                continue
            raise AssertionError(f"accepted: {statement}")
    finally:
        engine.dispose()


def test_workspaces_downgrade_restores_the_old_schema_and_keeps_data():
    engine = fresh_database()
    try:
        support.migrate(URL, BASE)
        with engine.begin() as conn:
            seed_before_workspaces(conn)
        support.migrate(URL, WORKSPACES)
        with engine.begin() as conn:
            conn.execute(text(
                "insert into workspaces (id, user_id, name, color, icon, position) "
                "values (1, 'u1', 'Physics', 'blue', 'book', 0)"
            ))
            conn.execute(text("update videos set workspace_id = 1"))
            conn.execute(text(
                "insert into conversations (id, user_id, scope, workspace_id, title) "
                "values (3, 'u1', 'workspace', 1, 'physics')"
            ))

        support.migrate(URL, BASE, direction="downgrade")

        assert "workspaces" not in inspect(engine).get_table_names()
        assert "workspace_id" not in columns(engine, "videos")
        assert not {"workspace_id", "scope"} & columns(engine, "conversations")
        with engine.connect() as conn:
            assert conn.execute(text("select count(*) from videos")).scalar() == 1
            assert conn.execute(text("select count(*) from chunks")).scalar() == 1
            assert conn.execute(text("select count(*) from conversations")).scalar() == 3

        # And back up again, cleanly.
        support.migrate(URL, "head")
        assert "workspaces" in inspect(engine).get_table_names()
    finally:
        engine.dispose()


def test_canvas_upgrade_keeps_lecture_chunks_and_enforces_one_parent():
    engine = fresh_database()
    vector = "[" + ",".join(["0.1"] * 384) + "]"
    try:
        support.migrate(URL, BASE)
        with engine.begin() as conn:
            seed_before_workspaces(conn)
        support.migrate(URL, CANVAS)

        assert {"documents", "deadlines", "canvas_connections"} <= set(inspect(engine).get_table_names())
        with engine.connect() as conn:
            row = conn.execute(text("select video_id, document_id, start_s, end_s, page, text from chunks")).one()
            assert tuple(row) == (1, None, 0.0, 30.0, None, "hello"), "existing chunk untouched"
            validated = dict(conn.execute(text(
                "select conname, convalidated from pg_constraint "
                "where conname in ('ck_chunks_one_parent', 'ck_chunks_video_times')"
            )).all())
            assert validated == {"ck_chunks_one_parent": True, "ck_chunks_video_times": True}

        with engine.begin() as conn:
            conn.execute(text(
                "insert into documents (id, user_id, source, canvas_course_id, canvas_id, title, num_chunks) "
                "values (1, 'u1', 'canvas_file', 101, 9001, 'notes.pdf', 1)"
            ))
            conn.execute(text(
                "insert into chunks (id, document_id, user_id, text, page, embedding) values (2, 1, 'u1', 'p1', 1, :v)"
            ), {"v": vector})

        invalid = [
            "insert into chunks (id, user_id, text, embedding) values (3, 'u1', 'orphan', :v)",
            "insert into chunks (id, video_id, document_id, user_id, text, start_s, end_s, embedding) "
            "values (4, 1, 1, 'u1', 'both', 0, 1, :v)",
            "insert into chunks (id, video_id, user_id, text, embedding) values (5, 1, 'u1', 'no times', :v)",
        ]
        for statement in invalid:
            try:
                with engine.begin() as conn:
                    conn.execute(text(statement), {"v": vector})
            except IntegrityError:
                continue
            raise AssertionError(f"accepted: {statement}")
    finally:
        engine.dispose()


def test_canvas_downgrade_drops_documents_and_keeps_lectures():
    engine = fresh_database()
    vector = "[" + ",".join(["0.1"] * 384) + "]"
    try:
        support.migrate(URL, BASE)
        with engine.begin() as conn:
            seed_before_workspaces(conn)
        support.migrate(URL, CANVAS)
        with engine.begin() as conn:
            conn.execute(text(
                "insert into documents (id, user_id, source, title, num_chunks) "
                "values (1, 'u1', 'canvas_page', 'Week 1', 1)"
            ))
            conn.execute(text(
                "insert into chunks (id, document_id, user_id, text, embedding) values (2, 1, 'u1', 'doc', :v)"
            ), {"v": vector})

        support.migrate(URL, WORKSPACES, direction="downgrade")

        tables = set(inspect(engine).get_table_names())
        assert not {"documents", "deadlines", "canvas_connections"} & tables
        nullable = {c["name"]: c["nullable"] for c in inspect(engine).get_columns("chunks")}
        assert nullable["video_id"] is False and nullable["start_s"] is False
        assert "document_id" not in nullable and "page" not in nullable
        with engine.connect() as conn:
            assert conn.execute(text("select text from chunks")).scalars().all() == ["hello"]

        support.migrate(URL, "head")
        assert "documents" in inspect(engine).get_table_names()
    finally:
        engine.dispose()


def test_study_tools_upgrade_and_downgrade():
    engine = fresh_database()
    try:
        support.migrate(URL, BASE)
        with engine.begin() as conn:
            seed_before_workspaces(conn)
        support.migrate(URL, STUDY)

        tables = set(inspect(engine).get_table_names())
        assert {"study_guides", "study_sets", "usage_charges"} <= tables
        indexes = {i["name"] for i in inspect(engine).get_indexes("chunks")}
        assert "ix_chunks_text_search" in indexes
        with engine.connect() as conn:
            found = conn.execute(text(
                "select count(*) from chunks where to_tsvector('english', text) @@ websearch_to_tsquery('english', 'hello')"
            )).scalar()
            assert found == 1, "existing chunks are searchable straight away"

        with engine.begin() as conn:
            conn.execute(text(
                "insert into study_guides (user_id, video_id, summary, key_terms, outline) "
                "values ('u1', 1, 's', '[]', '[]')"
            ))
            conn.execute(text(
                "insert into usage_charges (user_id, purpose, cost_usd) values ('u1', 'study_guide', 0.01)"
            ))

        support.migrate(URL, CANVAS, direction="downgrade")
        tables = set(inspect(engine).get_table_names())
        assert not {"study_guides", "study_sets", "usage_charges"} & tables
        assert "ix_chunks_text_search" not in {i["name"] for i in inspect(engine).get_indexes("chunks")}
        with engine.connect() as conn:
            assert conn.execute(text("select count(*) from chunks")).scalar() == 1

        support.migrate(URL, "head")
    finally:
        engine.dispose()


if __name__ == "__main__":
    support.run(globals())
