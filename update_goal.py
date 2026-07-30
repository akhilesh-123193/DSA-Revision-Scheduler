import re

with open('/home/akhilesh/Downloads/gazette-app-whitenoise/index.html', 'r') as f:
    content = f.read()

# Update goalDialog HTML to include External Progress
old_dialog = '''      <label style="margin-top:12px">Total problems target
        <input id="goalTarget" type="number" min="1" placeholder="e.g., 300" required />
      </label>
      <div class="modal-actions">'''
      
new_dialog = '''      <label style="margin-top:12px">Total problems target
        <input id="goalTarget" type="number" min="1" placeholder="e.g., 250" required />
      </label>
      <label style="margin-top:12px">
        <div style="display:flex; justify-content:space-between">
          <span>External Progress (Already Solved)</span>
          <span style="color:var(--ink-60);font-size:0.8rem">Optional</span>
        </div>
        <input id="goalExternal" type="number" min="0" placeholder="e.g., 88" />
        <p style="font-size:0.75rem; color:var(--ink-60); margin-top:4px;">Problems you solved before using this app that count towards the goal.</p>
      </label>
      <div class="modal-actions">'''

content = content.replace(old_dialog, new_dialog)

with open('/home/akhilesh/Downloads/gazette-app-whitenoise/index.html', 'w') as f:
    f.write(content)
