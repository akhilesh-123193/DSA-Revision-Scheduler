import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Make paper-panel glassmorphic
content = content.replace(
    """  background: var(--cream);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 4px 12px rgba(0,0,0,.08);""",
    """  background: rgba(30, 41, 59, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: var(--radius);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);"""
)

# Fix dm-body background
content = content.replace(
    "background: rgba(255,252,242,0.9);",
    "background: rgba(30, 41, 59, 0.7);backdrop-filter: blur(12px);"
)
content = content.replace(
    "background: rgba(255,255,255,0.75);",
    "background: rgba(15, 23, 42, 0.7);backdrop-filter: blur(12px);"
)

# Main background area (was cream)
content = content.replace(
    "background: var(--cream);",
    "background: var(--cream);" # Now it's mapped to a dark blue
)

# App shell glowing radial gradient
old_shell = """  display: flex;
  height: 100%;
  position: relative;
  z-index: 1;"""

new_shell = """  display: flex;
  height: 100%;
  position: relative;
  z-index: 1;
  background: radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.15), transparent 50%),
              radial-gradient(circle at 100% 100%, rgba(16, 185, 129, 0.1), transparent 50%),
              var(--cream);"""
content = content.replace(old_shell, new_shell)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Upgraded to Glassmorphism")
