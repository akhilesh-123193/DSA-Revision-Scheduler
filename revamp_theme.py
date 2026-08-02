import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace :root
old_root = r":root \{[\s\S]*?--border:  rgba\(28,21,16,\.14\);\n\}"
new_root = """:root {
  /* Premium Dark Glass Palette */
  --cream:   #0f172a; 
  --cream-2: #1e293b; 
  --cream-3: #1e293b;
  --ink:     #f8fafc;
  --ink-60:  rgba(248, 250, 252, 0.6);
  --ink-25:  rgba(248, 250, 252, 0.25);
  --ink-10:  rgba(248, 250, 252, 0.10);

  /* Sidebar */
  --sidebar-bg:   #020617;
  --sidebar-line: rgba(255, 255, 255, 0.05);
  --sidebar-w:    260px;

  /* Accent colours - Neon */
  --gold:    #8b5cf6; 
  --gold-bg: rgba(139, 92, 246, 0.15);
  --red:     #f43f5e;
  --red-bg:  rgba(244, 63, 94, 0.15);
  --green:   #10b981;
  --green-bg:rgba(16, 185, 129, 0.15);
  --blue:    #3b82f6;
  --blue-bg: rgba(59, 130, 246, 0.15);

  /* Misc */
  --radius:  20px;
  --rad-sm:  12px;
  --fast:    200ms cubic-bezier(0.4, 0, 0.2, 1);
  --shadow:  0 25px 50px -12px rgba(0, 0, 0, 0.5);
  --panel-bg: rgba(30, 41, 59, 0.7);
  --border:  rgba(255, 255, 255, 0.08);
}"""

content = re.sub(old_root, new_root, content)

# Replace body font
old_body = """body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 15px;
  color: var(--ink);
  background: var(--ink);
  display: flex;
}"""

new_body = """@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 15px;
  color: var(--ink);
  background: #020617;
  display: flex;
}"""

content = content.replace(old_body, new_body)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Revamped Root Theme")
