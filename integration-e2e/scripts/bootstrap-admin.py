#!/usr/bin/env python3
"""Run the backend's supported interactive admin bootstrap without echoing secrets."""

import os
import pty
import re
import select
import subprocess
import sys
import time


PROMPTS = (
    (b"Administrator username: ", "PHASE2_TEST_ADMIN_USERNAME"),
    (b"Password (minimum 12 characters): ", "PHASE2_TEST_ADMIN_PASSWORD"),
    (b"Confirm password: ", "PHASE2_TEST_ADMIN_PASSWORD"),
)
MAX_CAPTURED_OUTPUT = 64 * 1024
BOOTSTRAP_TIMEOUT_SECONDS = 90
ANSI_ESCAPE = re.compile(rb"\x1b\[[0-?]*[ -/]*[@-~]")
PROMPT_SHAPE = re.compile(rb"(?:administrator\s+username|username|password|confirm)[^\r\n]{0,80}[:?]\s*$", re.IGNORECASE)
ENVIRONMENT_FAILURE_MARKERS = (
    "idempotency_encryption_key",
    "database_url must be",
    "node_env must be",
    "cookie_secure must be",
    "cookie_same_site must be",
    "cors_origins must be",
)
DATABASE_FAILURE_MARKERS = (
    "p1000", "p1001", "p1002", "p1003", "p1010", "econnrefused",
    "connection refused", "can't reach database server", "could not connect to server",
    "connection timed out", "database server at",
)


def has_unexpected_prompt(output: bytes, expected_prompt: bytes) -> bool:
    """Recognize a changed/reordered credential prompt without exposing its text."""
    clean_output = ANSI_ESCAPE.sub(b"", output)
    last_line = re.split(rb"[\r\n]", clean_output)[-1].lower()
    return expected_prompt.lower() not in last_line and bool(PROMPT_SHAPE.search(last_line))


def classify_failure(
    output: bytes,
    prompts_remaining: int,
    *,
    timed_out: bool = False,
    unexpected_prompt: bool = False,
    exit_code: int | None = None,
) -> str:
    """Return a safe fixed diagnostic category; never return captured CLI output."""
    safe_text = output.decode("utf-8", errors="replace").lower()
    if any(marker in safe_text for marker in ENVIRONMENT_FAILURE_MARKERS):
        return "environment validation failure before prompting"
    if any(marker in safe_text for marker in DATABASE_FAILURE_MARKERS):
        return "database connection failure"
    if unexpected_prompt:
        return "unexpected prompt sequence"
    if timed_out:
        if prompts_remaining == len(PROMPTS):
            return "CLI startup timeout before prompting"
        return "input timeout" if prompts_remaining else "process timeout"
    if prompts_remaining == len(PROMPTS):
        return "CLI failed before prompting"
    if exit_code is not None:
        return "process terminated unexpectedly"
    return "CLI ended before completing the prompt sequence"


def stop_process(process: subprocess.Popen) -> None:
    """Stop and reap a child, tolerating exit between poll() and kill()."""
    try:
        if process.poll() is None:
            process.kill()
    except ProcessLookupError:
        pass
    process.wait()


def main() -> int:
    backend_dir = os.environ.get("PHASE2_BACKEND_DIR")
    if not backend_dir:
        print("PHASE2_BACKEND_DIR must point to the checked-out backend.", file=sys.stderr)
        return 2

    responses = []
    for prompt, variable in PROMPTS:
        value = os.environ.get(variable)
        if not value:
            print(f"{variable} must be set for the disposable database bootstrap.", file=sys.stderr)
            return 2
        responses.append((prompt, value))

    master_fd, slave_fd = pty.openpty()
    try:
        process = subprocess.Popen(
            ["npm", "run", "staff:create-admin:dev"],
            cwd=backend_dir,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            env=os.environ.copy(),
            close_fds=True,
        )
    except OSError:
        os.close(master_fd)
        os.close(slave_fd)
        print("Supported administrator bootstrap could not start the backend CLI process.", file=sys.stderr)
        return 1
    os.close(slave_fd)
    prompt_index = 0
    prompt_buffer = b""
    captured_output = b""
    started_at = time.monotonic()
    timed_out = False
    unexpected_prompt = False

    try:
        while True:
            exit_code = process.poll()
            if exit_code is not None:
                readable, _, _ = select.select([master_fd], [], [], 0)
                if not readable:
                    break
            else:
                if time.monotonic() - started_at > BOOTSTRAP_TIMEOUT_SECONDS:
                    timed_out = True
                    stop_process(process)
                    continue
                readable, _, _ = select.select([master_fd], [], [], 0.25)
                if not readable:
                    continue

            try:
                output = os.read(master_fd, 4096)
            except OSError:
                break
            if not output:
                break
            captured_output = (captured_output + output)[-MAX_CAPTURED_OUTPUT:]
            prompt_buffer += output

            while prompt_index < len(responses):
                prompt, value = responses[prompt_index]
                prompt_position = prompt_buffer.find(prompt)
                if prompt_position >= 0:
                    if has_unexpected_prompt(prompt_buffer[:prompt_position], prompt):
                        unexpected_prompt = True
                        break
                    os.write(master_fd, value.encode("utf-8") + b"\n")
                    prompt_buffer = prompt_buffer[prompt_position + len(prompt):]
                    prompt_index += 1
                    continue
                if has_unexpected_prompt(prompt_buffer, prompt):
                    unexpected_prompt = True
                break

            if unexpected_prompt:
                stop_process(process)
                break
            if len(prompt_buffer) > 4096:
                prompt_buffer = prompt_buffer[-4096:]

        return_code = process.wait()
        prompts_remaining = len(responses) - prompt_index
        if return_code != 0 or prompts_remaining:
            category = classify_failure(
                captured_output,
                prompts_remaining,
                timed_out=timed_out,
                unexpected_prompt=unexpected_prompt,
                exit_code=return_code,
            )
            print(f"Supported administrator bootstrap failed: {category} (exit {return_code}; prompts remaining: {prompts_remaining}).", file=sys.stderr)
            return return_code or 1
        print("Disposable administrator created through the backend CLI.")
        return 0
    finally:
        os.close(master_fd)
        if process.poll() is None:
            stop_process(process)


if __name__ == "__main__":
    raise SystemExit(main())
