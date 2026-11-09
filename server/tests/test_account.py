"""
Your data: transcripts, the full export, and account deletion. Each must only
ever touch the caller's own rows. Needs Postgres (see tests/support.py).

Run from server/ with: python -m tests.test_account
"""
from api.models.database import CanvasConnection, Chunk, User, Video
from api.services import canvas_auth, cleanup
from tests import support


def two_users():
    support.fresh()
    alice, bob = support.client("alice"), support.client("bob")
    subject = alice.post("/api/workspaces", json={"name": "Physics"}).json()["id"]
    mine = support.add_video("alice", "Thermo", ["one two three four", "three four five six"], subject)
    theirs = support.add_video("bob", "Bob's lecture", ["bob only"])
    support.use_claude()
    alice.post("/api/chat/query", json={"question": "what is three?", "scope": "all"})
    return alice, bob, mine, theirs


def count(model, user):
    db = support.session()
    try:
        return db.query(model).filter(model.user_id == user).count()
    finally:
        db.close()


def test_transcript_reads_each_word_once_and_is_private():
    alice, bob, mine, theirs = two_users()
    body = alice.get(f"/api/videos/{mine}/transcript").json()
    assert " ".join(line["text"] for line in body["lines"]) == "one two three four five six"
    assert alice.get(f"/api/videos/{theirs}/transcript").status_code == 404


def test_export_holds_everything_and_only_mine():
    alice, bob, mine, theirs = two_users()
    response = alice.get("/api/account/export")
    assert "attachment" in response.headers["content-disposition"]
    body = response.json()
    assert body["account"]["id"] == "alice"
    assert [s["name"] for s in body["subjects"]] == ["Physics"]
    assert [lecture["id"] for lecture in body["lectures"]] == [mine]
    assert body["lectures"][0]["transcript"], "transcripts are part of the export"
    assert len(body["conversations"]) == 1 and body["conversations"][0]["messages"]
    assert "bob only" not in str(body), "nothing of another user leaks into the export"


def test_delete_account_removes_my_data_and_files_only():
    alice, bob, mine, theirs = two_users()
    purged = []
    saved = cleanup.get_storage
    cleanup.get_storage = lambda: type("S", (), {"delete": lambda self, key: purged.append(key)})()
    try:
        assert alice.delete("/api/account").status_code == 200
    finally:
        cleanup.get_storage = saved

    assert len(purged) == 1 and purged[0].startswith("users/alice/"), "my lecture file was removed"
    assert count(Video, "alice") == 0 and count(Chunk, "alice") == 0
    assert count(Video, "bob") == 1 and count(Chunk, "bob") > 0
    db = support.session()
    try:
        assert db.get(User, "alice") is None and db.get(User, "bob") is not None
    finally:
        db.close()


def test_delete_account_revokes_canvas_oauth():
    alice, *_ = two_users()
    db = support.session()
    try:
        db.add(CanvasConnection(user_id="alice", base_url="https://canvas.test", auth_type="oauth",
                                access_token_enc=canvas_auth.encrypt_token("1~token")))
        db.commit()
    finally:
        db.close()

    revoked = []
    saved = canvas_auth.revoke
    canvas_auth.revoke = lambda base, token: revoked.append((base, token))
    try:
        assert alice.delete("/api/account").status_code == 200
    finally:
        canvas_auth.revoke = saved
    assert revoked == [("https://canvas.test", "1~token")]
    assert count(CanvasConnection, "alice") == 0


if __name__ == "__main__":
    support.run(globals())
