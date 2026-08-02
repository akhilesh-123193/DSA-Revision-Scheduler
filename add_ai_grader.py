import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add feynmanFeedback div to HTML template
old_html = """            <textarea id="feynmanInput" rows="3" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--border);font-family:inherit;font-size:0.9rem;resize:vertical;margin-bottom:12px;" placeholder="E.g. I will use a sliding window to track the longest valid sequence, expanding the right pointer and shrinking the left when the sum exceeds K. Time is O(N) and space is O(1)."></textarea>
            <button type="button" class="btn primary" id="feynmanSubmitBtn" style="width:100%;background:#4f46e5;color:white;">Lock in Explanation & Proceed</button>"""

new_html = """            <textarea id="feynmanInput" rows="3" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--border);font-family:inherit;font-size:0.9rem;resize:vertical;margin-bottom:12px;" placeholder="E.g. I will use a sliding window to track the longest valid sequence, expanding the right pointer and shrinking the left when the sum exceeds K. Time is O(N) and space is O(1)."></textarea>
            <div id="feynmanFeedback" style="display:none;margin-bottom:12px;padding:12px;border-radius:8px;background:rgba(79,70,229,0.05);border:1px solid #4f46e5;font-size:0.9rem;line-height:1.4;"></div>
            <button type="button" class="btn primary" id="feynmanSubmitBtn" style="width:100%;background:#4f46e5;color:white;">Lock in Explanation & Proceed</button>"""
content = content.replace(old_html, new_html)

# 2. Update fBtn event listener logic
old_js = """      const fInput = $("#feynmanInput");
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
      }"""

new_js = """      const fInput = $("#feynmanInput");
      const fBtn = $("#feynmanSubmitBtn");
      const fFeedback = $("#feynmanFeedback");
      if (fBtn) {
        fBtn.addEventListener("click", async () => {
          if (fInput.value.trim().length < 15) {
            toast("Please type a real explanation (at least 15 characters).", "warn");
            return;
          }
          
          fBtn.disabled = true;
          const apiKey = state.gamification.geminiKey;
          
          if (apiKey) {
            fBtn.textContent = "🧠 AI Interviewer is grading your pitch...";
            try {
              const notesContent = (p.cfftd && Object.values(p.cfftd).join(' ')) || p.notes || "No notes available.";
              const prompt = `You are a strict Data Structures & Algorithms (DSA) technical interviewer. 
The candidate is solving the problem '${p.name}' (Topic: ${p.topic}). 
Your canonical solution notes are: ${notesContent}.

The candidate provided the following explanation/elevator pitch:
"${fInput.value}"

Grade their explanation out of 10 based on accuracy, mentioning of correct data structures/algorithms, and time/space complexity if applicable. 
Respond EXACTLY in this format, with no markdown formatting around the output, just raw text:
SCORE: X/10
FEEDBACK: [1-2 sentences of direct, actionable feedback. Point out if they missed complexity.]`;

              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }]
                })
              });
              
              const data = await res.json();
              if (data.error) throw new Error(data.error.message);
              
              const text = data.candidates[0].content.parts[0].text;
              
              fFeedback.innerHTML = `<strong style="color:var(--ink)">🤖 AI Interviewer Feedback:</strong><br/>${text.replace(/\\n/g, '<br/>')}`;
              fFeedback.style.display = "block";
              toast("Graded by AI!", "success");
            } catch (err) {
              console.error(err);
              toast("AI Grading failed. Proceeding manually.", "warn");
            }
          } else {
             toast("Explanation locked! (Add a Gemini API key in settings for AI grading).", "success");
          }
          
          $("#feynmanPanel").style.opacity = "0.8";
          fInput.disabled = true;
          fBtn.style.display = "none";
          $("#hiddenRevisionContent").style.display = "block";
        });
      }"""
content = content.replace(old_js, new_js)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added AI Grader logic to Study Hub")
