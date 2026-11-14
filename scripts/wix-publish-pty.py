#!/usr/bin/env python3
"""Drive Wix CLI for Sites' interactive production publish and require proof of success."""
import errno
import fcntl
import json
import os
import pty
import re
import select
import signal
import struct
import sys
import termios
import time

ANSI_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
SELECTION_RE = re.compile(r"What would you like to publish\?", re.IGNORECASE)
# Wix's documented label is "Latest commit from <default branch>". Keep the
# alternate label for CLI builds that render the same source generically.
LATEST_REMOTE_RE = re.compile(
    r"Latest commit from\s+(?:origin/)?(?:main|master|[^\s]+)|Remote\s*-\s*default branch",
    re.IGNORECASE,
)
PREVIEW_URL_RE = re.compile(r"https?://wix\.to/[A-Za-z0-9]+", re.IGNORECASE)
CONFIRM_RE = re.compile(
    r"press\s+['\"]?y\b|\(\s*y\s*/\s*n\s*\)|\[\s*y\s*\]\s*/\s*\[\s*n\s*\]",
    re.IGNORECASE,
)
SUCCESS_RE = re.compile(r"(?:site|website).{0,80}published|published.{0,80}(?:site|website)", re.IGNORECASE | re.DOTALL)
EDITOR_UI_DRIFT_RE = re.compile(
    r"(?:The\s+)?Editor\s+contains\s+newer\s+(?:design|UI)\s+changes|newer UI changes",
    re.IGNORECASE,
)
UI_VERSION_RE = re.compile(r"UI\s+version:\s*(\d+)", re.IGNORECASE)
REQUEST_ID_RE = re.compile(r"Request ID:\s*([^\s]+)", re.IGNORECASE)
PUBLISH_PIPELINE_ERROR_RE = re.compile(
    r"PUBLISH_PIPELINE_TASK_NOT_FOUND",
    re.IGNORECASE,
)
SITE_DOMAIN = "marianmadrid.es"
TIMEOUT_SECONDS = 900
TERMINAL_ROWS = 40
TERMINAL_COLUMNS = 120


def clean_output(raw: str) -> str:
    text = ANSI_RE.sub("", raw).replace("\r", "\n")
    return "".join(ch for ch in text if ch in "\n\t" or ord(ch) >= 32)


def set_terminal_size(fd: int) -> None:
    # A zero-sized PTY can make interactive CLIs redraw prompts without
    # exposing readable text to the parent process. Give Wix CLI a real TTY.
    fcntl.ioctl(
        fd,
        termios.TIOCSWINSZ,
        struct.pack("HHHH", TERMINAL_ROWS, TERMINAL_COLUMNS, 0, 0),
    )


def expected_ui_version() -> str:
    with open("wix.config.json", "r", encoding="utf-8") as config_file:
        config = json.load(config_file)
    version = str(config.get("uiVersion", ""))
    if not version.isdigit():
        raise RuntimeError("wix.config.json uiVersion is missing or invalid.")
    return version


def confirmation_ready(text: str, expected_version: str) -> bool:
    version = UI_VERSION_RE.search(text)
    return bool(
        PREVIEW_URL_RE.search(text)
        and CONFIRM_RE.search(text)
        and version
        and version.group(1) == expected_version
        and not EDITOR_UI_DRIFT_RE.search(text)
    )


def publication_blocker(text: str, expected_version: str | None = None) -> str | None:
    if EDITOR_UI_DRIFT_RE.search(text):
        return (
            "Wix Editor contains newer UI/design changes than the repository UI version. "
            "Publication blocked to avoid publishing a stale UI snapshot; sync/save the "
            "latest Editor UI to the repository before retrying."
        )
    reported_version = UI_VERSION_RE.search(text)
    if (
        expected_version
        and reported_version
        and reported_version.group(1) != expected_version
    ):
        return (
            "Wix CLI UI version does not match wix.config.json "
            f"({reported_version.group(1)} != {expected_version}); publication blocked."
        )
    if PUBLISH_PIPELINE_ERROR_RE.search(text):
        request_id = REQUEST_ID_RE.search(text)
        suffix = f" Wix request ID: {request_id.group(1)}." if request_id else ""
        return (
            "Wix returned PUBLISH_PIPELINE_TASK_NOT_FOUND. The deployment pipeline "
            "task could not be retrieved; aborting without an unsafe retry." + suffix
        )
    return None


