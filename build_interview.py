import re
import os

print("Applying changes to index.html...")
with open("index.html", "r") as f:
    html = f.read()

# 1. Add CodeMirror to Head
cm_tags = """  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/theme/neo.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/clike/clike.min.js"></script>
"""
if "codemirror" not in html:
    html = html.replace('</head>', cm_tags + '</head>')

# 2. Add Tab
tab_str = '<button type="button" class="dm-tab" data-dm-tab="interview">🎙️ AI Interview</button>'
if "data-dm-tab=\"interview\"" not in html:
    html = html.replace('<button type="button" class="dm-tab" data-dm-tab="revise">✍️ Quick Revise</button>', 
                        '<button type="button" class="dm-tab" data-dm-tab="revise">✍️ Quick Revise</button>\n        ' + tab_str)

with open("index.html", "w") as f:
    f.write(html)

print("Applying changes to styles.css...")
with open("styles.css", "r") as f:
    css = f.read()

interview_css = """
/* Live Interview UI */
.live-interview-wrapper { display: flex; gap: 16px; height: 60vh; min-height: 500px; margin-top: 16px; }
.interview-editor-panel { flex: 3; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.interview-chat-panel { flex: 2; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 8px; background: var(--cream-2); position: relative; }
.interview-header { background: var(--ink); color: var(--cream-3); padding: 8px 12px; font-weight: bold; font-family: 'Inter', sans-serif; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;}
.CodeMirror { flex: 1; font-family: 'Fira Code', 'Courier New', monospace !important; font-size: 14px; height: 100%; }

.chat-history { flex: 1; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.chat-msg { max-width: 85%; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; line-height: 1.4; word-wrap: break-word; }
.chat-msg.user { align-self: flex-end; background: var(--gold); color: #000; border-bottom-right-radius: 0; }
.chat-msg.ai { align-self: flex-start; background: #fff; border: 1px solid var(--border); color: var(--ink); border-bottom-left-radius: 0; }

.chat-controls { padding: 12px; border-top: 1px solid var(--border); background: #fff; display: flex; gap: 8px; align-items: center; }
.chat-input-wrapper { flex: 1; display: flex; align-items: center; background: var(--cream-3); border: 1px solid var(--border); border-radius: 20px; padding: 4px 12px; }
.chat-input-wrapper input { border: none; background: transparent; width: 100%; padding: 8px 0; outline: none; font-size: 0.9rem; }
.mic-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--ink-60); transition: all 0.2s; }
.mic-btn.recording { color: var(--red); animation: pulse 1.5s infinite; }
.send-btn { background: var(--ink); color: #fff; border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; }

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
"""
if ".live-interview-wrapper" not in css:
    with open("styles.css", "a") as f:
        f.write("\n" + interview_css)

print("Files modified.")
