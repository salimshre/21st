/* ============================================================
   todos.js – Daily To‑Do list with full feature set
   ============================================================ */

App.Todos = (function(){
  "use strict";
  var U = App.Util;

  // ----- State -----
  var filterMode = 'all';       // 'all', 'active', 'completed'
  var sortMode = 'order';      // 'order', 'priority', 'dueDate'
  var undoStack = [];
  var MAX_UNDO = 10;

  // ----- Helper: format due date -----
  function formatDueDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    var today = new Date();
    today.setHours(0,0,0,0);
    var tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    var isToday = d.getTime() === today.getTime();
    var isTomorrow = d.getTime() === tomorrow.getTime();
    var isYesterday = d.getTime() === yesterday.getTime();
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    if (isYesterday) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function isPastDue(dateStr) {
    if (!dateStr) return false;
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    var today = new Date();
    today.setHours(0,0,0,0);
    return d.getTime() < today.getTime();
  }

  // ----- Render the list -----
  function renderTodos() {
    var container = document.getElementById("todo-list");
    if (!container) return;

    var d = App.Storage.getDay(App.curKey);
    var todos = d.todos || [];

    // Filter
    var filtered = todos;
    if (filterMode === 'active') filtered = filtered.filter(function(t){ return !t.done; });
    else if (filterMode === 'completed') filtered = filtered.filter(function(t){ return t.done; });

    // Sort
    if (sortMode === 'priority') {
      var priorityOrder = { high: 0, medium: 1, low: 2 };
      filtered.sort(function(a, b){
        return (priorityOrder[a.priority || 'medium'] || 1) - (priorityOrder[b.priority || 'medium'] || 1);
      });
    } else if (sortMode === 'dueDate') {
      filtered.sort(function(a, b){
        var da = a.dueDate ? new Date(a.dueDate + 'T00:00:00') : new Date(8640000000000000);
        var db = b.dueDate ? new Date(b.dueDate + 'T00:00:00') : new Date(8640000000000000);
        return da - db;
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="challenge-empty">No tasks match the current filter.</div>';
    } else {
      var html = '<div class="todo-items" id="todoItems">';
      filtered.forEach(function(t, idx) {
        var doneClass = t.done ? 'done' : '';
        var priorityClass = t.priority ? 'priority-' + t.priority : '';
        var dueText = formatDueDate(t.dueDate);
        var dueClass = 'todo-due';
        if (isPastDue(t.dueDate) && !t.done) dueClass += ' overdue';
        var dueHtml = dueText ? '<span class="' + dueClass + '">' + U.escapeHtml(dueText) + '</span>' : '';
        html +=
          '<div class="todo-row" draggable="true" data-id="' + t.id + '" data-index="' + idx + '" tabindex="0">' +
            '<span class="todo-drag-handle" title="Drag to reorder">≡</span>' +
            '<input type="checkbox" class="todo-check" data-id="' + t.id + '" ' + (t.done ? 'checked' : '') + '>' +
            '<span class="todo-text ' + doneClass + ' ' + priorityClass + '">' + U.escapeHtml(t.text) + '</span>' +
            dueHtml +
            '<button class="todo-delete" data-id="' + t.id + '" aria-label="Delete task">✕</button>' +
          '</div>';
      });
      html += '</div>';
      html += '<div class="todo-actions">' +
                '<button class="todo-bulk complete-all">Complete all</button>' +
                '<button class="todo-bulk delete-completed">Delete completed</button>' +
                '<button class="todo-clear-all danger">Clear all</button>' +
              '</div>';
      container.innerHTML = html;
      bindDragDrop();
    }
    updateTodoStats();
    updateHeaderTodoSummary();
    updateFilterButtons();
  }

  // ----- Update stat card and header summary -----
  function updateTodoStats() {
    var d = App.Storage.getDay(App.curKey);
    var todos = d.todos || [];
    var done = todos.filter(function(t){ return t.done; }).length;
    var total = todos.length;
    var el = document.getElementById("sTodos");
    if (el) el.textContent = done + '/' + total;
  }

  function updateHeaderTodoSummary() {
    var d = App.Storage.getDay(App.curKey);
    var todos = d.todos || [];
    var done = todos.filter(function(t){ return t.done; }).length;
    var total = todos.length;
    var el = document.getElementById("hdrTodos");
    if (el) el.textContent = done + '/' + total;
  }

  function updateFilterButtons() {
    document.querySelectorAll('.todo-filter-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.filter === filterMode);
    });
  }

  // ----- Event wiring (delegation) -----
  function bindEvents() {
    var container = document.getElementById("todo-list");
    if (!container) return;

    // Toggle checkbox
    container.addEventListener('change', function(e) {
      var check = e.target.closest('.todo-check');
      if (check) toggleTodo(check.dataset.id);
    });

    // Delete button
    container.addEventListener('click', function(e) {
      var del = e.target.closest('.todo-delete');
      if (del) {
        e.preventDefault();
        deleteTodo(del.dataset.id);
        return;
      }
      var clear = e.target.closest('.todo-clear-all');
      if (clear) {
        e.preventDefault();
        clearTodos();
        return;
      }
      var completeAll = e.target.closest('.complete-all');
      if (completeAll) {
        e.preventDefault();
        completeAllTodos();
        return;
      }
      var deleteCompleted = e.target.closest('.delete-completed');
      if (deleteCompleted) {
        e.preventDefault();
        deleteCompletedTodos();
        return;
      }
    });

    // Add task
    var input = document.getElementById("todoInput");
    var addBtn = document.getElementById("todoAddBtn");
    var prioritySelect = document.getElementById("todoPriority");
    var dueDateInput = document.getElementById("todoDueDate");
    if (input && addBtn) {
      addBtn.addEventListener('click', function() {
        addTodo(input.value, prioritySelect ? prioritySelect.value : 'medium', dueDateInput ? dueDateInput.value : '');
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || (e.ctrlKey && e.key === 'Enter')) {
          addTodo(input.value, prioritySelect ? prioritySelect.value : 'medium', dueDateInput ? dueDateInput.value : '');
          e.preventDefault();
        }
      });
    }

    // Filter buttons
    document.querySelectorAll('.todo-filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        filterMode = this.dataset.filter;
        renderTodos();
      });
    });

    // Sort dropdown
    var sortSelect = document.getElementById("todoSort");
    if (sortSelect) {
      sortSelect.addEventListener('change', function() {
        sortMode = this.value;
        renderTodos();
      });
    }

    // Copy from yesterday
    var copyBtn = document.getElementById("todoCopyYesterday");
    if (copyBtn) {
      copyBtn.addEventListener('click', copyFromYesterday);
    }

    // Keyboard shortcuts on the todo container
    container.addEventListener('keydown', function(e) {
      var target = e.target.closest('.todo-row');
      if (!target) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        var id = target.dataset.id;
        if (id) deleteTodo(id);
      }
    });
  }

  // ----- Drag‑and‑drop reordering -----
  function bindDragDrop() {
    var items = document.querySelectorAll('.todo-row');
    var dragSrcIndex = null;

    items.forEach(function(item) {
      item.addEventListener('dragstart', function(e) {
        dragSrcIndex = parseInt(this.dataset.index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.id);
      });
      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      item.addEventListener('drop', function(e) {
        e.preventDefault();
        var targetIndex = parseInt(this.dataset.index);
        if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
          reorderTodos(dragSrcIndex, targetIndex);
        }
        dragSrcIndex = null;
      });
      var handle = item.querySelector('.todo-drag-handle');
      if (handle) {
        handle.addEventListener('mousedown', function(e) { e.preventDefault(); });
      }
    });
  }

  // ----- Data mutations (auto‑save) -----
  function getTodos() {
    var d = App.Storage.getDay(App.curKey);
    return d.todos || [];
  }

  function setTodos(todos, pushUndo) {
    if (pushUndo !== false) {
      undoStack.push(JSON.stringify(todos));
      if (undoStack.length > MAX_UNDO) undoStack.shift();
    }
    App.Storage.mutateDay(App.curKey, function(d) {
      d.todos = todos;
    });
    renderTodos();
  }

  function addTodo(text, priority, dueDate) {
    text = text.trim();
    if (!text) return;
    var todos = getTodos();
    var newTodo = {
      id: U.uid(),
      text: text,
      done: false,
      priority: priority || 'medium',
      dueDate: dueDate || ''
    };
    todos.push(newTodo);
    setTodos(todos);
    var input = document.getElementById("todoInput");
    if (input) input.value = '';
    var dueInput = document.getElementById("todoDueDate");
    if (dueInput) dueInput.value = '';
    U.showToast('Task added', 1500, 'success');
  }

  function toggleTodo(id) {
    var todos = getTodos();
    var found = false;
    todos = todos.map(function(t) {
      if (t.id === id) { t.done = !t.done; found = true; }
      return t;
    });
    if (found) setTodos(todos);
  }

  function deleteTodo(id) {
    var todos = getTodos();
    var removed = todos.filter(function(t) { return t.id === id; })[0];
    var newTodos = todos.filter(function(t) { return t.id !== id; });
    if (newTodos.length !== todos.length) {
      var index = todos.indexOf(removed);
      undoStack.push({ type: 'delete', id: id, item: removed, index: index });
      setTodos(newTodos, false);
      showUndoToast('Task deleted', function() {
        undoDelete(id);
      });
    }
  }

  function undoDelete(id) {
    var todos = getTodos();
    var found = false;
    for (var i = undoStack.length - 1; i >= 0; i--) {
      var action = undoStack[i];
      if (action && action.type === 'delete' && action.id === id) {
        var item = action.item;
        var idx = action.index;
        todos.splice(idx, 0, item);
        undoStack.splice(i, 1);
        setTodos(todos, false);
        found = true;
        U.showToast('Undo successful', 1500, 'success');
        break;
      }
    }
    if (!found) U.showToast('Nothing to undo', 1500, 'warning');
  }

  function clearTodos() {
    if (!confirm('Remove all tasks for today?')) return;
    var todos = getTodos();
    if (todos.length === 0) return;
    undoStack.push({ type: 'clear', items: todos });
    setTodos([], false);
    showUndoToast('All tasks cleared', function() {
      undoClear();
    });
  }

  function undoClear() {
    var todos = getTodos();
    for (var i = undoStack.length - 1; i >= 0; i--) {
      var action = undoStack[i];
      if (action && action.type === 'clear') {
        var items = action.items;
        setTodos(items, false);
        undoStack.splice(i, 1);
        U.showToast('Undo successful', 1500, 'success');
        return;
      }
    }
    U.showToast('Nothing to undo', 1500, 'warning');
  }

  function completeAllTodos() {
    var todos = getTodos();
    var changed = false;
    todos = todos.map(function(t) {
      if (!t.done) { t.done = true; changed = true; }
      return t;
    });
    if (changed) {
      setTodos(todos);
      U.showToast('All tasks completed', 1500, 'success');
    }
  }

  function deleteCompletedTodos() {
    var todos = getTodos();
    var completed = todos.filter(function(t) { return t.done; });
    if (completed.length === 0) { U.showToast('No completed tasks', 1500, 'warning'); return; }
    if (!confirm('Delete ' + completed.length + ' completed tasks?')) return;
    var remaining = todos.filter(function(t) { return !t.done; });
    undoStack.push({ type: 'delete-completed', items: completed });
    setTodos(remaining, false);
    showUndoToast('Completed tasks deleted', function() {
      undoDeleteCompleted();
    });
  }

  function undoDeleteCompleted() {
    for (var i = undoStack.length - 1; i >= 0; i--) {
      var action = undoStack[i];
      if (action && action.type === 'delete-completed') {
        var items = action.items;
        var todos = getTodos();
        todos = todos.concat(items);
        setTodos(todos, false);
        undoStack.splice(i, 1);
        U.showToast('Undo successful', 1500, 'success');
        return;
      }
    }
    U.showToast('Nothing to undo', 1500, 'warning');
  }

  function reorderTodos(fromIndex, toIndex) {
    var todos = getTodos();
    if (fromIndex < 0 || fromIndex >= todos.length || toIndex < 0 || toIndex >= todos.length) return;
    var item = todos.splice(fromIndex, 1)[0];
    todos.splice(toIndex, 0, item);
    setTodos(todos);
  }

  function copyFromYesterday() {
    var yesterdayKey = U.addDays(App.curKey, -1);
    var yesterdayData = App.Storage.getDay(yesterdayKey);
    var yesterdayTodos = yesterdayData.todos || [];
    var undone = yesterdayTodos.filter(function(t) { return !t.done; });
    if (undone.length === 0) {
      U.showToast('No undone tasks from yesterday', 1500, 'warning');
      return;
    }
    var currentTodos = getTodos();
    var newTodos = currentTodos.concat(undone.map(function(t) {
      return { id: U.uid(), text: t.text, done: false, priority: t.priority || 'medium', dueDate: t.dueDate || '' };
    }));
    setTodos(newTodos);
    U.showToast('Copied ' + undone.length + ' tasks from yesterday', 2000, 'success');
  }

  // ----- Undo toast helper -----
  function showUndoToast(msg, undoCallback) {
    U.showToast(msg, 5000, null, undoCallback);
  }

  // ----- Public API -----
  function init() {
    bindEvents();
    var filterBtns = document.querySelectorAll('.todo-filter-btn');
    if (filterBtns.length) filterMode = filterBtns[0].dataset.filter;
    var sortSelect = document.getElementById("todoSort");
    if (sortSelect) sortMode = sortSelect.value;
    renderTodos();
  }

  return {
    init: init,
    renderTodos: renderTodos,
    updateTodoStats: updateTodoStats,
    addTodo: addTodo,
    toggleTodo: toggleTodo,
    deleteTodo: deleteTodo,
    clearTodos: clearTodos,
    reorderTodos: reorderTodos,
    copyFromYesterday: copyFromYesterday,
    completeAllTodos: completeAllTodos,
    deleteCompletedTodos: deleteCompletedTodos
  };
})();

