import re

with open('styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update variables to add premium shadows and slightly refine colors
old_root = r":root \{[\s\S]*?--border:  rgba\(28,21,16,\.14\);\n\}"
new_root = """:root {
  /* Premium Paper Palette */
  --cream:   #f7f3ea; /* Lighter, more premium cream */
  --cream-2: #efebe1;
  --cream-3: #ffffff; /* pure white for contrast cards */
  --ink:     #1a1614; /* slightly softer black */
  --ink-60:  rgba(26,22,20,.65);
  --ink-25:  rgba(26,22,20,.25);
  --ink-10:  rgba(26,22,20,.08);

  /* Sidebar */
  --sidebar-bg:   #191512;
  --sidebar-line: rgba(255,255,255,.08);
  --sidebar-w:    260px;

  /* Accent colours - Deeper, more editorial */
  --gold:    #b58900;
  --gold-bg: rgba(181,137,0,.12);
  --red:     #cb4b16;
  --red-bg:  rgba(203,75,22,.10);
  --green:   #2aa198;
  --green-bg:rgba(42,161,152,.11);
  --blue:    #268bd2;
  --blue-bg: rgba(38,139,210,.10);

  /* Misc */
  --radius:  12px;
  --rad-sm:  8px;
  --fast:    200ms cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Modern layered shadow */
  --shadow:  0 4px 6px -1px rgba(26,22,20,0.05), 0 2px 4px -1px rgba(26,22,20,0.03);
  --shadow-hover: 0 10px 15px -3px rgba(26,22,20,0.08), 0 4px 6px -2px rgba(26,22,20,0.04);
  
  --panel-bg: rgba(255,255,255,0.85); /* Slightly transparent for texture bleed */
  --border:  rgba(26,22,20,.12);
}"""

content = re.sub(old_root, new_root, content)

# 2. Update Typography
old_body = """body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 15px;
  color: var(--ink);
  background: var(--ink);
  display: flex;
}"""

new_body = """@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap');

body {
  font-family: 'Lora', Georgia, serif;
  font-size: 15.5px;
  line-height: 1.6;
  color: var(--ink);
  background: var(--ink);
  display: flex;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, .kicker, .edition-stamp, .btn, .topic-tag, .diff-tag, .status-tag, input, select, button, .stat-pill span {
  font-family: 'Inter', system-ui, sans-serif;
}
"""
content = content.replace(old_body, new_body)

# 3. Add paper texture to app-shell
old_shell = """.app-shell {
  flex: 1;
  background: var(--cream);
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
}"""

new_shell = """.app-shell {
  flex: 1;
  background-color: var(--cream);
  /* SVG Noise Texture for Paper feel */
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.04'/%3E%3C/svg%3E");
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
}"""
content = content.replace(old_shell, new_shell)

# 4. Enhance button hovers
old_btn = """  transition: all var(--fast);
}
.btn:hover { background: var(--border); }"""

new_btn = """  transition: all var(--fast);
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.btn:hover { 
  background: var(--border); 
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}
.btn:active {
  transform: translateY(0);
  box-shadow: none;
}"""
content = content.replace(old_btn, new_btn)

# 5. Fix form inputs to look cleaner
old_input = """input, select, textarea {
  width: 100%;
  font-family: inherit;
  font-size: 1rem;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--rad-sm);
  background: var(--surface);
  color: var(--ink);
  transition: border-color var(--fast);
}"""

new_input = """input, select, textarea {
  width: 100%;
  font-family: 'Inter', sans-serif;
  font-size: 0.95rem;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--rad-sm);
  background: var(--cream-3);
  color: var(--ink);
  transition: all var(--fast);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
}
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--gold);
  box-shadow: 0 0 0 3px var(--gold-bg);
}"""
content = content.replace(old_input, new_input)


with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Refined Newspaper Theme")
