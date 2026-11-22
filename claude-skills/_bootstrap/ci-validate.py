#!/usr/bin/env python3
"""Kiểm tra repo skills trong CI: frontmatter SKILL.md, JSON, cú pháp Python.

Lỗi → exit 1. Tên skill trùng chỉ cảnh báo (không chặn pipeline).
"""
import glob
import json
import re
import sys
from collections import defaultdict

FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.S)
# Ký hiệu khối nhiều dòng của YAML (>, |, kèm -/+ hoặc số thụt lề); comment đã được bỏ trước khi so
BLOCK_SCALAR = re.compile(r"[>|][-+0-9]*")
# Chuỗi trong nháy đơn hoặc kép, có thể theo sau là comment
QUOTED = re.compile(r"""(["'])(.*?)\1(?:[ \t]+#.*)?""")


def field(frontmatter, key):
    """Giá trị của khóa; với giá trị viết ở các dòng thụt lề bên dưới thì trả về dòng đầu tiên."""
    m = re.search(rf"^{key}:[ \t]*(.*)$", frontmatter, re.M)
    if not m:
        return None
    value = m.group(1).strip()
    quoted = QUOTED.fullmatch(value)
    if quoted:
        # chuỗi có nháy là giá trị đầy đủ, kể cả khi rỗng: không xét dòng bên dưới
        return quoted.group(2).strip()
    value = re.sub(r"(^|[ \t]+)#.*$", "", value)
    if BLOCK_SCALAR.fullmatch(value):
        value = ""
    if not value:
        # bỏ qua dòng trống; dừng ở dòng có nội dung đầu tiên, chỉ nhận nếu dòng đó thụt lề
        nxt = re.match(r"(?:\n[ \t]*(?=\n|\Z))*\n([ \t]+)(\S.*)", frontmatter[m.end():])
        value = nxt.group(2).strip() if nxt else ""
    return value


def read_text(path, errors):
    """Đọc nguyên văn (giữ CRLF); lỗi mã hóa ghi vào errors và trả về None."""
    try:
        return open(path, encoding="utf-8", newline="").read()
    except UnicodeDecodeError as e:
        errors.append(f"{path}: không đọc được UTF-8 — {e}")
        return None


def check_skills(errors, warnings):
    names = defaultdict(list)
    paths = sorted(glob.glob("*/SKILL.md"))
    for path in paths:
        text = read_text(path, errors)
        if text is None:
            continue
        if text.startswith("﻿"):
            errors.append(f"{path}: có BOM ở đầu file, cần lưu lại dạng UTF-8 không BOM")
        if "\r\n" in text:
            errors.append(f"{path}: dùng dòng kết thúc CRLF, cần đổi sang LF")
        m = FRONTMATTER.match(text.lstrip("﻿").replace("\r\n", "\n"))
        if not m:
            errors.append(f"{path}: thiếu frontmatter --- ... ---")
            continue
        name = field(m.group(1), "name")
        if not name:
            errors.append(f"{path}: thiếu name")
        else:
            names[name].append(path)
        if not field(m.group(1), "description"):
            errors.append(f"{path}: thiếu description")
    for name, where in names.items():
        if len(where) > 1:
            warnings.append(f"tên skill '{name}' trùng ở: {', '.join(where)}")
    return len(paths)


def check_json(errors):
    paths = [p for p in glob.glob("**/*.json", recursive=True) if not p.startswith(".git/")]
    for path in paths:
        try:
            json.load(open(path, encoding="utf-8"))
        except (ValueError, UnicodeDecodeError) as e:
            errors.append(f"{path}: JSON lỗi — {e}")
    return len(paths)


def check_python(errors):
    paths = [p for p in glob.glob("**/*.py", recursive=True) if not p.startswith(".git/")]
    for path in paths:
        text = read_text(path, errors)
        if text is None:
            continue
        try:
            compile(text, path, "exec")
        except SyntaxError as e:
            errors.append(f"{path}:{e.lineno}: Python lỗi cú pháp — {e.msg}")
    return len(paths)


def main():
    errors, warnings = [], []
    n_skill = check_skills(errors, warnings)
    n_json = check_json(errors)
    n_py = check_python(errors)
    print(f"Đã kiểm: {n_skill} SKILL.md, {n_json} JSON, {n_py} Python")
    for w in warnings:
        print(f"CẢNH BÁO: {w}")
    for e in errors:
        print(f"LỖI: {e}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
