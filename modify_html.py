import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add fields to Problem form
old_form = """      <div class="form-grid">
        <label>Problem name <input id="pName" required autocomplete="off" /></label>
        <label>Link (optional) <input id="pUrl" type="url" placeholder="https://…" /></label>
        <label>Topic <input id="pTopic" value="Binary Search" /></label>
        <label>Phase <input id="pPhase" value="Phase 2" /></label>
        <label>Difficulty
          <select id="pDifficulty">
            <option>Easy</option><option selected>Medium</option><option>Hard</option>
          </select>
        </label>
        <label>Status
          <select id="pStatus">
            <option>Got AC</option><option>Needs Revision</option><option>Stuck</option>
          </select>
        </label>
        <label>Solve date <input id="pSolveDate" type="date" /></label>
        <label>First revision date <input id="pNextRevDate" type="date" /></label>
      </div>"""

new_form = """      <div class="form-grid">
        <label>Problem name <input id="pName" required autocomplete="off" /></label>
        <label>Link (optional) <input id="pUrl" type="url" placeholder="https://…" /></label>
        <label>Topic <input id="pTopic" value="Binary Search" /></label>
        <label>Pattern / Technique <input id="pPattern" placeholder="e.g. Sliding Window" /></label>
        <label>Phase <input id="pPhase" value="Phase 2" /></label>
        <label>Difficulty
          <select id="pDifficulty">
            <option>Easy</option><option selected>Medium</option><option>Hard</option>
          </select>
        </label>
        <label>Time Complexity <input id="pTime" placeholder="O(N)" /></label>
        <label>Space Complexity <input id="pSpace" placeholder="O(1)" /></label>
        <label>Status
          <select id="pStatus">
            <option>Got AC</option><option>Needs Revision</option><option>Stuck</option>
          </select>
        </label>
        <label>Solve date <input id="pSolveDate" type="date" /></label>
        <label>First revision date <input id="pNextRevDate" type="date" /></label>
      </div>"""

content = content.replace(old_form, new_form)

# 2. Add Timer widget before toast
timer_html = """  <!-- ─── FOCUS TIMER WIDGET ──────────────────────────────────────── -->
  <div id="focusTimerWidget" class="focus-timer-widget">
    <div class="ft-header">
      <span class="ft-title">⏱ Timebox</span>
      <button type="button" class="ft-toggle-btn" id="ftToggleBtn">_</button>
    </div>
    <div class="ft-body" id="ftBody">
      <div class="ft-display" id="ftDisplay">25:00</div>
      <div class="ft-controls">
        <button type="button" class="btn primary small" id="ftStartBtn">Start</button>
        <button type="button" class="btn ghost small" id="ftPauseBtn">Pause</button>
        <button type="button" class="btn danger small" id="ftResetBtn">Reset</button>
      </div>
      <div class="ft-modes">
        <button type="button" class="ft-mode active" data-time="25">25m</button>
        <button type="button" class="ft-mode" data-time="5">5m Break</button>
        <button type="button" class="ft-mode" data-time="45">45m Deep</button>
      </div>
    </div>
  </div>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>"""

content = content.replace('  <div id="toast" class="toast" role="status" aria-live="polite"></div>', timer_html)

# 3. Add Blind Spot radar in Analytics
old_analytics = """        <div class="analytics-block">
          <h3>Topic Mastery</h3>
          <div id="topicMastery" class="mastery-grid"></div>
        </div>"""

new_analytics = """        <div class="analytics-block">
          <h3>Topic Mastery</h3>
          <div id="topicMastery" class="mastery-grid"></div>
        </div>
        <div class="analytics-block" style="margin-top:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <h3>⚠️ Blind Spot Radar</h3>
            <span style="font-size:0.8rem;color:var(--ink-60);">Topics with < 75% accuracy</span>
          </div>
          <div id="blindSpotList" class="blind-spot-list">
             <div class="empty-state" style="padding:20px;font-size:0.9rem">Solving more problems unlocks radar...</div>
          </div>
        </div>"""

content = content.replace(old_analytics, new_analytics)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done.")
