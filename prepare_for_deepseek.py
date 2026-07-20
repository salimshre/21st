#!/usr/bin/env python3
"""
PREPARE FOR DEEPSEEK – Python script (with .gitignore support & config file)

Step 1: Generate FILE_STRUCTURE.md (project tree)
Step 2: Copy code files to tmp/ (flat)

Usage:  python prepare_for_deepseek.py
        (run from your project root; optionally place a prepare_config.json there)
"""

import json
import os
import shutil
import sys
import platform
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Try to import pathspec for .gitignore support
try:
    import pathspec
    HAVE_PATHSPEC = True
except ImportError:
    HAVE_PATHSPEC = False

# ---------- Default configuration (mirrors your updated .bat) ----------
DEFAULT_CONFIG = {
    "code_extensions": [".php", ".js", ".css", ".html"],
    "skip_top_level": [
        "archive", ".git", ".github", ".agents", "tmp",
        "journal", "data", "deploy", "versions"
    ],
    "skip_any_depth": [
        "archive", "parsedown", "icons", "__pycache__",
        ".venv", "server-logs", "trash", "previous-version", "tmp"
    ],
    "tree_exclude": [".git", ".agents", "FILE_STRUCTURE.md"],
    "tree_summarize": ["__pycache__", ".pytest_cache", ".ruff_cache"],
    "max_tree_depth": 10,
    "tmp_dir": "tmp",
    "tree_output_file": "FILE_STRUCTURE.md",
    "use_gitignore": True
}

def load_config() -> dict:
    """Load config from 'prepare_config.json' if it exists, else use defaults."""
    config_path = Path("prepare_config.json")
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                user_config = json.load(f)
            # Merge with defaults – user values override
            merged = DEFAULT_CONFIG.copy()
            merged.update(user_config)
            print("   Loaded settings from prepare_config.json")
            return merged
        except Exception as e:
            print(f"   Warning: Could not parse config file ({e}). Using defaults.")
    return DEFAULT_CONFIG.copy()

def human_size(size_bytes: int) -> str:
    """Return human-readable file size."""
    for unit in ('B', 'KB', 'MB', 'GB', 'TB'):
        if size_bytes < 1024:
            return f"{size_bytes:.2f} {unit}" if unit != 'B' else f"{size_bytes} B"
        size_bytes /= 1024
    return f"{size_bytes:.2f} PB"

# ---------- Tree generation ----------
def generate_tree(root: Path, config: dict) -> None:
    """Write the Markdown tree file."""
    output_path = root / config["tree_output_file"]
    exclude_set = set(config["tree_exclude"])
    summary_set = set(config["tree_summarize"])
    max_depth = config["max_tree_depth"]

    dir_count = 0
    file_count = 0
    lines = []

    def walk(directory: Path, prefix: str = "", depth: int = 0):
        nonlocal dir_count, file_count
        if depth > max_depth:
            return
        try:
            entries = sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        except PermissionError:
            return
        for i, entry in enumerate(entries):
            if entry.name in exclude_set:
                continue
            is_last = (i == len(entries) - 1)
            branch = "└── " if is_last else "├── "
            indent_cont = "    " if is_last else "│   "

            if entry.is_dir() and entry.name in summary_set:
                lines.append(f"{prefix}{branch}{entry.name}/ (summary: compiled/pycache)")
                dir_count += 1
                continue

            line = f"{prefix}{branch}{entry.name}"
            if entry.is_dir():
                line += "/"
                lines.append(line)
                dir_count += 1
                walk(entry, prefix + indent_cont, depth + 1)
            else:
                size = human_size(entry.stat().st_size)
                line += f" ({size})"
                lines.append(line)
                file_count += 1

    walk(root)

    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    header = (
        f"# Repository file structure\n\n"
        f"Generated: {now}\n\n"
        f"A cleaner, hierarchical view of the repository. Directories end with '/'.\n"
        f"Cache folders ({', '.join(summary_set)}) are summarised.\n"
        f"Excluded: {', '.join(sorted(exclude_set))}.\n\n"
        f"## Summary\n"
        f"- Directories: {dir_count}\n"
        f"- Files: {file_count}\n\n"
        f"## Tree\n"
    )

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(header)
        f.write("\n".join(lines))
        f.write("\n")

    print(f"   {output_path.name} generated successfully ({dir_count} dirs, {file_count} files).")

# ---------- .gitignore pattern matcher ----------
def get_gitignore_spec(root: Path) -> Optional[object]:
    """Return a pathspec object from .gitignore, or None if not available."""
    gitignore_path = root / ".gitignore"
    if not gitignore_path.exists() or not HAVE_PATHSPEC:
        return None
    try:
        with open(gitignore_path, "r", encoding="utf-8") as f:
            return pathspec.PathSpec.from_lines("gitwildmatch", f)
    except Exception:
        return None

# ---------- Flat copy with .gitignore and unique naming ----------
def should_skip_file(rel_path: Path, ext: str, config: dict, gitignore_spec) -> tuple[bool, str]:
    """Determine if a file should be skipped, and why."""
    # 1. Extension not in whitelist
    if ext.lower() not in [e.lower() for e in config["code_extensions"]]:
        return True, f"not code ext ({ext})"

    parts = rel_path.parts

    # 2. Top-level folder skip
    if parts and parts[0] in config["skip_top_level"]:
        return True, f"in skipped folder: {parts[0]}"

    # 3. Any-depth folder skip
    if any(part in config["skip_any_depth"] for part in parts):
        return True, "in skipped subfolder"

    # 4. .gitignore pattern match (if enabled)
    if config["use_gitignore"] and gitignore_spec is not None:
        # pathspec expects a relative path with forward slashes
        rel_str = rel_path.as_posix()
        if gitignore_spec.match_file(rel_str):
            return True, "matched .gitignore"

    return False, ""

