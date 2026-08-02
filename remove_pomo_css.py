import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'/\* ─── FOCUS TIMER WIDGET ─── \*/[\s\S]*?/\* ─── BLIND SPOT RADAR ─── \*/'
new_content = re.sub(pattern, '/* ─── BLIND SPOT RADAR ─── */', content)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Removed from CSS")
