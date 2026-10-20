#!/usr/bin/env python3
"""my-writer start/stop script.

Usage:
  python3 start.py        Start all services (LanguageTool, backend, frontend)
  python3 start.py -e     Stop all running services and clean up

Services started:
  1. LanguageTool (Docker container, port 8081)
  2. Backend      (uvicorn,           port 8000)
  3. Frontend     (Vite dev server,   port 5173)
"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

# Force unbuffered output so logs appear in real time
os.environ["PYTHONUNBUFFERED"] = "1"
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
PID_DIR = PROJECT_ROOT / ".run"
PID_FILE = PID_DIR / "pids.json"

LANGUAGETOOL_IMAGE = "erikvl87/languagetool:latest"
LANGUAGETOOL_CONTAINER = "my-writer-languagetool"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"


def log(msg: str, color: str = "") -> None:
    print(f"{color}{msg}{RESET}")


def docker_cmd() -> list[str]:
    """Return the docker command prefix.

    Tries plain ``docker`` first (works if user is in docker group AND the
    session has the group active).  Falls back to ``sg docker -c`` which
    activates the group for just that command.  Last resort: ``sudo docker``.
    """
    # Try plain docker
    try:
        test = subprocess.run(
            ["docker", "ps", "-q"],
            capture_output=True, text=True, timeout=5,
        )
        if test.returncode == 0:
            return ["docker"]
    except Exception:
        pass

    # Try sg docker -c (activates docker group for this one command)
    try:
        test = subprocess.run(
            ["sg", "docker", "-c", "docker ps -q"],
            capture_output=True, text=True, timeout=5,
        )
        if test.returncode == 0:
            return ["sg", "docker", "-c"]
    except Exception:
        pass

    return ["sudo", "docker"]


def run_docker(args: list[str], **kwargs) -> subprocess.CompletedProcess:
    """Run a docker command, handling the sg wrapper."""
    dcmd = docker_cmd()
    if dcmd == ["sg", "docker", "-c"]:
        # sg docker -c "docker run -d ..."
        full_cmd = dcmd + [" ".join(["docker"] + args)]
        return subprocess.run(full_cmd, capture_output=True, text=True, **kwargs)
    return subprocess.run(dcmd + args, capture_output=True, text=True, **kwargs)


def popen_docker(args: list[str], **kwargs) -> subprocess.Popen:
    """Popen a docker command, handling the sg wrapper."""
    dcmd = docker_cmd()
    if dcmd == ["sg", "docker", "-c"]:
        full_cmd = dcmd + [" ".join(["docker"] + args)]
        # Ensure text mode for communicate() to work cleanly
        kwargs.setdefault("text", True)
        return subprocess.Popen(full_cmd, **kwargs)
    return subprocess.Popen(dcmd + args, **kwargs)


def wait_for_port(host: str, port: int, timeout: int = 60, name: str = "") -> bool:
    """Wait until a TCP port accepts connections (tries both IPv4 and IPv6)."""
    import socket

    start = time.time()
    while time.time() - start < timeout:
        for family in (socket.AF_INET, socket.AF_INET6):
            try:
                with socket.socket(family, socket.SOCK_STREAM) as s:
                    s.settimeout(2)
                    s.connect((host, port))
                    return True
            except (ConnectionRefusedError, OSError, socket.timeout):
                pass
        time.sleep(1)
    log(f"  ✗ {name or port} did not come up in {timeout}s", RED)
    return False


def wait_for_http(url: str, timeout: int = 60, name: str = "") -> bool:
    """Wait until an HTTP endpoint returns any response."""
    import urllib.request

    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(url, timeout=5)
            return True
        except urllib.error.HTTPError:
            # Any HTTP response means the server is up
            return True
        except Exception:
            time.sleep(2)
    log(f"  ✗ {name or url} did not respond in {timeout}s", RED)
    return False


def save_pids(pids: dict) -> None:
    import json

    PID_DIR.mkdir(exist_ok=True)
    PID_FILE.write_text(json.dumps(pids, indent=2))


def load_pids() -> dict:
    import json

    if PID_FILE.exists():
        try:
            return json.loads(PID_FILE.read_text())
        except Exception:
            return {}
    return {}


def kill_pid(pid: int) -> bool:
    """Kill a process by PID, then its children."""
    try:
        os.kill(pid, signal.SIGTERM)
        time.sleep(0.5)
        # Check if still alive
        try:
            os.kill(pid, 0)
            # Force kill
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return False


def kill_process_group(pid: int) -> bool:
    """Kill an entire process group by the leader PID."""
    try:
        os.killpg(os.getpgid(pid), signal.SIGTERM)
        time.sleep(0.5)
        try:
            os.killpg(os.getpgid(pid), signal.SIGKILL)
        except ProcessLookupError:
            pass
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return False


# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------

def start() -> None:
    log("\n" + "=" * 60, BOLD)
    log("  Personal Writing Workspace — Starting", BOLD + GREEN)
    log("=" * 60, BOLD)

    pids: dict = {}

    # -----------------------------------------------------------------------
    # 1. LanguageTool (Docker)
    # -----------------------------------------------------------------------
    log("\n[1/3] Starting LanguageTool (Docker)…", YELLOW)

    # Check if container already running
    check = run_docker(["ps", "-q", "-f", f"name={LANGUAGETOOL_CONTAINER}"])
    if check.stdout.strip():
        log("  → LanguageTool container already running, reusing.")
    else:
        # Remove any stopped container with same name
        run_docker(["rm", "-f", LANGUAGETOOL_CONTAINER])
        proc = popen_docker(
            [
                "run", "-d",
                "--name", LANGUAGETOOL_CONTAINER,
                "-p", "8081:8010",
                "--restart", "no",
                LANGUAGETOOL_IMAGE,
            ],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        out, err = proc.communicate()
        if proc.returncode != 0:
            log(f"  ✗ Failed to start LanguageTool container: {err.strip()}", RED)
            log("    Make sure Docker is running.", RED)
        else:
            log(f"  → Container started (id: {out.strip()[:12]})")

    if wait_for_http("http://localhost:8081/v2/languages", timeout=120, name="LanguageTool"):
        log("  ✓ LanguageTool ready on :8081", GREEN)
    else:
        log("  ⚠ LanguageTool may still be loading (Java is slow to start).", YELLOW)

    # -----------------------------------------------------------------------
    # 2. Backend (uvicorn)
    # -----------------------------------------------------------------------
    log("\n[2/3] Starting Backend (uvicorn)…", YELLOW)

    # Check if port 8000 is already in use
    backend_proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "run:app",
            "--host", "127.0.0.1",
            "--port", "8000",
        ],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=True,  # new process group for clean kill
    )
    pids["backend"] = backend_proc.pid
    log(f"  → uvicorn PID {backend_proc.pid}")

    if wait_for_http("http://localhost:8000/health", timeout=30, name="Backend"):
        log("  ✓ Backend ready on :8000", GREEN)
    else:
        log("  ✗ Backend failed to start", RED)
        # Print last few lines of output
        if backend_proc.stdout:
            output = backend_proc.stdout.read()
            if output:
                log("  Output:\n" + output.decode()[-500:], RED)

    # -----------------------------------------------------------------------
    # 3. Frontend (Vite dev server)
    # -----------------------------------------------------------------------
    log("\n[3/3] Starting Frontend (Vite)…", YELLOW)

    # Determine npm executable (may not be in PATH in non-interactive shells)
    npm_bin = os.environ.get("NPM_BIN", "npm")
    if not shutil.which(npm_bin):
        # Try common nvm locations
        for candidate in [
            os.path.expanduser("~/.nvm/versions/node/v20.20.2/bin/npm"),
            os.path.expanduser("~/.nvm/versions/node/v20.20.2/bin/npx"),
        ]:
            if os.path.isfile(candidate):
                npm_bin = candidate
                break
        else:
            log("  ✗ npm not found. Make sure Node.js is installed.", RED)
            save_pids(pids)
            return

    frontend_proc = subprocess.Popen(
        [npm_bin, "run", "dev"],
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    pids["frontend"] = frontend_proc.pid
    log(f"  → vite PID {frontend_proc.pid}")

    if wait_for_port("localhost", 5173, timeout=30, name="Frontend"):
        log("  ✓ Frontend ready on :5173", GREEN)
    else:
        log("  ✗ Frontend failed to start", RED)

    # Save PIDs
    save_pids(pids)

    # -----------------------------------------------------------------------
    # Done
    # -----------------------------------------------------------------------
    log("\n" + "=" * 60, BOLD + GREEN)
    log("  All services running!", BOLD + GREEN)
    log("=" * 60, BOLD + GREEN)
    log("\n  App:        http://localhost:5173", GREEN + BOLD)
    log("  API docs:    http://localhost:8000/docs", GREEN)
    log("  Grammar:     http://localhost:8081", GREEN)
    log(f"\n  To stop:     python3 start.py -e\n", YELLOW)


# ---------------------------------------------------------------------------
# Stop
# ---------------------------------------------------------------------------

def stop() -> None:
    log("\n" + "=" * 60, BOLD)
    log("  Personal Writing Workspace — Stopping", BOLD + RED)
    log("=" * 60, BOLD)

    pids = load_pids()

    # -----------------------------------------------------------------------
    # Kill frontend (vite)
    # -----------------------------------------------------------------------
    if "frontend" in pids:
        pid = pids["frontend"]
        log(f"\n[1/3] Stopping Frontend (PID {pid})…", YELLOW)
        if kill_process_group(pid):
            log("  ✓ Frontend stopped", GREEN)
        else:
            log("  ⚠ Frontend process not found (may have already exited)", YELLOW)

    # -----------------------------------------------------------------------
    # Kill backend (uvicorn)
    # -----------------------------------------------------------------------
    if "backend" in pids:
        pid = pids["backend"]
        log(f"\n[2/3] Stopping Backend (PID {pid})…", YELLOW)
        if kill_process_group(pid):
            log("  ✓ Backend stopped", GREEN)
        else:
            log("  ⚠ Backend process not found (may have already exited)", YELLOW)

    # -----------------------------------------------------------------------
    # Stop LanguageTool container
    # -----------------------------------------------------------------------
    log(f"\n[3/3] Stopping LanguageTool container…", YELLOW)
    stop_proc = run_docker(["stop", LANGUAGETOOL_CONTAINER])
    rm_proc = run_docker(["rm", "-f", LANGUAGETOOL_CONTAINER])
    if stop_proc.returncode == 0 or rm_proc.returncode == 0:
        log("  ✓ LanguageTool container stopped and removed", GREEN)
    else:
        log("  ⚠ LanguageTool container not found (was not running)", YELLOW)

    # -----------------------------------------------------------------------
    # Kill any remaining processes on our ports (safety net)
    # -----------------------------------------------------------------------
    for port in [5173, 8000]:
        try:
            result = subprocess.run(
                ["fuser", f"{port}/tcp"],
                capture_output=True, text=True,
            )
            if result.stdout.strip():
                for pid_str in result.stdout.split():
                    pid = int(pid_str)
                    if pid != os.getpid():
                        kill_pid(pid)
                        log(f"  Cleaned up orphan process on port {port} (PID {pid})", YELLOW)
        except (FileNotFoundError, subprocess.SubprocessError):
            pass

    # Clean up PID file
    if PID_FILE.exists():
        PID_FILE.unlink()

    log("\n" + "=" * 60, BOLD + GREEN)
    log("  All services stopped. Clean!", BOLD + GREEN)
    log("=" * 60, BOLD + GREEN)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] in ("-e", "--stop", "--end"):
        stop()
    elif len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"):
        print(__doc__)
    else:
        start()


if __name__ == "__main__":
    main()
