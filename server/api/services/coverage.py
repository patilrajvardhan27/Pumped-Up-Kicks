"""
What to do when a question has nothing to do with the lectures.

The model is told to reply with a single marker when the excerpts do not address
the question at all. The server then swaps the reply for one fixed line and drops
the excerpts, so a student who asks about something the lectures never mention
gets that line and nothing else: no tour of whatever the search happened to
return, no timeline, no timestamps to click.

Why the model decides and not a similarity cut-off: cosine scores here are low in
absolute terms (a correct, on-topic answer scored 37%), so any fixed threshold
would either block good answers or let unrelated ones through. A threshold can
be added later, but only once the eval set has measured where the two groups
actually separate.
"""

MARKER = "NOT_COVERED"
MESSAGE = "That isn't covered in your lectures."

# Bump when the system prompt changes meaning, so answers cached under the old
# prompt are not served as if the new one had written them.
PROMPT_VERSION = "2"

# Characters a model may wrap the marker in, such as **NOT_COVERED** or `NOT_COVERED`.
_LEADING = " \t\r\n*`'\"_"


def is_not_covered(text: str) -> bool:
    """True if the reply opens with the marker. Anything after it is ignored."""
    return text.lstrip(_LEADING).upper().startswith(MARKER)


class CoverageGate:
    """
    Sits between the model's streamed text and the client.

    The marker arrives first, so the first few characters are held back until it
    is clear whether the reply is the marker or a real answer. A real answer is
    then released in one piece and streams normally; the marker is swallowed.
    """

    def __init__(self) -> None:
        self._held = ""
        self._state = "undecided"  # undecided, answer or not_covered

    @property
    def not_covered(self) -> bool:
        return self._state == "not_covered"

    def feed(self, delta: str) -> str:
        """Text to forward to the client now. Often empty while undecided."""
        if self._state == "answer":
            return delta
        if self._state == "not_covered":
            return ""

        self._held += delta
        probe = self._held.lstrip(_LEADING).upper()
        if probe.startswith(MARKER):
            self._state, self._held = "not_covered", ""
            return ""
        if MARKER.startswith(probe):
            return ""  # still could turn into the marker, keep holding

        self._state = "answer"
        released, self._held = self._held, ""
        return released

    def finish(self) -> str:
        """Release anything still held at the end, such as a reply that began 'No'."""
        if self._state != "undecided":
            return ""
        self._state = "answer"
        released, self._held = self._held, ""
        return released
