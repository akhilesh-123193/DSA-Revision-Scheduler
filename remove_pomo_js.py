import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'/\* ============================================================\n   FOCUS TIMER \(POMODORO\) LOGIC\n============================================================ \*/[\s\S]*'
new_content = re.sub(pattern, '', content)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Removed from JS")
