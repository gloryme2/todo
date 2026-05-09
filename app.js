'use strict';

class TodoApp {
  constructor() {
    this.todos      = this.load('todos', []);
    this.filter     = 'all';
    this.darkMode   = this.load('darkMode', false);
    this.deletingIds = new Set();
    this.dragSrcEl  = null;

    this.bindElements();
    this.bindEvents();
    this.applyTheme();
    this.render();
  }

  /* ── Element refs ── */
  bindElements() {
    this.inputEl       = document.getElementById('todoInput');
    this.priorityEl    = document.getElementById('prioritySelect');
    this.addBtn        = document.getElementById('addBtn');
    this.listEl        = document.getElementById('todoList');
    this.filterBtns    = document.querySelectorAll('.filter-btn');
    this.itemCountEl   = document.getElementById('itemCount');
    this.clearBtn      = document.getElementById('clearCompleted');
    this.themeBtn      = document.getElementById('themeToggle');
    this.footerEl      = document.getElementById('footer');
  }

  /* ── Events ── */
  bindEvents() {
    this.addBtn.addEventListener('click', () => this.addTodo());

    this.inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.addTodo();
    });

    this.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => this.setFilter(btn.dataset.filter));
    });

    this.clearBtn.addEventListener('click', () => this.clearCompleted());
    this.themeBtn.addEventListener('click', () => this.toggleTheme());
  }

  /* ── Storage ── */
  load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  /* ── CRUD ── */
  addTodo() {
    const text = this.inputEl.value.trim();
    if (!text) {
      this.inputEl.classList.remove('shake');
      // force reflow so animation restarts
      void this.inputEl.offsetWidth;
      this.inputEl.classList.add('shake');
      this.inputEl.focus();
      return;
    }

    this.todos.unshift({
      id:        crypto.randomUUID?.() ?? (Date.now().toString(36) + Math.random().toString(36).slice(2)),
      text,
      completed: false,
      priority:  this.priorityEl.value,
      createdAt: Date.now(),
    });

    this.save('todos', this.todos);
    this.inputEl.value    = '';
    this.priorityEl.value = 'normal';
    this.render();
    this.inputEl.focus();
  }

  toggleTodo(id) {
    const todo = this.todos.find(t => t.id === id);
    if (!todo) return;
    todo.completed = !todo.completed;
    this.save('todos', this.todos);
    this.render();
  }

  deleteTodo(id) {
    if (this.deletingIds.has(id)) return;
    this.deletingIds.add(id);

    const li = this.listEl.querySelector(`[data-id="${id}"]`);
    if (li) li.classList.add('removing');

    setTimeout(() => {
      this.deletingIds.delete(id);
      this.todos = this.todos.filter(t => t.id !== id);
      this.save('todos', this.todos);
      this.render();
    }, 280);
  }

  editTodo(id, newText) {
    const trimmed = newText.trim();
    const todo = this.todos.find(t => t.id === id);
    if (!todo) return;
    if (trimmed) todo.text = trimmed;
    this.save('todos', this.todos);
    this.render();
  }

  clearCompleted() {
    this.todos = this.todos.filter(t => !t.completed);
    this.save('todos', this.todos);
    this.render();
  }

  /* ── Filter ── */
  setFilter(filter) {
    this.filter = filter;
    this.filterBtns.forEach(btn => {
      const isActive = btn.dataset.filter === filter;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
    this.render();
  }

  filtered() {
    const { todos, filter } = this;
    if (filter === 'active')    return todos.filter(t => !t.completed);
    if (filter === 'completed') return todos.filter(t =>  t.completed);
    return todos;
  }

  /* ── Theme ── */
  toggleTheme() {
    this.darkMode = !this.darkMode;
    this.save('darkMode', this.darkMode);
    this.applyTheme();
  }

  applyTheme() {
    document.body.classList.toggle('dark', this.darkMode);
    this.themeBtn.textContent = this.darkMode ? '☀️' : '🌙';
  }

  /* ── Drag & Drop ── */
  onDragStart(e, li) {
    this.dragSrcEl = li;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', li.dataset.id);
  }

  onDragOver(e, li) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.listEl.querySelectorAll('.todo-item').forEach(el => el.classList.remove('drag-over'));
    if (li !== this.dragSrcEl) li.classList.add('drag-over');
  }

  onDrop(e, li) {
    e.preventDefault();
    const srcId  = e.dataTransfer.getData('text/plain');
    const destId = li.dataset.id;
    if (srcId === destId) return;

    const srcIdx  = this.todos.findIndex(t => t.id === srcId);
    const destIdx = this.todos.findIndex(t => t.id === destId);
    if (srcIdx === -1 || destIdx === -1) return;

    const [moved] = this.todos.splice(srcIdx, 1);
    this.todos.splice(destIdx, 0, moved);
    this.save('todos', this.todos);
    this.render();
  }

  onDragEnd() {
    this.listEl.querySelectorAll('.todo-item').forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });
  }

  /* ── Build a single list item ── */
  buildItem(todo) {
    const li = document.createElement('li');
    li.className = `todo-item priority-${todo.priority}${todo.completed ? ' completed' : ''}`;
    li.dataset.id = todo.id;
    li.draggable  = true;

    /* Checkbox */
    const chk = document.createElement('input');
    chk.type    = 'checkbox';
    chk.className = 'todo-checkbox';
    chk.checked   = todo.completed;
    chk.setAttribute('aria-label', `완료 표시: ${todo.text}`);
    chk.addEventListener('change', () => this.toggleTodo(todo.id));

    /* Text */
    const span = document.createElement('span');
    span.className = 'todo-text';
    span.textContent = todo.text;
    span.title = '더블클릭으로 편집';
    span.addEventListener('dblclick', () => {
      if (todo.completed) return;
      this.startEdit(li, span, todo);
    });

    /* Priority badge (only high/low) */
    const LABELS = { high: '높음', normal: '보통', low: '낮음' };
    let badge = null;
    if (todo.priority !== 'normal') {
      badge = document.createElement('span');
      badge.className = `priority-badge priority-${todo.priority}`;
      badge.textContent = LABELS[todo.priority];
    }

    /* Delete */
    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '×';
    del.setAttribute('aria-label', `삭제: ${todo.text}`);
    del.addEventListener('click', () => this.deleteTodo(todo.id));

    li.appendChild(chk);
    li.appendChild(span);
    if (badge) li.appendChild(badge);
    li.appendChild(del);

    /* Drag */
    li.addEventListener('dragstart', e => this.onDragStart(e, li));
    li.addEventListener('dragover',  e => this.onDragOver(e, li));
    li.addEventListener('drop',      e => this.onDrop(e, li));
    li.addEventListener('dragend',   () => this.onDragEnd());

    return li;
  }

  /* ── Inline edit ── */
  startEdit(li, span, todo) {
    li.classList.add('editing');

    const inp = document.createElement('input');
    inp.type      = 'text';
    inp.className = 'edit-input';
    inp.value     = todo.text;
    inp.setAttribute('aria-label', '편집');

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      this.editTodo(todo.id, inp.value);
    };

    inp.addEventListener('blur',    () => commit());
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
      if (e.key === 'Escape') { inp.value = todo.text; inp.blur(); }
    });

    span.replaceWith(inp);
    inp.focus();
    inp.select();
  }

  /* ── Footer ── */
  updateFooter() {
    const active     = this.todos.filter(t => !t.completed).length;
    const hasCompleted = this.todos.some(t => t.completed);

    this.itemCountEl.textContent = `${active}개 남음`;
    this.clearBtn.style.visibility  = hasCompleted ? 'visible' : 'hidden';
    this.footerEl.style.display     = this.todos.length > 0 ? 'flex' : 'none';
  }

  /* ── Render ── */
  render() {
    const items = this.filtered();
    this.listEl.innerHTML = '';

    if (items.length === 0) {
      const MSG = {
        all:       '할 일을 추가해 보세요!',
        active:    '모든 할 일을 완료했어요! 🎉',
        completed: '완료된 항목이 없어요.',
      };
      const li = document.createElement('li');
      li.className = 'empty-state';
      const icon = document.createElement('div');
      icon.className   = 'empty-icon';
      icon.textContent = '📋';
      const msg = document.createElement('p');
      msg.textContent = MSG[this.filter];
      li.appendChild(icon);
      li.appendChild(msg);
      this.listEl.appendChild(li);
    } else {
      const frag = document.createDocumentFragment();
      items.forEach(todo => frag.appendChild(this.buildItem(todo)));
      this.listEl.appendChild(frag);
    }

    this.updateFooter();
  }
}

document.addEventListener('DOMContentLoaded', () => new TodoApp());
