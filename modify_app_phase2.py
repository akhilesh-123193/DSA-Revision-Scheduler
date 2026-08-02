import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Blind Spot analysis
old_analytics = """      let html = '';
      topics.forEach(t => {
        html += `<div class="mastery-item">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-weight:600">${t.topic}</span>
            <span style="color:var(--ink-60)">${t.acc}% (${t.solved})</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${t.acc}%;background:${t.acc >= 80 ? 'var(--green)' : t.acc >= 50 ? 'var(--yellow)' : 'var(--red)'}"></div></div>
        </div>`;
      });
      $('#topicMastery').innerHTML = html;
    }

    renderDigest(m);
  }"""

new_analytics = """      let html = '';
      let blindSpotsHtml = '';
      
      topics.forEach(t => {
        html += `<div class="mastery-item">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-weight:600">${t.topic}</span>
            <span style="color:var(--ink-60)">${t.acc}% (${t.solved})</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${t.acc}%;background:${t.acc >= 80 ? 'var(--green)' : t.acc >= 50 ? 'var(--yellow)' : 'var(--red)'}"></div></div>
        </div>`;
        
        // Identify blind spots: Low accuracy OR very few problems solved relative to others
        if (t.acc < 75 || (t.solved < 3 && topics.length > 3)) {
           blindSpotsHtml += `
             <div class="bs-item">
               <div class="bs-topic">${t.topic}</div>
               <div class="bs-stats">
                 <span>${t.acc}% ACC</span>
                 <span>${t.solved} SOLVED</span>
               </div>
             </div>
           `;
        }
      });
      $('#topicMastery').innerHTML = html;
      
      const bsList = $('#blindSpotList');
      if (bsList) {
         if (blindSpotsHtml) {
             bsList.innerHTML = blindSpotsHtml;
         } else {
             bsList.innerHTML = '<div class="empty-state" style="padding:20px;font-size:0.9rem">No blind spots detected! You are mastering everything. 🚀</div>';
         }
      }
    }

    renderDigest(m);
  }"""

content = content.replace(old_analytics, new_analytics)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("App updated phase 2.")
