#!/usr/bin/env bash
# PreToolUse hook: khi sắp `git commit`, chèn nhắc áp lens clean-code cho diff.
# Ship code (Claude hoặc Codex) đều kết thúc bằng git commit → chốt chặn chung.
# Non-blocking: chỉ thêm context, không chặn.
input="$(cat)"
cmd="$(printf '%s' "$input" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write((JSON.parse(d).tool_input||{}).command||'')}catch(e){}})" 2>/dev/null)"
case "$cmd" in
  *"git commit"*)
    cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"[clean-code gate] Trước khi commit CODE: áp lens /clean-code cho diff — tên rõ, hàm nhỏ một-việc, bỏ trùng lặp (đúng lúc), lỗi tường minh, design pattern chỉ khi có nhu cầu thật (không phòng xa). Bỏ qua nếu commit chỉ là docs/config/report."}}
JSON
    ;;
esac
exit 0
