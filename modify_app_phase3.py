import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_meta = """    metaEl.innerHTML = `
      ${p.topic ? `<span class="dm-badge topic">📂 ${escapeHTML(p.topic)}</span>` : ""}
      ${p.phase ? `<span class="dm-badge phase">${escapeHTML(p.phase)}</span>` : ""}
      ${p.difficulty ? `<span class="dm-badge ${diffClass}">${escapeHTML(p.difficulty)}</span>` : ""}
      ${p.solveDate ? `<span class="dm-badge phase">🗓 Solved ${formatShortDate(p.solveDate)}</span>` : ""}
      <span class="dm-badge phase">⏱ Interval ${p.interval || 1}d</span>
    `;"""

new_meta = """    metaEl.innerHTML = `
      ${p.topic ? `<span class="dm-badge topic">📂 ${escapeHTML(p.topic)}</span>` : ""}
      ${p.pattern ? `<span class="dm-badge topic" style="background:#4f46e5;color:white">🧩 ${escapeHTML(p.pattern)}</span>` : ""}
      ${p.phase ? `<span class="dm-badge phase">${escapeHTML(p.phase)}</span>` : ""}
      ${p.difficulty ? `<span class="dm-badge ${diffClass}">${escapeHTML(p.difficulty)}</span>` : ""}
      ${p.time ? `<span class="dm-badge phase" style="border-color:var(--ink-30)">⏱ ${escapeHTML(p.time)}</span>` : ""}
      ${p.space ? `<span class="dm-badge phase" style="border-color:var(--ink-30)">💾 ${escapeHTML(p.space)}</span>` : ""}
      ${p.solveDate ? `<span class="dm-badge phase">🗓 Solved ${formatShortDate(p.solveDate)}</span>` : ""}
      <span class="dm-badge phase">🔄 Interval ${p.interval || 1}d</span>
    `;"""

content = content.replace(old_meta, new_meta)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("App updated phase 3.")
