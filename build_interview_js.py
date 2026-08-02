import re

with open("app.js", "r") as f:
    js = f.read()

interview_logic = """
      else if (activeDmTab === 'interview') {
        bodyEl.innerHTML = `
          <div class="live-interview-wrapper">
            <div class="interview-editor-panel">
              <div class="interview-header">
                <span>C++ Editor</span>
                <button type="button" id="aiDryRunBtn" style="background:var(--gold);color:#000;border:none;border-radius:4px;padding:2px 8px;font-size:0.8rem;font-weight:bold;cursor:pointer;">Simulate Run</button>
              </div>
              <textarea id="aiCodeEditor">#include <iostream>\\n#include <vector>\\n\\nusing namespace std;\\n\\nint main() {\\n    // Start coding your solution for ${p.name}\\n    return 0;\\n}</textarea>
            </div>
            <div class="interview-chat-panel">
              <div class="interview-header">
                <span>🧠 Live AI Interviewer</span>
              </div>
              <div class="chat-history" id="aiChatHistory">
                <div class="chat-msg ai">Hi Akhilesh. I am your Google interviewer today. We are solving <strong>${p.name}</strong>. Talk me through your brute force approach first.</div>
              </div>
              <div class="chat-controls">
                <div class="chat-input-wrapper">
                  <button type="button" id="aiMicBtn" class="mic-btn" title="Hold or click to speak">🎤</button>
                  <input type="text" id="aiChatInput" placeholder="Type or speak..." />
                </div>
                <button type="button" id="aiSendBtn" class="send-btn">➤</button>
              </div>
            </div>
          </div>
        `;
        
        // Setup CodeMirror
        let cmInstance = null;
        if (typeof CodeMirror !== 'undefined') {
          setTimeout(() => {
            cmInstance = CodeMirror.fromTextArea($("#aiCodeEditor"), {
              lineNumbers: true,
              mode: "text/x-c++src",
              theme: "neo",
              indentUnit: 4,
            });
          }, 50);
        }

        // Chat logic
        const chatHist = $("#aiChatHistory");
        const chatInp = $("#aiChatInput");
        const sendBtn = $("#aiSendBtn");
        const micBtn = $("#aiMicBtn");
        const runBtn = $("#aiDryRunBtn");
        
        let conversation = [
          { role: "user", parts: [{ text: `System context: Act as a strict Google software engineer interviewing the candidate. Problem: ${p.name}. Keep your responses under 3 sentences. Be conversational. Ask follow ups. If they write code, critique it.` }]},
          { role: "model", parts: [{ text: "Understood. I will act as the interviewer." }]}
        ];

        const appendMsg = (text, role) => {
          const div = document.createElement("div");
          div.className = `chat-msg ${role}`;
          div.innerHTML = text.replace(/\\n/g, "<br/>");
          chatHist.append(div);
          chatHist.scrollTop = chatHist.scrollHeight;
        };

        const speakText = (text) => {
          if ('speechSynthesis' in window) {
             window.speechSynthesis.cancel();
             const ut = new SpeechSynthesisUtterance(text);
             ut.rate = 1.05;
             window.speechSynthesis.speak(ut);
          }
        };

        const sendToGemini = async (userText, isCodeRun = false) => {
           appendMsg(userText, "user");
           chatInp.value = "";
           
           const apiKey = state.gamification.geminiKey;
           if (!apiKey) {
              appendMsg("Error: No API key found in Reward Vault settings.", "ai");
              return;
           }

           const codeSnapshot = cmInstance ? cmInstance.getValue() : $("#aiCodeEditor").value;
           let payloadMsg = `Candidate says: "${userText}"\\n\\nCurrent code in their editor:\\n\`\`\`cpp\\n${codeSnapshot}\\n\`\`\``;
           if (isCodeRun) payloadMsg += "\\n\\nThe candidate clicked 'Simulate Run'. Read their code, act as a compiler, and tell them exactly what it outputs or if it has syntax errors.";
           
           conversation.push({ role: "user", parts: [{ text: payloadMsg }] });

           const typingDiv = document.createElement("div");
           typingDiv.className = "chat-msg ai";
           typingDiv.textContent = "...";
           chatHist.append(typingDiv);
           chatHist.scrollTop = chatHist.scrollHeight;

           try {
             const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ contents: conversation })
             });
             const data = await res.json();
             if (data.error) throw new Error(data.error.message);
             
             const aiReply = data.candidates[0].content.parts[0].text;
             conversation.push({ role: "model", parts: [{ text: aiReply }] });
             
             typingDiv.remove();
             appendMsg(aiReply, "ai");
             speakText(aiReply.replace(/[*_`#]/g, ''));
           } catch (err) {
             typingDiv.remove();
             appendMsg(`🚨 API Error: ${err.message}`, "ai");
           }
        };

        sendBtn.addEventListener("click", () => {
           if (chatInp.value.trim()) sendToGemini(chatInp.value.trim());
        });
        chatInp.addEventListener("keydown", (e) => {
           if (e.key === "Enter" && chatInp.value.trim()) sendToGemini(chatInp.value.trim());
        });
        
        runBtn.addEventListener("click", () => {
           sendToGemini("I want to run my code now. What is the output?", true);
        });

        // Speech Recognition
        let recognition = null;
        if ('webkitSpeechRecognition' in window) {
           recognition = new webkitSpeechRecognition();
           recognition.continuous = false;
           recognition.interimResults = true;
           
           recognition.onstart = () => micBtn.classList.add("recording");
           recognition.onend = () => micBtn.classList.remove("recording");
           
           recognition.onresult = (e) => {
             let finalTranscript = '';
             for (let i = e.resultIndex; i < e.results.length; ++i) {
               if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
             }
             if (finalTranscript) {
                chatInp.value = finalTranscript;
                sendToGemini(finalTranscript);
             }
           };
           
           micBtn.addEventListener("click", () => {
              if (micBtn.classList.contains("recording")) recognition.stop();
              else recognition.start();
           });
        } else {
           micBtn.style.display = "none";
        }
      }
"""

if "activeDmTab === 'interview'" not in js:
    # Find the end of the if-else block for activeDmTab
    parts = js.split("else if (activeDmTab === 'revise') {")
    if len(parts) == 2:
        inner_parts = parts[1].split("}\n\n      // Modal Header update")
        if len(inner_parts) >= 2:
            new_js = parts[0] + "else if (activeDmTab === 'revise') {" + inner_parts[0] + "}\n" + interview_logic + "\n      // Modal Header update" + inner_parts[1]
            with open("app.js", "w") as f:
                f.write(new_js)
            print("Successfully injected interview logic into app.js")
        else:
            print("Failed to find 'Modal Header update' marker.")
    else:
        print("Failed to find 'revise' tab marker.")
else:
    print("Interview logic already injected.")