def self_test() -> None:
    selection = clean_output(
        "What would you like to publish?\n❯ Latest commit from origin/main\n  Local code"
    )
    confirmation = clean_output(
        "Creating preview deployment...\nPreview: https://wix.to/DEMO123\n"
        "If you're sure you want to publish, press y."
    )
    success = clean_output(
        "Your site has been published: https://www.marianmadrid.es/"
    )
    assert SELECTION_RE.search(selection) and LATEST_REMOTE_RE.search(selection)
    assert confirmation_ready(confirmation + "UI version: 15941", "15941")
    assert not confirmation_ready(confirmation + "UI version: 15940", "15941")
    editor_warning = (
        "Caution: The Editor contains newer design changes. "
        "Continue with publish? (Y/n)"
    )
    assert publication_blocker(editor_warning)
    assert not confirmation_ready(
        "Preview: https://wix.to/DEMO123\n" + editor_warning + " UI version: 15941",
        "15941",
    )
    assert publication_blocker("UI version: 15940", "15941")
    assert not confirmation_ready("Press y to publish", "15941")
    assert SUCCESS_RE.search(success) and SITE_DOMAIN in success.lower()
    pipeline_error = "Request ID: req-123\nCode: PUBLISH_PIPELINE_TASK_NOT_FOUND"
    assert "req-123" in publication_blocker(pipeline_error)
    print("Wix publish PTY controller self-test: PASS")


def terminate_child(pid: int) -> None:
    try:
        os.killpg(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        try:
            waited, _ = os.waitpid(pid, os.WNOHANG)
            if waited:
                return
        except ChildProcessError:
            return
        time.sleep(0.1)
    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    try:
        os.waitpid(pid, 0)
    except ChildProcessError:
        pass


def run_publish() -> None:
    expected_version = expected_ui_version()
    os.environ["CI"] = "true"
    os.environ["TERM"] = "xterm-256color"
    pid, master_fd = pty.fork()
    if pid == 0:
        os.execvp("npm", ["npm", "run", "wix", "publish"])

    set_terminal_size(master_fd)
    output = bytearray()
    selected_remote = False
    confirmed_publish = False
    publish_success = False
    child_exit_code = None
    deadline = time.monotonic() + TIMEOUT_SECONDS
    selection_deadline = time.monotonic() + 120
    confirmation_deadline = None

    with open("wix-publish.log", "wb") as transcript:
        try:
            while time.monotonic() < deadline:
                readable, _, _ = select.select([master_fd], [], [], 0.25)
                if readable:
                    try:
                        chunk = os.read(master_fd, 8192)
                    except OSError as error:
                        if error.errno == errno.EIO:
                            chunk = b""
                        else:
                            raise

                    if chunk:
                        transcript.write(chunk)
                        transcript.flush()
                        sys.stdout.buffer.write(chunk)
                        sys.stdout.buffer.flush()
                        output.extend(chunk)

                        text = clean_output(output.decode("utf-8", errors="replace"))
                        blocker = publication_blocker(text, expected_version)
                        if blocker:
                            raise RuntimeError(blocker)

                        if (
                            not selected_remote
                            and SELECTION_RE.search(text)
                            and LATEST_REMOTE_RE.search(text)
                        ):
                            os.write(master_fd, b"\r")
                            selected_remote = True
                            confirmation_deadline = time.monotonic() + 720
                            print(
                                "\n[release] Selected latest commit from origin/default branch.",
                                flush=True,
                            )

                        if (
                            selected_remote
                            and not confirmed_publish
                            and confirmation_ready(text, expected_version)
                        ):
                            os.write(master_fd, b"y")
                            confirmed_publish = True
                            print(
                                "\n[release] Preview URL and Wix confirmation prompt detected; "
                                "sent explicit publish confirmation.",
                                flush=True,
                            )

                        if (
                            confirmed_publish
                            and SUCCESS_RE.search(text)
                            and SITE_DOMAIN in text.lower()
                        ):
                            publish_success = True
                            print(
                                "\n[release] Wix reported publication and the Marian Madrid site URL.",
                                flush=True,
                            )
                            break

                waited, status = os.waitpid(pid, os.WNOHANG)
                if waited:
                    child_exit_code = os.waitstatus_to_exitcode(status)
                    break

                now = time.monotonic()
                if not selected_remote and now > selection_deadline:
                    raise TimeoutError("Wix publish source selector did not appear.")
                if (
                    selected_remote
                    and not confirmed_publish
                    and confirmation_deadline
                    and now > confirmation_deadline
                ):
                    raise TimeoutError(
                        "Wix did not display both a preview URL and the documented "
                        "production confirmation prompt."
                    )

            if not publish_success:
                if child_exit_code is None:
                    raise TimeoutError("Wix publish did not emit an explicit success marker.")
                raise RuntimeError(
                    "Wix CLI exited before confirming publication "
                    f"(exit code {child_exit_code}, source selected={selected_remote}, "
                    f"publish confirmed={confirmed_publish})."
                )

            if child_exit_code is None:
                time.sleep(1)
                waited, status = os.waitpid(pid, os.WNOHANG)
                if waited:
                    child_exit_code = os.waitstatus_to_exitcode(status)
                else:
                    terminate_child(pid)
                    child_exit_code = 0

            if child_exit_code != 0:
                raise RuntimeError(
                    f"Wix CLI returned non-zero exit code after publication: {child_exit_code}"
                )
        except Exception:
            if child_exit_code is None:
                terminate_child(pid)
            raise
        finally:
            os.close(master_fd)

    print("Wix production publication confirmed by CLI transcript.")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        run_publish()
