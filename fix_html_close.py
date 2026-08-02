import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to find the end of bodyEl.innerHTML in the revise tab.
old_close = """            </form>
          </div>
        </div>
      `;"""

new_close = """            </form>
          </div>
          </div> <!-- Close hiddenRevisionContent -->
        </div>
      `;"""

# We only want to replace the first occurrence that comes after 'id="hiddenRevisionContent"'
# A safer way is to just do string replacement if there's only one.
content = content.replace(old_close, new_close)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed HTML closing tag.")
