#!/usr/bin/env python3
"""Run Wix CLI Preview in a PTY and select only the documented latest-main source."""

import os
import pty
import re
import select
import signal
import sys
import time

PROMPT_TEXT = b"What would you like to preview?"
MAIN_SOURCE = b"Latest commit from origin/main"
ANSI_ESCAPE = re.compile(rb"\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))")
PROMPT_TIMEOUT_SECONDS = 120
COMMAND_TIMEOUT_SECONDS = 540
MAX_BUFFER_BYTES = 1_000_000


def terminate_process_group(pid):
    try:
        os.killpg(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        try:
            waited, _ = os.waitpid(pid, os.WNOHANG)
        except ChildProcessError:
            return
        if waited == pid:
            return
        time.sleep(0.1)
    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def main():
    started = time.monotonic()
    prompt_deadline = started + PROMPT_TIMEOUT_SECONDS
    command_deadline = started + COMMAND_TIMEOUT_SECONDS
    buffer = bytearray()
    prompt_sent = False
    child_status = None

    pid, master_fd = pty.fork()
    if pid == 0:
        os.environ.setdefault("TERM", "xterm-256color")
        os.execvp("npm", ["npm", "run", "wix", "preview"])

    try:
        while True:
            now = time.monotonic()
            if now >= command_deadline:
                terminate_process_group(pid)
                raise SystemExit("Wix Preview CLI exceeded the 9-minute command timeout.")
            if not prompt_sent and now >= prompt_deadline:
                terminate_process_group(pid)
                raise SystemExit("Wix Preview source selector was not detected within 120 seconds.")

            readable, _, _ = select.select([master_fd], [], [], 0.25)
            if readable:
                try:
                    chunk = os.read(master_fd, 4096)
                except OSError:
                    chunk = b""
                if not chunk:
                    break
                sys.stdout.buffer.write(chunk)
                sys.stdout.buffer.flush()
                buffer.extend(chunk)
                if len(buffer) > MAX_BUFFER_BYTES:
                    del buffer[:-MAX_BUFFER_BYTES]

                normalized = ANSI_ESCAPE.sub(b"", buffer)
                if not prompt_sent and PROMPT_TEXT in normalized and MAIN_SOURCE in normalized:
                    os.write(master_fd, b"\r")
                    prompt_sent = True
                    print(
                        "[automation] Selected Wix Preview source: Latest commit from origin/main",
                        file=sys.stderr,
                        flush=True,
                    )

            waited, status = os.waitpid(pid, os.WNOHANG)
            if waited == pid:
                child_status = status
                break

        if child_status is None:
            _, child_status = os.waitpid(pid, 0)
    finally:
        os.close(master_fd)

    exit_code = os.waitstatus_to_exitcode(child_status)
    if exit_code != 0:
        raise SystemExit(exit_code)
    if not prompt_sent:
        raise SystemExit("Wix CLI exited without presenting the expected latest-main source selector.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
