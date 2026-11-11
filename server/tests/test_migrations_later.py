"""
The Canvas and study-tool migrations: each upgrades without losing lecture data
and downgrades cleanly. Needs Postgres (see tests/support.py).

Run from server/ with: python -m tests.test_migrations_later
"""
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from tests import support
from tests.test_migrations import BASE, CANVAS, STUDY, URL, WORKSPACES, fresh_database, seed_before_workspaces


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
