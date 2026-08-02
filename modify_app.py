import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update saveProblem to include new fields
old_saveProblem = """  function saveProblem(e) {
    e.preventDefault();
    const id = $('#problemForm').dataset.editingId;
    const name = $('#pName').value.trim();
    if (!name) return;

    const data = {
      name,
      url: $('#pUrl').value.trim(),
      topic: $('#pTopic').value.trim() || 'Uncategorized',
      phase: $('#pPhase').value.trim() || 'General',
      difficulty: $('#pDifficulty').value,
      status: $('#pStatus').value,
      notes: $('#pNotes').value.trim(),
      solveDate: $('#pSolveDate').value || todayISO(),
      nextRevDate: $('#pNextRevDate').value || addDaysISO(todayISO(), 1)
    };"""

new_saveProblem = """  function saveProblem(e) {
    e.preventDefault();
    const id = $('#problemForm').dataset.editingId;
    const name = $('#pName').value.trim();
    if (!name) return;

    const data = {
      name,
      url: $('#pUrl').value.trim(),
      topic: $('#pTopic').value.trim() || 'Uncategorized',
      pattern: $('#pPattern').value.trim() || '',
      phase: $('#pPhase').value.trim() || 'General',
      difficulty: $('#pDifficulty').value,
      time: $('#pTime').value.trim() || '',
      space: $('#pSpace').value.trim() || '',
      status: $('#pStatus').value,
      notes: $('#pNotes').value.trim(),
      solveDate: $('#pSolveDate').value || todayISO(),
      nextRevDate: $('#pNextRevDate').value || addDaysISO(todayISO(), 1)
    };"""
content = content.replace(old_saveProblem, new_saveProblem)

# 2. Update openProblemDialog to populate new fields
old_open_dialog = """      $('#pTopic').value = p.topic || '';
      $('#pPhase').value = p.phase || '';
      $('#pDifficulty').value = p.difficulty || 'Medium';
      $('#pStatus').value = p.status || 'Got AC';"""

new_open_dialog = """      $('#pTopic').value = p.topic || '';
      $('#pPattern').value = p.pattern || '';
      $('#pPhase').value = p.phase || '';
      $('#pDifficulty').value = p.difficulty || 'Medium';
      $('#pTime').value = p.time || '';
      $('#pSpace').value = p.space || '';
      $('#pStatus').value = p.status || 'Got AC';"""
content = content.replace(old_open_dialog, new_open_dialog)

old_clear_dialog = """      $('#pTopic').value = '';
      $('#pPhase').value = '';
      $('#pDifficulty').value = 'Medium';
      $('#pStatus').value = 'Got AC';"""

new_clear_dialog = """      $('#pTopic').value = '';
      $('#pPattern').value = '';
      $('#pPhase').value = '';
      $('#pDifficulty').value = 'Medium';
      $('#pTime').value = '';
      $('#pSpace').value = '';
      $('#pStatus').value = 'Got AC';"""
content = content.replace(old_clear_dialog, new_clear_dialog)

# 3. Add to DM Stats Strip (Study Hub Deep Dive)
old_dm_meta = """    $('#dmMeta').innerHTML = `
      <span class="topic-tag">${p.topic}</span>
      <span class="diff-tag ${p.difficulty.toLowerCase()}">${p.difficulty}</span>
      <span class="status-tag ${statusClass}">${p.status}</span>
      ${p.url ? `<a href="${p.url}" target="_blank" class="p-link" style="margin-left:8px;color:var(--primary);text-decoration:none">↗ Link</a>` : ''}
    `;"""

new_dm_meta = """    $('#dmMeta').innerHTML = `
      <span class="topic-tag">${p.topic}</span>
      <span class="diff-tag ${p.difficulty.toLowerCase()}">${p.difficulty}</span>
      <span class="status-tag ${statusClass}">${p.status}</span>
      ${p.url ? `<a href="${p.url}" target="_blank" class="p-link" style="margin-left:8px;color:var(--primary);text-decoration:none">↗ Link</a>` : ''}
    `;
    
    // Custom Analytics Strip for DSA Best Practices
    const statsStrip = $('#dmStatsStrip');
    if (statsStrip) {
      let html = '';
      if (p.pattern) html += `<div class="dm-stat-badge"><strong>Pattern:</strong> ${p.pattern}</div>`;
      if (p.time) html += `<div class="dm-stat-badge"><strong>⏱ Time:</strong> ${p.time}</div>`;
      if (p.space) html += `<div class="dm-stat-badge"><strong>💾 Space:</strong> ${p.space}</div>`;
      
      const reps = p.revisions ? p.revisions.length : 0;
      html += `<div class="dm-stat-badge"><strong>Revisions:</strong> ${reps}</div>`;
      
      statsStrip.innerHTML = html;
      statsStrip.style.display = html ? 'flex' : 'none';
    }
"""
content = content.replace(old_dm_meta, new_dm_meta)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("App updated phase 1.")
