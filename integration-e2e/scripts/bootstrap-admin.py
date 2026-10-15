#!/usr/bin/env python3
"""Run the backend's supported interactive admin bootstrap without echoing secrets."""

import os
import pty
import select
import subprocess
import sys
import time


PROMPTS = (
    (b"Administrator username: ", "PHASE2_TEST_ADMIN_USERNAME"),
    (b"Password (minimum 12 characters): ", "PHASE2_TEST_ADMIN_PASSWORD"),
    (b"Confirm password: ", "PHASE2_TEST_ADMIN_PASSWORD"),
)


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
    process = subprocess.Popen(
        ["npm", "run", "staff:create-admin:dev"],
        cwd=backend_dir,
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        env=os.environ.copy(),
        close_fds=True,
    )
    os.close(slave_fd)
    pending = list(responses)
    prompt_buffer = b""
    started_at = time.monotonic()

    try:
        while process.poll() is None:
            if time.monotonic() - started_at > 90:
                process.kill()
                process.wait()
                print("Administrator bootstrap did not finish before the safety timeout.", file=sys.stderr)
                return 1
            readable, _, _ = select.select([master_fd], [], [], 0.25)
            if not readable:
                continue
            try:
                output = os.read(master_fd, 4096)
            except OSError:
                break
            prompt_buffer += output
            for prompt, value in list(pending):
                if prompt in prompt_buffer:
                    os.write(master_fd, value.encode("utf-8") + b"\n")
                    pending.remove((prompt, value))
                    prompt_buffer = b""

        return_code = process.wait()
        if return_code != 0 or pending:
            print(f"Supported administrator bootstrap failed (exit {return_code}; prompts remaining: {len(pending)}).", file=sys.stderr)
            return return_code or 1
        print("Disposable administrator created through the backend CLI.")
        return 0
    finally:
        os.close(master_fd)
        if process.poll() is None:
            process.kill()
            process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
