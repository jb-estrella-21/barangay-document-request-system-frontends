import base64
import importlib.util
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ADAPTER_PATH = Path(__file__).resolve().parents[1] / "scripts" / "bootstrap-admin.py"
ADAPTER_SPEC = importlib.util.spec_from_file_location("bootstrap_admin", ADAPTER_PATH)
bootstrap_admin = importlib.util.module_from_spec(ADAPTER_SPEC)
ADAPTER_SPEC.loader.exec_module(bootstrap_admin)
PROMPTS = bootstrap_admin.PROMPTS
classify_failure = bootstrap_admin.classify_failure
has_unexpected_prompt = bootstrap_admin.has_unexpected_prompt


def run_adapter_with_fake_cli(cli_source):
    with tempfile.TemporaryDirectory() as temporary_directory:
        temporary_path = Path(temporary_directory)
        backend_directory = temporary_path / "backend"
        fake_bin = temporary_path / "bin"
        backend_directory.mkdir()
        fake_bin.mkdir()
        fake_npm = fake_bin / "npm"
        fake_npm.write_text(f"#!/usr/bin/env python3\n{cli_source}", encoding="utf-8")
        fake_npm.chmod(0o755)

        environment = os.environ.copy()
        environment.update(
            {
                "PATH": f"{fake_bin}{os.pathsep}{environment.get('PATH', '')}",
                "PHASE2_BACKEND_DIR": str(backend_directory),
                "PHASE2_TEST_ADMIN_USERNAME": "phase3-ci-admin",
                "PHASE2_TEST_ADMIN_PASSWORD": "temporary-test-password-sentinel",
                "DATABASE_URL": "postgresql://postgres@127.0.0.1:5432/disposable_test?schema=public",
                "IDEMPOTENCY_ENCRYPTION_KEY": base64.b64encode(b"x" * 32).decode("ascii"),
            }
        )
        return subprocess.run(
            [sys.executable, str(ADAPTER_PATH)],
            cwd=temporary_path,
            env=environment,
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )


class BootstrapAdminDiagnosticsTests(unittest.TestCase):
    def test_environment_validation_failure_is_classified_without_output(self):
        captured = b"IDEMPOTENCY_ENCRYPTION_KEY must be valid; sentinel-secret-value"

        category = classify_failure(captured, prompts_remaining=3, exit_code=1)

        self.assertEqual(category, "environment validation failure before prompting")
        self.assertNotIn("sentinel-secret-value", category)

    def test_database_connection_failure_is_classified(self):
        self.assertEqual(
            classify_failure(b"Prisma error P1001", prompts_remaining=3, exit_code=1),
            "database connection failure",
        )

    def test_unrecognized_first_exit_is_classified_as_before_prompting(self):
        self.assertEqual(
            classify_failure(b"", prompts_remaining=3, exit_code=1),
            "CLI failed before prompting",
        )

    def test_input_timeout_and_unexpected_prompt_are_distinguished(self):
        self.assertEqual(
            classify_failure(b"", prompts_remaining=3, timed_out=True),
            "CLI startup timeout before prompting",
        )
        self.assertEqual(
            classify_failure(b"", prompts_remaining=2, timed_out=True),
            "input timeout",
        )
        self.assertEqual(
            classify_failure(b"", prompts_remaining=2, unexpected_prompt=True, exit_code=-9),
            "unexpected prompt sequence",
        )

    def test_partial_prompt_match_does_not_accept_a_reordered_prompt(self):
        expected_username = PROMPTS[0][0]

        self.assertFalse(has_unexpected_prompt(expected_username, expected_username))
        self.assertTrue(has_unexpected_prompt(b"Confirm password: ", expected_username))

    def test_other_nonzero_exit_is_reported_as_unexpected_termination(self):
        self.assertEqual(
            classify_failure(b"", prompts_remaining=1, exit_code=1),
            "process terminated unexpectedly",
        )

    def test_adapter_drives_the_supported_prompt_sequence_without_echoing_password(self):
        fake_cli = '''
import os
import sys
import termios
import tty
import base64

def read_hidden(prompt):
    fd = sys.stdin.fileno()
    original = termios.tcgetattr(fd)
    tty.setraw(fd)
    sys.stdout.write(prompt)
    sys.stdout.flush()
    value = bytearray()
    while True:
        character = os.read(fd, 1)
        if character in (b"\\r", b"\\n"):
            break
        value.extend(character)
    termios.tcsetattr(fd, termios.TCSANOW, original)
    return value.decode()

username = read_hidden("Administrator username: ")
password = read_hidden("Password (minimum 12 characters): ")
confirmation = read_hidden("Confirm password: ")
assert username == os.environ["PHASE2_TEST_ADMIN_USERNAME"]
assert password == os.environ["PHASE2_TEST_ADMIN_PASSWORD"] == confirmation
assert len(base64.b64decode(os.environ["IDEMPOTENCY_ENCRYPTION_KEY"])) == 32
'''

        result = run_adapter_with_fake_cli(fake_cli)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Disposable administrator created through the backend CLI.", result.stdout)
        self.assertNotIn("temporary-test-password-sentinel", result.stdout + result.stderr)

    def test_adapter_reports_environment_failure_without_printing_cli_output(self):
        fake_cli = '''
import sys
sys.stderr.write("IDEMPOTENCY_ENCRYPTION_KEY invalid; temporary-test-password-sentinel\\n")
raise SystemExit(1)
'''

        result = run_adapter_with_fake_cli(fake_cli)

        self.assertEqual(result.returncode, 1)
        self.assertIn("environment validation failure before prompting", result.stderr)
        self.assertNotIn("temporary-test-password-sentinel", result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
