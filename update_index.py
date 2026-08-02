import re

with open('/home/akhilesh/Downloads/gazette-app-whitenoise/index.html', 'r') as f:
    content = f.read()

old_str = """        <div style="display:flex; justify-content:space-between">
          <span>External Progress (Already Solved)</span>
          <span style="color:var(--ink-60);font-size:0.8rem">Optional</span>
        </div>
        <input id="goalExternal" type="number" min="0" placeholder="e.g., 88" />
        <p style="font-size:0.75rem; color:var(--ink-60); margin-top:4px;">Problems you solved before using this app that count towards the goal.</p>"""

new_str = """        <div style="display:flex; justify-content:space-between">
          <span>Total problems solved (e.g., on Algozenith)</span>
          <span style="color:var(--ink-60);font-size:0.8rem">Optional</span>
        </div>
        <input id="goalExternal" type="number" min="0" placeholder="e.g., 102" />
        <p style="font-size:0.75rem; color:var(--ink-60); margin-top:4px;">Enter your total solved count. The app will automatically sync this number whenever you log new problems here.</p>"""

content = content.replace(old_str, new_str)

with open('/home/akhilesh/Downloads/gazette-app-whitenoise/index.html', 'w') as f:
    f.write(content)
