#!/usr/bin/env python3
"""Write one UTF-8 text file inside an initialized Skill directory."""

import argparse
import sys
from pathlib import Path


MAX_CONTENT_CHARACTERS = 4_000
ALLOWED_SUFFIXES = {
    ".cjs",
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".py",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}


def resolve_skill_directory(value: str) -> Path:
    workspace = Path.cwd().resolve()
    skill_directory = (workspace / value).resolve(strict=True)
    if skill_directory == workspace or workspace not in skill_directory.parents:
        raise ValueError("skill directory must be inside the current workspace")
    if not skill_directory.is_dir() or not (skill_directory / "SKILL.md").is_file():
        raise ValueError("skill directory must contain SKILL.md")
    return skill_directory


def resolve_target(skill_directory: Path, relative_file: str) -> Path:
    relative = Path(relative_file)
    if relative.is_absolute() or not relative.parts or any(
        part in ("", ".", "..") for part in relative.parts
    ):
        raise ValueError("file path must be a safe relative path")
    if relative.suffix.lower() not in ALLOWED_SUFFIXES:
        raise ValueError("file extension is not an allowed UTF-8 text type")

    candidate = skill_directory / relative
    current = skill_directory
    for part in relative.parts:
        current = current / part
        if current.exists() and current.is_symlink():
            raise ValueError("refusing to write through a symbolic link")

    target = candidate.resolve()
    if skill_directory not in target.parents:
        raise ValueError("file path escapes the skill directory")
    return target


def write_file(target: Path, content: str, append: bool) -> None:
    if len(content) > MAX_CONTENT_CHARACTERS:
        raise ValueError(f"content chunk exceeds {MAX_CONTENT_CHARACTERS} characters")
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a" if append else "w", encoding="utf-8", newline="") as handle:
        handle.write(content)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("skill_directory")
    parser.add_argument("relative_file")
    parser.add_argument("--content", required=True)
    parser.add_argument("--append", action="store_true")
    args = parser.parse_args()

    try:
        skill_directory = resolve_skill_directory(args.skill_directory)
        target = resolve_target(skill_directory, args.relative_file)
        write_file(target, args.content, args.append)
    except (OSError, ValueError) as error:
        print(f"[ERROR] {error}", file=sys.stderr)
        sys.exit(1)
    operation = "appended" if args.append else "wrote"
    print(f"[OK] {operation}: {target}")


if __name__ == "__main__":
    main()
