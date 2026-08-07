import sys
import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Look for difficultyFilter select
# and the button after it
pattern = re.compile(r'(<select\s+id="difficultyFilter"[^>]*>.*?</select>)(.*?)(<button\s+id="openProblemForm")', re.DOTALL | re.IGNORECASE)

replacement = r'''\1\2<select id="sortFilter" aria-label="Sort problems">
                <option value="nextRevDate">Sort by Next Revision</option>
                <option value="recentAdd">Sort by Recently Added</option>
              </select>\2\3'''

if pattern.search(content):
    content = pattern.sub(replacement, content)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully updated index.html")
else:
    print("Target string not found in index.html")
    sys.exit(1)
