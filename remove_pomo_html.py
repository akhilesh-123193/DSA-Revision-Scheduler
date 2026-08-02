import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the focusTimerWidget div
# It starts with "  <!-- ─── FOCUS TIMER WIDGET ──────────────────────────────────────── -->"
# and ends right before '<div id="toast" class="toast" role="status" aria-live="polite"></div>'

pattern = r'  <!-- ─── FOCUS TIMER WIDGET ──────────────────────────────────────── -->[\s\S]*?<div id="toast" class="toast" role="status" aria-live="polite"></div>'
replacement = '<div id="toast" class="toast" role="status" aria-live="polite"></div>'

new_content = re.sub(pattern, replacement, content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Removed from HTML")
