"""
The reading half of a Canvas sync: each kind of course material, in order,
filed through the bookkeeping in canvas_course.py.
"""
from typing import Set
from urllib.parse import quote

from api.config import settings
from api.models.database import (
    Deadline,
)
from api.services import document_text
from api.services.canvas_client import CanvasForbidden, CanvasNotFound
from api.services.canvas_course import CourseStore, is_quiz, parse_time
from api.services.document_text import Page


class CourseSync(CourseStore):
    """Reads one course: modules, syllabus, pages, files, announcements and assignments."""

    def read_modules(self) -> None:
        try:
            modules = list(self.client.paginate(
                f"/api/v1/courses/{self.course_id}/modules", {"include[]": "items", "per_page": 100}
            ))
        except (CanvasForbidden, CanvasNotFound):
            self.run.summary.skip(self.name, "Modules", "not available to you in this course")
            return
        for module in modules:
            items = module.get("items")
            if items is None and module.get("items_url"):
                items = list(self.client.paginate(module["items_url"], {"per_page": 100}))
            label = (module.get("name") or "Module", module.get("position") or 0)
            for item in items or []:
                kind = item.get("type")
                key = item.get("page_url") if kind == "Page" else item.get("content_id")
                if kind and key is not None:
                    self.modules[(kind, key)] = label

    def read_syllabus(self) -> None:
        course = self.client.get_json(
            f"/api/v1/courses/{self.course_id}", {"include[]": "syllabus_body"}
        )
        body = document_text.html_to_text(course.get("syllabus_body"))
        if body:
            self.upsert(
                "canvas_syllabus", self.course_id, f"{course.get('name') or self.name} syllabus",
                lambda: [Page(None, body)],
                mime_type="text/html", url=self.link("assignments/syllabus"),
            )

    def read_pages(self) -> None:
        for page in self.client.paginate(f"/api/v1/courses/{self.course_id}/pages", {"per_page": 100}):
            if page.get("locked_for_user") or page.get("hide_from_students") or not page.get("page_id"):
                continue
            slug = page.get("url") or ""

            def body(slug=slug):
                full = self.client.get_json(f"/api/v1/courses/{self.course_id}/pages/{quote(slug, safe='')}")
                return [Page(None, document_text.html_to_text(full.get("body")))] if full.get("body") else []

            self.upsert(
                "canvas_page", int(page["page_id"]), page.get("title") or slug, body,
                updated_at=parse_time(page.get("updated_at")), mime_type="text/html",
                url=self.link(f"pages/{quote(slug, safe='')}"), module=self.module_of("Page", slug),
            )

    def read_files(self) -> None:
        for item in self.client.paginate(f"/api/v1/courses/{self.course_id}/files", {"per_page": 100}):
            name = item.get("display_name") or item.get("filename") or "Untitled file"
            mime = document_text.kind_of(item.get("filename") or name, item.get("content-type"))
            if mime is None:
                continue  # not a PDF, slide deck or Word document
            if item.get("locked_for_user") or item.get("hidden_for_user") or item.get("locked") or item.get("hidden"):
                continue  # the student can't open it, so it isn't imported (and an old copy is removed)
            file_id = int(item["id"])
            if (item.get("size") or 0) > settings.canvas_max_file_bytes:
                self.seen.setdefault("canvas_file", set()).add(file_id)
                self.run.summary.skip(self.name, name, "larger than the import limit")
                continue
            download = item.get("url")
            if not download:
                continue

            def pages(download=download, mime=mime):
                return document_text.extract(
                    self.client.download(download, settings.canvas_max_file_bytes), mime
                )

            self.upsert(
                "canvas_file", file_id, name, pages,
                updated_at=parse_time(item.get("modified_at") or item.get("updated_at")),
                mime_type=mime, url=self.link(f"files/{file_id}"), module=self.module_of("File", file_id),
            )

    def read_announcements(self) -> None:
        for topic in self.client.paginate(
            f"/api/v1/courses/{self.course_id}/discussion_topics",
            {"only_announcements": "true", "per_page": 100},
        ):
            if topic.get("locked_for_user") or not topic.get("id"):
                continue
            text = document_text.html_to_text(topic.get("message"))
            if not text:
                continue
            topic_id = int(topic["id"])
            self.upsert(
                "canvas_announcement", topic_id, topic.get("title") or "Announcement",
                lambda text=text: [Page(None, text)],
                mime_type="text/html", url=self.link(f"discussion_topics/{topic_id}"),
            )

    def read_assignments(self) -> None:
        seen_deadlines: Set[int] = set()
        for assignment in self.client.paginate(
            f"/api/v1/courses/{self.course_id}/assignments", {"per_page": 100}
        ):
            if not assignment.get("id"):
                continue
            assignment_id = int(assignment["id"])
            title = assignment.get("name") or "Assignment"
            quiz = is_quiz(assignment)
            url = self.link(f"assignments/{assignment_id}")

            due = parse_time(assignment.get("due_at"))
            if due:
                seen_deadlines.add(assignment_id)
                self.save_deadline(assignment, assignment_id, title, due, url, quiz)

            # Quizzes and exams: the date only. Their questions are never imported.
            if quiz or assignment.get("locked_for_user"):
                continue
            text = document_text.html_to_text(assignment.get("description"))
            if text:
                self.upsert(
                    "canvas_assignment", assignment_id, title, lambda text=text: [Page(None, text)],
                    updated_at=parse_time(assignment.get("updated_at")), mime_type="text/html",
                    url=url, module=self.module_of("Assignment", assignment_id),
                )

        stale = self.db.query(Deadline).filter(
            Deadline.user_id == self.run.user_id, Deadline.canvas_course_id == self.course_id,
        )
        for deadline in stale.all():
            if deadline.canvas_assignment_id not in seen_deadlines:
                self.db.delete(deadline)
        self.db.commit()

    def save_deadline(self, assignment: dict, assignment_id: int, title: str, due, url: str, quiz: bool) -> None:
        deadline = (
            self.db.query(Deadline)
            .filter(
                Deadline.user_id == self.run.user_id,
                Deadline.canvas_course_id == self.course_id,
                Deadline.canvas_assignment_id == assignment_id,
            )
            .first()
        )
        if deadline is None:
            deadline = Deadline(
                user_id=self.run.user_id, canvas_course_id=self.course_id,
                canvas_assignment_id=assignment_id,
            )
            self.db.add(deadline)
        deadline.workspace_id = self.workspace.id
        deadline.title = title[:500]
        deadline.due_at = due
        deadline.url = url
        deadline.points_possible = assignment.get("points_possible")
        deadline.is_quiz = quiz
        deadline.updated_at = parse_time(assignment.get("updated_at"))
        self.db.commit()
        self.run.summary.deadlines += 1

    def run_all(self) -> None:
        try:
            self.step(0, "reading modules")
            self.read_modules()
            self.step(1, "syllabus")
            self.listed("canvas_syllabus", "Syllabus", self.read_syllabus)
            self.step(2, "pages")
            self.listed("canvas_page", "Pages", self.read_pages)
            self.step(3, "files")
            self.listed("canvas_file", "Files", self.read_files)
            self.step(4, "announcements")
            self.listed("canvas_announcement", "Announcements", self.read_announcements)
            self.step(5, "assignments")
            self.listed("canvas_assignment", "Assignments", self.read_assignments)
        except (CanvasForbidden, CanvasNotFound):
            # The whole course is gone or closed to the student. What was
            # imported from it stays until they delete it.
            self.db.rollback()
            self.run.summary.skip(self.name, "Course", "Canvas no longer lets you open this course")
