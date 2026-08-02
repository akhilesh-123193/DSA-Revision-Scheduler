import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_code = """      const form = $("#dmReviseForm");
      if (form) {"""

new_code = """      const fInput = $("#feynmanInput");
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

      const form = $("#dmReviseForm");
      if (form) {"""

content = content.replace(old_code, new_code)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed event listener.")
