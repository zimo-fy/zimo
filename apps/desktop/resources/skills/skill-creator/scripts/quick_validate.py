#!/usr/bin/env python3
"""Validate the final structure of a generated Zimo Skill."""

import json
import re
import sys
from pathlib import Path
from typing import Optional, Tuple, Union


NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PACKAGE_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{2,79}$")


def frontmatter_value(frontmatter: str, key: str) -> Optional[str]:
    match = re.search(rf"^{re.escape(key)}:\s*(.+?)\s*$", frontmatter, re.MULTILINE)
    if not match:
        return None
    return match.group(1).strip().strip("'\"")


def validate_manifest(skill_directory: Path) -> Tuple[bool, str]:
    manifest_path = skill_directory / "manifest.json"
    if not manifest_path.is_file():
        return False, "manifest.json not found"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return False, f"invalid manifest.json: {error}"
    if not isinstance(manifest, dict):
        return False, "manifest.json must contain an object"
    package_id = manifest.get("packageId")
    if not isinstance(package_id, str) or not PACKAGE_ID_PATTERN.fullmatch(package_id):
        return False, "manifest packageId is missing or invalid"
    return True, "manifest is valid"


def validate_skill(skill_path: Union[str, Path]) -> Tuple[bool, str]:
    skill_directory = Path(skill_path)
    if not skill_directory.is_dir():
        return False, "skill directory not found"
    skill_md = skill_directory / "SKILL.md"
    if not skill_md.is_file():
        return False, "SKILL.md not found"

    try:
        content = skill_md.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        return False, f"cannot read SKILL.md as UTF-8: {error}"
    match = re.match(r"^---\r?\n(.*?)\r?\n---(?:\r?\n|$)", content, re.DOTALL)
    if not match:
        return False, "invalid SKILL.md frontmatter"

    name = frontmatter_value(match.group(1), "name")
    description = frontmatter_value(match.group(1), "description")
    if not name or len(name) > 64 or not NAME_PATTERN.fullmatch(name):
        return False, "name must be 1-64 lowercase letters, digits, or single hyphens"
    if skill_directory.name != name:
        return False, "skill directory name must match frontmatter name"
    if not description:
        return False, "description is missing"
    if len(description) > 1024 or "<" in description or ">" in description:
        return False, "description is invalid"
    if "[TODO:" in content or "TODO" in content:
        return False, "SKILL.md contains an unfinished TODO"
    if not content[match.end() :].strip():
        return False, "SKILL.md instructions are empty"

    manifest_valid, manifest_message = validate_manifest(skill_directory)
    if not manifest_valid:
        return False, manifest_message
    return True, "Skill is valid!"


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: quick_validate.py <skill-directory>", file=sys.stderr)
        sys.exit(1)
    valid, message = validate_skill(sys.argv[1])
    print(message)
    sys.exit(0 if valid else 1)


if __name__ == "__main__":
    main()
