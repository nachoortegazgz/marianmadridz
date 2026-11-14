#!/usr/bin/env python3
"""Create a Wix CLI for Sites Preview from the checked-out PR merge commit.

The CLI requires an interactive terminal. This controller supplies a real PTY,
selects the documented "Local code" source, and fails closed unless Wix emits
its documented Preview-ready message and a shareable wix.to URL.
"""
import errno
import fcntl
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
SELECTOR_RE = re.compile(r"What would you like to preview\?", re.IGNORECASE)
REMOTE_SOURCE_RE = re.compile(r"Latest commit from\s+(?:origin/)?[^\s]+", re.IGNORECASE)
LOCAL_SOURCE_RE = re.compile(r"Local code", re.IGNORECASE)
PREVIEW_URL_RE = re.compile(r"https?://wix\.to/[A-Za-z0-9]+", re.IGNORECASE)
PREVIEW_SUCCESS_RE = re.compile(
    r"Your preview deployment is now available at", re.IGNORECASE
)
PIPELINE_ERROR_RE = re.compile(r"PUBLISH_PIPELINE_TASK_NOT_FOUND", re.IGNORECASE)
TIMEOUT_SECONDS = 540
SELECTION_TIMEOUT_SECONDS = 90
TERMINAL_ROWS = 40
TERMINAL_COLUMNS = 120


def clean_output(raw: str) -> str:
    text = ANSI_RE.sub("", raw).replace("\r", "\n")
    return "".join(ch for ch in text if ch in "\n\t" or ord(ch) >= 32)


def selector_ready(text: str) -> bool:
    return bool(
        SELECTOR_RE.search(text)
        and REMOTE_SOURCE_RE.search(text)
        and LOCAL_SOURCE_RE.search(text)
    )


def preview_url(text: str) -> str | None:
    match = PREVIEW_URL_RE.search(text)
    return match.group(0).rstrip(".,);]") if match else None


def preview_environment(source: dict[str, str]) -> dict[str, str]:
    """Build a child-only environment that permits Wix's interactive PTY."""
    env = source.copy()
    env["CI"] = "false"
    env["GITHUB_ACTIONS"] = "false"
    for key in (
        "GITHUB_WORKFLOW",
        "GITHUB_RUN_ID",
        "GITHUB_JOB",
        "GITHUB_ACTION",
        "GITHUB_ACTION_PATH",
        "GITHUB_STEP_SUMMARY",
    ):
        env.pop(key, None)
    env["TERM"] = "xterm-256color"
    env["FORCE_COLOR"] = "1"
    env["COLUMNS"] = str(TERMINAL_COLUMNS)
    env["LINES"] = str(TERMINAL_ROWS)
    return env


def set_terminal_size(fd: int) -> None:
    fcntl.ioctl(
        fd,
        termios.TIOCSWINSZ,
        struct.pack("HHHH", TERMINAL_ROWS, TERMINAL_COLUMNS, 0, 0),
    )


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


def self_test() -> None:
    selector = clean_output(
        "What would you like to preview?\n"
        "❯ Latest commit from origin/feature/example\n"
        "  Local code"
    )
    success = clean_output(
        "Creating preview deployment...\n"
        "Your preview deployment is now available at https://wix.to/DEMO123"
    )
    assert selector_ready(selector)
    assert PREVIEW_SUCCESS_RE.search(success)
    assert preview_url(success) == "https://wix.to/DEMO123"
    assert not preview_url("NonInteractiveTerminal https://github.com/example")
    assert PIPELINE_ERROR_RE.search("Code: PUBLISH_PIPELINE_TASK_NOT_FOUND")
    assert not PREVIEW_SUCCESS_RE.search(
        "Preview failed: PUBLISH_PIPELINE_TASK_NOT_FOUND"
    )
    child_env = preview_environment({
        "CI": "true",
        "GITHUB_ACTIONS": "true",
        "GITHUB_WORKFLOW": "workflow",
        "GITHUB_RUN_ID": "123",
        "GITHUB_JOB": "preview",
        "GITHUB_ACTION": "step",
        "GITHUB_ACTION_PATH": "/tmp/action",
        "GITHUB_STEP_SUMMARY": "/tmp/summary",
        "PATH": "/usr/bin",
    })
    assert child_env["CI"] == "false"
    assert child_env["GITHUB_ACTIONS"] == "false"
    assert all(
        key not in child_env
        for key in (
            "GITHUB_WORKFLOW",
            "GITHUB_RUN_ID",
            "GITHUB_JOB",
            "GITHUB_ACTION",
            "GITHUB_ACTION_PATH",
            "GITHUB_STEP_SUMMARY",
        )
    )
    assert child_env["PATH"] == "/usr/bin"
    print("Wix Preview PTY controller self-test: PASS")


