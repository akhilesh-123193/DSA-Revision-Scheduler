import re

with open('/home/akhilesh/Downloads/gazette-app-whitenoise/app.js', 'r') as f:
    content = f.read()

# Locate the "revise" tab block
pattern = r'(\} else if \(activeDmTab === "revise"\) \{)(.*?)(const form = \$\("#dmReviseForm"\);)'
match = re.search(pattern, content, re.DOTALL)

if match:
    prefix = match.group(1)
    existing_body = match.group(2)
    suffix = match.group(3)
    
    # We want to inject the Active Recall UI before the revision form.
    # The revision form is wrapped in a div. Let's rebuild the innerHTML.
    
    new_ui = """
      const cfftd = p.cfftd || {};
      const cfftdFields = [
        { key: "f1", label: "First Thought / Intuition", icon: "💭" },
        { key: "c", label: "Core Concept", icon: "🧠" },
        { key: "t", label: "Technique", icon: "🛠️" },
        { key: "d", label: "Debugging / Gotchas", icon: "🐞" }
      ].filter(f => cfftd[f.key] && cfftd[f.key].trim());

      let recallHtml = '';
      if (cfftdFields.length > 0 || (cfftd.notes && cfftd.notes.trim())) {
        recallHtml = `
          <div class="active-recall-panel" style="margin-bottom:24px;background:var(--cream-3);border:2px solid var(--gold);border-radius:12px;padding:20px;box-shadow:0 8px 24px rgba(196,154,39,0.12);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <div>
                <h4 style="margin:0;font-size:1.1rem;color:var(--ink);">Active Recall Safety Net</h4>
                <p style="margin:4px 0 0;font-size:0.8rem;color:var(--ink-60);">Blanking out? Reveal hints progressively instead of looking at the full solution.</p>
              </div>
            </div>
            <div style="display:grid;gap:12px;">
              ${cfftdFields.map((f, i) => `
                <div class="recall-item" style="background:#fff;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
                  <button type="button" class="recall-reveal-btn" style="width:100%;text-align:left;padding:12px 16px;background:rgba(196,154,39,0.05);border:none;border-bottom:1px solid transparent;cursor:pointer;display:flex;align-items:center;gap:10px;font-weight:700;color:var(--ink);transition:all 0.2s;" onclick="this.nextElementSibling.classList.toggle('hidden');this.style.borderBottomColor='var(--border)';this.style.background='#fff';">
                    <span style="font-size:1.2rem;">${f.icon}</span> 
                    Reveal Hint ${i+1}: ${f.label}
                  </button>
                  <div class="recall-content hidden" style="padding:16px;background:#fff;font-size:0.9rem;border-top:1px solid var(--border);">
                    <div class="notes-rich">${renderRichNotes(cfftd[f.key])}</div>
                  </div>
                </div>
              `).join('')}
              
              ${(cfftd.notes && cfftd.notes.trim()) ? `
                <div class="recall-item" style="background:#fff;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
                  <button type="button" class="recall-reveal-btn" style="width:100%;text-align:left;padding:12px 16px;background:rgba(156,47,42,0.05);border:none;cursor:pointer;display:flex;align-items:center;gap:10px;font-weight:700;color:var(--red);transition:all 0.2s;" onclick="this.nextElementSibling.classList.toggle('hidden');this.style.borderBottomColor='var(--border)';this.style.background='#fff';">
                    <span style="font-size:1.2rem;">🚨</span> 
                    Reveal Full Study Notes (Last Resort)
                  </button>
                  <div class="recall-content hidden" style="padding:16px;background:#fff;font-size:0.9rem;border-top:1px solid var(--border);">
                    <div class="notes-rich">${renderRichNotes(cfftd.notes)}</div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      } else {
        recallHtml = `
          <div class="active-recall-panel" style="margin-bottom:24px;background:var(--cream-3);border:1px dashed var(--ink-25);border-radius:12px;padding:20px;text-align:center;">
            <p style="margin:0;font-size:0.9rem;color:var(--ink-60);">No study notes or hints exist for this problem yet. Add them below after your revision so your future self has a safety net!</p>
          </div>
        `;
      }

      bodyEl.innerHTML = `
        <div style="max-width:640px;margin:0 auto;">
          ${recallHtml}
          <div style="background:rgba(255,252,242,0.9);padding:24px;border-radius:16px;border:1px solid var(--border);box-shadow:0 8px 24px rgba(28,21,16,0.06);">
            <h3 style="margin-top:0;font-size:1.15rem;color:var(--ink)">Stamp Revision for ${escapeHTML(p.name)}</h3>
            <p style="font-size:0.85rem;color:var(--ink-60);margin-bottom:18px;">Select how confident you felt solving this problem. The revision engine adapts your future study schedule based on your honest feedback.</p>
            <form id="dmReviseForm">
              <div style="margin-bottom:20px;">
                <strong style="display:block;margin-bottom:12px;color:var(--ink);font-size:0.9rem;">Revision Outcome &amp; Confidence Level</strong>
                <div style="display:grid;gap:12px;">
                  
                  <label class="rev-outcome-card" style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:flex-start;padding:16px;background:rgba(255,255,255,0.75);border:2px solid var(--green);border-radius:12px;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(40,113,79,0.06);">
                    <input type="radio" name="dmRevOutcome" value="ac" checked style="margin-top:3px;cursor:pointer;accent-color:var(--green);width:18px;height:18px;">
                    <div>
                      <div style="font-weight:800;color:var(--ink);font-size:0.95rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span>🟢 Understood (Confident Solve)</span>
                        <span style="font-size:0.75rem;background:rgba(40,113,79,0.15);color:var(--green);padding:2px 8px;border-radius:12px;margin-left:auto;">+8 Coins</span>
                      </div>
                      <div style="font-size:0.82rem;color:var(--ink-60);margin-top:6px;line-height:1.4;">
                        <strong style="color:var(--ink);">When to select:</strong> You solved the problem cleanly on your own without hints or notes.<br>
                        <strong style="color:var(--ink);">What it does:</strong> Advances this problem up to the next Spaced Repetition Rung (<strong style="color:var(--green);">1d → 3d → 7d → 30d → 90d</strong>).
                      </div>
                    </div>
                  </label>
  
                  <label class="rev-outcome-card" style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:flex-start;padding:16px;background:rgba(255,255,255,0.75);border:2px solid var(--gold);border-radius:12px;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(196,154,39,0.06);">
                    <input type="radio" name="dmRevOutcome" value="hints" style="margin-top:3px;cursor:pointer;accent-color:var(--gold);width:18px;height:18px;">
                    <div>
                      <div style="font-weight:800;color:var(--ink);font-size:0.95rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span>🟡 Not Confident (Shaky / Needed Hints)</span>
                        <span style="font-size:0.75rem;background:rgba(196,154,39,0.2);color:#9c7814;padding:2px 8px;border-radius:12px;margin-left:auto;">+4 Coins</span>
                      </div>
                      <div style="font-size:0.82rem;color:var(--ink-60);margin-top:6px;line-height:1.4;">
                        <strong style="color:var(--ink);">When to select:</strong> You got stuck, looked at hints/notes, or felt shaky about your logic.<br>
                        <strong style="color:var(--ink);">What it does:</strong> Keeps it on a shorter review leash (<strong style="color:#9c7814;">capped at 7 days max</strong>) so you review it again soon without pushing it out to 30 or 90 days.
                      </div>
                    </div>
                  </label>
  
                  <label class="rev-outcome-card" style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:flex-start;padding:16px;background:rgba(255,255,255,0.75);border:2px solid var(--red);border-radius:12px;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(156,47,42,0.06);">
                    <input type="radio" name="dmRevOutcome" value="failed" style="margin-top:3px;cursor:pointer;accent-color:var(--red);width:18px;height:18px;">
                    <div>
                      <div style="font-weight:800;color:var(--ink);font-size:0.95rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span>🔴 Completely Forgot / Failed</span>
                        <span style="font-size:0.75rem;background:rgba(156,47,42,0.15);color:var(--red);padding:2px 8px;border-radius:12px;margin-left:auto;">+1 Coin</span>
                      </div>
                      <div style="font-size:0.82rem;color:var(--ink-60);margin-top:6px;line-height:1.4;">
                        <strong style="color:var(--ink);">When to select:</strong> You completely blanked out or couldn't solve it at all.<br>
                        <strong style="color:var(--ink);">What it does:</strong> Resets the interval back to <strong style="color:var(--red);">1 day</strong> so it appears on your desk tomorrow.
                      </div>
                    </div>
                  </label>
  
                </div>
              </div>
              <label style="display:block;margin-bottom:12px">
                <strong>Mistakes &amp; Observations</strong>
                <textarea id="dmRevMistakes" rows="3" class="wide-input notes-textarea" placeholder="What tripped you up?"></textarea>
              </label>
              <label style="display:block;margin-bottom:16px">
                <strong>CFFTD Note Update</strong>
                <textarea id="dmRevNotes" rows="4" class="wide-input notes-textarea" placeholder="Note for future self..."></textarea>
              </label>
              <button class="btn primary" type="submit" style="width:100%;padding:14px;font-size:1rem;font-weight:800;box-shadow:0 4px 14px rgba(196,154,39,0.3);">Submit Revision &amp; Claim Coins</button>
            </form>
          </div>
        </div>
      `;
"""
    
    new_content = content[:match.start()] + prefix + "\n" + new_ui + "\n      " + suffix + content[match.end():]
    
    with open('/home/akhilesh/Downloads/gazette-app-whitenoise/app.js', 'w') as f:
        f.write(new_content)
    print("Successfully updated app.js with Progressive Recall UI")
else:
    print("Could not find the block to replace")