def make_unique_name(rel_path: Path, dest_dir: Path) -> str:
    """
    Return a unique filename inside dest_dir.
    - First try the original filename.
    - If that exists, use the full relative path (with -- as separator).
    - If that still exists, append a counter.
    """
    original = rel_path.name
    if not (dest_dir / original).exists():
        return original

    # Build prefixed name from full relative path (excluding the file itself)
    parent_parts = list(rel_path.parts[:-1])
    prefix = "--".join(parent_parts)  # e.g., public--assets--js
    prefixed = f"{prefix}--{original}"

    candidate = dest_dir / prefixed
    if not candidate.exists():
        return prefixed

    # Still clash – add a numeric suffix
    stem = Path(prefixed).stem
    suffix = Path(prefixed).suffix
    counter = 1
    while True:
        alt = f"{stem}_{counter}{suffix}"
        if not (dest_dir / alt).exists():
            return alt
        counter += 1

def copy_flat(root: Path, config: dict) -> tuple[int, int, list[str]]:
    """Walk project, copy code files flat, return (copied, skipped, log_lines)."""
    dest_dir = root / config["tmp_dir"]

    if dest_dir.exists():
        print("   Removing old tmp folder...")
        shutil.rmtree(dest_dir)
    dest_dir.mkdir()

    gitignore_spec = get_gitignore_spec(root) if config["use_gitignore"] else None
    if config["use_gitignore"] and HAVE_PATHSPEC and gitignore_spec:
        print("   .gitignore patterns loaded.")
    elif config["use_gitignore"] and not HAVE_PATHSPEC:
        print("   Warning: pathspec not installed – .gitignore will be ignored.")
        print("   Install with: pip install pathspec")

    copied = 0
    skipped = 0
    log = []

    tree_output = config["tree_output_file"]

    for file_path in root.rglob("*"):
        if not file_path.is_file():
            continue

        rel = file_path.relative_to(root)

        # Always skip the tmp/ folder and the tree output file itself
        if rel.parts and rel.parts[0] == config["tmp_dir"]:
            continue
        if rel.name == tree_output:
            continue

        ext = file_path.suffix
        skip, reason = should_skip_file(rel, ext, config, gitignore_spec)

        if skip:
            skipped += 1
            log.append(f"   {rel}  [{reason}]")
            continue

        # Determine destination name, guaranteeing uniqueness
        dest_name = make_unique_name(rel, dest_dir)
        dest_path = dest_dir / dest_name

        try:
            shutil.copy2(file_path, dest_path)
            copied += 1
            if dest_name != rel.name:
                print(f"     {dest_name}  (from {rel.name})")
            else:
                print(f"     {dest_name}")
        except Exception as e:
            print(f"     WARNING: Failed to copy {file_path}: {e}")

    # Also copy the tree file into tmp/
    tree_file = root / tree_output
    if tree_file.exists():
        shutil.copy2(tree_file, dest_dir / tree_output)
        copied += 1
        print(f"     {tree_output}  (project tree)")

    return copied, skipped, log

# ---------- Main ----------
def main():
    # Change to script directory
    script_dir = Path(__file__).parent.resolve()
    os.chdir(script_dir)
    project_root = Path.cwd()

    print("=" * 55)
    print(" PREPARE FOR DEEPSEEK - All-in-one script (Python)")
    print(" Step 1: Generate FILE_STRUCTURE.md (project tree)")
    print(" Step 2: Copy code files to tmp/ (flat)")
    print("=" * 55)
    print()

    # Load configuration (from file or defaults)
    config = load_config()

    # --- Step 1 ---
    print("[STEP 1] Generating FILE_STRUCTURE.md ...")
    print()
    generate_tree(project_root, config)
    print()
    print("[STEP 1] Done.")
    print()

    # --- Step 2 ---
    print("[STEP 2] Copying code files to tmp/ ...")
    print()
    print(f"   Scanning files from: {project_root}")
    print()
    print("   --- Copied files ---")

    copied, skipped, skip_log = copy_flat(project_root, config)

    print()
    print("   --- Skipped files ---")
    for line in skip_log:
        print(line)

    print()
    print("=" * 55)
    print(" ALL DONE!")
    print("-" * 55)
    print(f" FILE_STRUCTURE.md:  generated")
    print(f" Code files copied:  {copied}")
    print(f" Files skipped:      {skipped}")
    print("=" * 55)
    print()

    # Open tmp folder
    tmp_path = project_root / config["tmp_dir"]
    print("Opening tmp folder...")
    try:
        if platform.system() == "Windows":
            os.startfile(tmp_path)
        elif platform.system() == "Darwin":
            subprocess.run(["open", str(tmp_path)])
        else:
            subprocess.run(["xdg-open", str(tmp_path)])
    except Exception as e:
        print(f"Could not open folder automatically: {e}")
        print(f"Please open {tmp_path} manually.")

    input("Press Enter to exit...")

if __name__ == "__main__":
    main()
    