def run_preview() -> None:
    env = os.environ.copy()
    # Keep GitHub Actions enabled for the runner; only the Wix CLI child
    # receives a terminal-capable environment.
    env = preview_environment(os.environ)
    # Apply the isolated environment before fork, matching the known-working
    # Wix PTY invocation pattern; the parent process exits with this script.
    os.environ.clear()
    os.environ.update(env)

    window = struct.pack("HHHH", TERMINAL_ROWS, TERMINAL_COLUMNS, 0, 0)
    pid, master_fd = pty.fork()
    if pid == 0:
        fcntl.ioctl(0, termios.TIOCSWINSZ, window)
        os.execvp("wix", ["wix", "preview"])

    set_terminal_size(master_fd)
    print("[preview] Launching pinned Wix CLI in a controlling PTY.", flush=True)
    output = bytearray()
    selected_local = False
    preview_success = False
    process_exit_code = None
    started = time.monotonic()
    selection_deadline = started + SELECTION_TIMEOUT_SECONDS
    deadline = started + TIMEOUT_SECONDS

    try:
        with open("wix-preview.log", "wb") as transcript:
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
                        if PIPELINE_ERROR_RE.search(text):
                            raise RuntimeError(
                                "Wix returned PUBLISH_PIPELINE_TASK_NOT_FOUND. "
                                "Preview deployment was rejected by Wix; no URL "
                                "will be treated as a successful deployment."
                            )

                        if not selected_local and selector_ready(text):
                            # Wix documents the remote/default-branch source first
                            # and Local code second. The PR merge commit is checked
                            # out locally, so Down + Enter previews that exact code.
                            os.write(master_fd, b"\x1b[B\r")
                            selected_local = True
                            print(
                                "\n[preview] Selected Local code from the PR checkout.",
                                flush=True,
                            )

                        if PREVIEW_SUCCESS_RE.search(text) and preview_url(text):
                            preview_success = True

                    elif process_exit_code is not None:
                        break

                waited, status = os.waitpid(pid, os.WNOHANG)
                if waited:
                    process_exit_code = os.waitstatus_to_exitcode(status)
                    break

                now = time.monotonic()
                if not selected_local and now >= selection_deadline:
                    raise TimeoutError(
                        "Wix CLI did not display the documented Preview source "
                        "selector and both source options within 90 seconds."
                    )

            if process_exit_code is None:
                waited, status = os.waitpid(pid, os.WNOHANG)
                if waited:
                    process_exit_code = os.waitstatus_to_exitcode(status)

            if process_exit_code is None:
                raise TimeoutError("Wix Preview did not exit within 9 minutes.")
            if process_exit_code != 0:
                raise RuntimeError(
                    f"Wix CLI preview exited with status {process_exit_code}."
                )

            final_text = clean_output(output.decode("utf-8", errors="replace"))
            final_url = preview_url(final_text)
            if not selected_local:
                raise RuntimeError("Wix Preview source was not explicitly selected.")
            if not preview_success or not final_url:
                raise RuntimeError(
                    "Wix CLI exited successfully but did not emit both the "
                    "documented Preview-ready message and a verifiable wix.to URL."
                )

            with open("wix-preview-url.txt", "w", encoding="utf-8") as url_file:
                url_file.write(final_url + "\n")
            print(f"\nWix Preview created successfully: {final_url}", flush=True)
    except Exception:
        if process_exit_code is None:
            terminate_child(pid)
        raise
    finally:
        os.close(master_fd)


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        run_preview()
