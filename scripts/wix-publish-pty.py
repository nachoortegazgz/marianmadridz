#!/usr/bin/env python3
"""Drive Wix CLI for Sites' interactive production publish and require proof of success."""
import errno
import os
import pty
import re
import select
import signal
import sys
import time

ANSI_RE = re.compile(r"\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\\\))")
SELECTION_RE = re.compile(r"What would you like to publish\?", re.IGNORECASE)
REMOTE_RE = re.compile(r"Remote\s*-\s*default branch", re.IGNORECASE)
CONFIRM_RE = re.compile(
    r"(?:if you're sure|are you sure).{0,160}(?:publish|press)|"
    r"press\s+['\"]?y\b|publish.{0,100}(?:\([yY]/[nN]\)|\[yY]/\[nN\])",
    re.IGNORECASE | re.DOTALL,
)
SUCCESS_RE = re.compile(r"\bpublished\b", re.IGNORECASE)
SITE_DOMAIN = "marianmadrid.es"
TIMEOUT_SECONDS = 900


def clean_output(raw: str) -> str:
    return ANSI_RE.sub("", raw).replace("\r", "\n")


def self_test() -> None:
    selection = clean_output(
        "What would you like to publish?\n❯ Remote - default branch\n  Local code"
    )
    confirmation = clean_output(
        "If you're sure you want to publish, press y."
    )
    success = clean_output(
        "Your site has been published: https://www.marianmadrid.es/"
    )
    assert SELECTION_RE.search(selection) and REMOTE_RE.search(selection)
    assert CONFIRM_RE.search(confirmation)
    assert SUCCESS_RE.search(success) and SITE_DOMAIN in success.lower()
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
    os.environ["CI"] = "true"
    os.environ["TERM"] = "xterm"
    pid, master_fd = pty.fork()
    if pid == 0:
        os.execvp("npm", ["npm", "run", "wix", "publish"])

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
                        if (
                            not selected_remote
                            and SELECTION_RE.search(text)
                            and REMOTE_RE.search(text)
                        ):
                            os.write(master_fd, b"\r")
                            selected_remote = True
                            confirmation_deadline = time.monotonic() + 720
                            print(
                                "\n[release] Selected Wix CLI source: Remote - default branch.",
                                flush=True,
                            )

                        if (
                            selected_remote
                            and not confirmed_publish
                            and CONFIRM_RE.search(text)
                        ):
                            os.write(master_fd, b"y")
                            confirmed_publish = True
                            print(
                                "\n[release] Sent explicit confirmation to publish.",
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
                    raise TimeoutError("Wix production confirmation prompt did not appear.")

            if not publish_success:
                if child_exit_code is None:
                    raise TimeoutError("Wix publish did not emit an explicit success marker.")
                raise RuntimeError(
                    "Wix CLI exited before confirming publication "
                    f"(exit code {child_exit_code}, source selected={selected_remote}, "
                    f"publish confirmed={confirmed_publish})."
                )

            if child_exit_code is None:
                # The CLI may keep its interactive terminal alive after Wix
                # has confirmed the release. The success marker is the gate.
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
