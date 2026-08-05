import os

def update_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update todo form
    old_form = """            <form id="todoForm" class="inline-form">
              <input id="todoInput" type="text" placeholder="Add a task…" autocomplete="off" required />
              <input id="todoDate" type="date" />
              <button class="btn primary" type="submit">Add</button>
            </form>"""
            
    new_form = """            <form id="todoForm" class="inline-form todo-form-grid">
              <input id="todoInput" type="text" placeholder="Add a task…" autocomplete="off" required />
              <select id="todoPriority">
                <option value="normal">Normal</option>
                <option value="high">🔴 High</option>
                <option value="low">🟢 Low</option>
              </select>
              <input id="todoDate" type="date" />
              <button class="btn primary" type="submit">Add</button>
            </form>"""
    
    content = content.replace(old_form, new_form)

    # 2. Add Edit Task Dialog
    dialog_insert = """  <!-- ─── EDIT TASK DIALOG ──────────────────────────────────── -->
  <dialog id="editTaskDialog" class="modal small-modal">
    <div class="section-head center" style="margin-bottom:8px">
      <div><p class="kicker">Desk Orders</p><h2 id="editTaskDialogTitle" style="font-size:1.2rem">Edit Task</h2></div>
    </div>
    <form id="editTaskForm">
      <label>Task title
        <input id="editTaskTitle" type="text" required />
      </label>
      <div class="form-grid" style="margin:12px 0">
        <label>Date
          <input id="editTaskDate" type="date" required />
        </label>
        <label>Priority
          <select id="editTaskPriority">
            <option value="normal">Normal</option>
            <option value="high">🔴 High</option>
            <option value="low">🟢 Low</option>
          </select>
        </label>
      </div>
      <div class="modal-actions">
        <button type="button" id="editTaskCancelBtn" class="btn ghost">Cancel</button>
        <button type="submit" class="btn primary">Save Changes</button>
      </div>
    </form>
  </dialog>"""
  
    content = content.replace('  <!-- ─── COMMAND PALETTE ──────────────────────────────────────── -->', dialog_insert + '\n\n  <!-- ─── COMMAND PALETTE ──────────────────────────────────────── -->')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

update_html('index.html')
