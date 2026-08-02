import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_fetch = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key="
new_fetch = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="

content = content.replace(old_fetch, new_fetch)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated AI model in app.js")
