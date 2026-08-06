with open('index.html', 'r') as f:
    content = f.read()

old_str = '<div class="wr-stat"><span class="wr-stat-num" id="wrProblemsTotal">0</span><span class="wr-stat-lbl">problems solved</span></div>'
new_str = '<div class="wr-stat"><span class="wr-stat-num" id="wrProblemsTotal">0</span><span class="wr-stat-lbl">problems solved <span style="opacity:0.7; font-size:0.85em;">(<span id="wrProblemsRemaining">0</span> remaining)</span></span></div>'

if old_str in content:
    content = content.replace(old_str, new_str)
    with open('index.html', 'w') as f:
        f.write(content)
    print("Replaced successfully")
else:
    print("Old string not found")
