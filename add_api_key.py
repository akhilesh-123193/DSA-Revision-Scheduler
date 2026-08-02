import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_settings = """              <div class="settings-grid">
                <button id="resetBtn" class="btn danger">Reset to Backup</button>
                <label class="file-btn">Import JSON
                  <input id="importInput" type="file" accept="application/json,.json" hidden />
                </label>
                <button id="musicVolDown" class="btn ghost hidden">−</button>
                <button id="musicVolUp" class="btn ghost hidden">+</button>
              </div>"""

new_settings = """              <div class="settings-grid">
                <button id="resetBtn" class="btn danger">Reset to Backup</button>
                <label class="file-btn">Import JSON
                  <input id="importInput" type="file" accept="application/json,.json" hidden />
                </label>
                <button id="musicVolDown" class="btn ghost hidden">−</button>
                <button id="musicVolUp" class="btn ghost hidden">+</button>
              </div>
              <div style="margin-top:16px;">
                <label>Gemini API Key (for AI Grader)
                  <input id="geminiApiKey" type="password" placeholder="AIzaSy..." style="margin-top:4px;width:100%" />
                </label>
                <p style="font-size:0.75rem;color:var(--ink-60);margin-top:4px">Get a free key from Google AI Studio. Stored locally.</p>
              </div>"""

content = content.replace(old_settings, new_settings)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added API Key Input")
