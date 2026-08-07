import sys

target = """            <div class="toolbar">
              <input id="problemSearch" type="search" placeholder="Search…" aria-label="Search problems" />
              <select id="topicFilter" aria-label="Filter by topic"><option value="">All topics</option></select>
              <select id="difficultyFilter" aria-label="Filter by difficulty"><option value="">All difficulties</option></select>
              <select id="sortFilter" aria-label="Sort problems">
                <option value="nextRevDate">Sort by Next Revision</option>
                <option value="recentAdd">Sort by Recently Added</option>
              </select>
              <select id="sortFilter" aria-label="Sort problems">
                <option value="nextRevDate">Sort by Next Revision</option>
                <option value="recentAdd">Sort by Recently Added</option>
              </select>
              <select id="sortFilter" aria-label="Sort problems">
                <option value="nextRevDate">Sort by Next Revision</option>
                <option value="recentAdd">Sort by Recently Added</option>
              </select>
              <button id="openProblemForm" class="btn primary">+ Add Problem</button>
            </div>"""

replacement = """            <div class="toolbar">
              <input id="problemSearch" type="search" placeholder="Search…" aria-label="Search problems" />
              <select id="topicFilter" aria-label="Filter by topic"><option value="">All topics</option></select>
              <select id="difficultyFilter" aria-label="Filter by difficulty"><option value="">All difficulties</option></select>
              <select id="sortFilter" aria-label="Sort problems">
                <option value="nextRevDate">Sort by Next Revision</option>
                <option value="recentAdd">Sort by Recently Added</option>
              </select>
              <button id="openProblemForm" class="btn primary">+ Add Problem</button>
            </div>"""

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

if target in content:
    content = content.replace(target, replacement)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully updated index.html")
else:
    print("Target string not found in index.html")
    sys.exit(1)
