#!/usr/bin/env python3
"""Initialize a minimal Zimo Skill directory inside the current workspace."""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import List


NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ALLOWED_RESOURCES = {"scripts", "references", "assets"}
SKILL_TEMPLATE = """---
name: {skill_name}
description: [TODO: describe what this Skill does and when to use it]
---

# {skill_title}

[TODO: replace this scaffold with complete Skill instructions]
"""


def parse_resources(value: str) -> List[str]:
    if not value:
        return []
    resources = value.split(",")
    if any(resource not in ALLOWED_RESOURCES for resource in resources):
        allowed = ", ".join(sorted(ALLOWED_RESOURCES))
        raise argparse.ArgumentTypeError(f"resources must be selected from: {allowed}")
    return list(dict.fromkeys(resources))


def resolve_output_root(path: str) -> Path:
    workspace = Path.cwd().resolve()
    output_root = (workspace / path).resolve()
    if output_root != workspace:
        raise ValueError("output path must be the current workspace: .")
    return output_root


def initialize_skill(skill_name: str, path: str, resources: List[str]) -> Path:
    if len(skill_name) > 64 or not NAME_PATTERN.fullmatch(skill_name):
        raise ValueError(
            "skill name must be 1-64 lowercase letters, digits, or single hyphens"
        )

    output_root = resolve_output_root(path)
    skill_directory = output_root / skill_name
    if skill_directory.exists():
        raise ValueError(f"skill directory already exists: {skill_directory}")

    skill_directory.mkdir()
    title = " ".join(part.capitalize() for part in skill_name.split("-"))
    (skill_directory / "SKILL.md").write_text(
        SKILL_TEMPLATE.format(skill_name=skill_name, skill_title=title),
        encoding="utf-8",
    )
    manifest = {
        "packageId": f"local.skill.{skill_name}",
        "name": title,
        "version": "1.0.0",
        "category": "本地",
        "permissions": ["context:user-input"],
    }
    (skill_directory / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    for resource in resources:
        (skill_directory / resource).mkdir()
    return skill_directory


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("skill_name")
    parser.add_argument("--path", required=True)
    parser.add_argument("--resources", type=parse_resources, default=[])
    args = parser.parse_args()

    try:
        result = initialize_skill(args.skill_name, args.path, args.resources)
    except (OSError, ValueError) as error:
        print(f"[ERROR] {error}", file=sys.stderr)
        sys.exit(1)
    print(f"[OK] initialized: {result}")


if __name__ == "__main__":
    main()
