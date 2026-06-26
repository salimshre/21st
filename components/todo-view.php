<div class="subpanel" id="sub-todos">
  <div class="sec-lbl">Today's To‑Do List</div>
  <div class="card" id="todo-list-container">
    <!-- Toolbar: filter, sort, copy -->
    <div class="todo-toolbar">
      <div class="todo-filters">
        <button class="todo-filter-btn active" data-filter="all">All</button>
        <button class="todo-filter-btn" data-filter="active">Active</button>
        <button class="todo-filter-btn" data-filter="completed">Completed</button>
      </div>
      <div class="todo-sort">
        <label for="todoSort">Sort by:</label>
        <select id="todoSort">
          <option value="order">Order</option>
          <option value="priority">Priority</option>
          <option value="dueDate">Due Date</option>
        </select>
      </div>
      <button class="todo-copy-btn" id="todoCopyYesterday">📋 Copy from yesterday</button>
    </div>

    <!-- List -->
    <div id="todo-list"></div>

    <!-- Add row with priority & due date -->
    <div class="todo-add-row">
      <input type="text" id="todoInput" placeholder="Add a task…" />
      <select id="todoPriority">
        <option value="low">Low</option>
        <option value="medium" selected>Medium</option>
        <option value="high">High</option>
      </select>
      <input type="date" id="todoDueDate" />
      <button type="button" id="todoAddBtn">Add</button>
    </div>
  </div>
</div>