import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the innerHTML block for bodyEl
old_inner_html = """      bodyEl.innerHTML = `
        <div style="max-width:640px;margin:0 auto;">
          ${recallHtml}
          <div style="background:rgba(255,252,242,0.9);padding:24px;border-radius:16px;border:1px solid var(--border);box-shadow:0 8px 24px rgba(28,21,16,0.06);">
            <h3 style="margin-top:0;font-size:1.15rem;color:var(--ink)">Stamp Revision for ${escapeHTML(p.name)}</h3>"""

new_inner_html = """      bodyEl.innerHTML = `
        <div style="max-width:640px;margin:0 auto;">
          <div id="feynmanPanel" style="margin-bottom:24px;background:#fff;border:2px solid #4f46e5;border-radius:12px;padding:20px;box-shadow:0 8px 24px rgba(79,70,229,0.12);">
            <div style="margin-bottom:16px;">
              <h4 style="margin:0;font-size:1.1rem;color:var(--ink);">🗣️ Feynman Interview Simulator</h4>
              <p style="margin:4px 0 0;font-size:0.8rem;color:var(--ink-60);">If you can't explain it simply, you don't understand it well enough. Type a 2-sentence elevator pitch of your approach before proceeding.</p>
            </div>
            <textarea id="feynmanInput" rows="3" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--border);font-family:inherit;font-size:0.9rem;resize:vertical;margin-bottom:12px;" placeholder="E.g. I will use a sliding window to track the longest valid sequence, expanding the right pointer and shrinking the left when the sum exceeds K. Time is O(N) and space is O(1)."></textarea>
            <button type="button" class="btn primary" id="feynmanSubmitBtn" style="width:100%;background:#4f46e5;color:white;">Lock in Explanation & Proceed</button>
          </div>

          <div id="hiddenRevisionContent" style="display:none;">
            ${recallHtml}
            <div style="background:rgba(255,252,242,0.9);padding:24px;border-radius:16px;border:1px solid var(--border);box-shadow:0 8px 24px rgba(28,21,16,0.06);">
              <h3 style="margin-top:0;font-size:1.15rem;color:var(--ink)">Stamp Revision for ${escapeHTML(p.name)}</h3>"""

content = content.replace(old_inner_html, new_inner_html)

# Add event listener for feynmanSubmitBtn
old_listeners = """      $("#dmReviseForm").addEventListener("submit", (e) => {"""
new_listeners = """      const fInput = $("#feynmanInput");
      const fBtn = $("#feynmanSubmitBtn");
      if (fBtn) {
        fBtn.addEventListener("click", () => {
          if (fInput.value.trim().length < 15) {
            toast("Please type a real explanation (at least 15 characters).", "warn");
            return;
          }
          $("#feynmanPanel").style.opacity = "0.6";
          fInput.disabled = true;
          fBtn.style.display = "none";
          $("#hiddenRevisionContent").style.display = "block";
          toast("Explanation locked! You may now review hints or stamp your revision.", "success");
        });
      }

      $("#dmReviseForm").addEventListener("submit", (e) => {"""

content = content.replace(old_listeners, new_listeners)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Implemented Feynman Simulator")
