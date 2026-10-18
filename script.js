"use strict";

const STORAGE_KEY = "study-board-v1";

const form = document.querySelector("#task-form");
const courseInput = document.querySelector("#course");
const contentInput = document.querySelector("#content");
const deadlineInput = document.querySelector("#deadline");
const formTitle = document.querySelector("#form-title");
const submitButton = document.querySelector("#submit-button");
const cancelButton = document.querySelector("#cancel-edit");
const taskList = document.querySelector("#task-list");
const filterButtons = document.querySelectorAll(".filter-button");
const message = document.querySelector("#message");

let tasks = [];
let currentFilter = "all";
let editingId = null;
let storageReady = true;
let messageTimer;

// 讀取並檢查儲存資料，避免無效資料影響網頁。
try {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved !== null) {
    const parsed = JSON.parse(saved);
    const ids = new Set();

    const valid =
      Array.isArray(parsed) &&
      parsed.every((task) => {
        if (
          !task ||
          typeof task.id !== "string" ||
          !task.id ||
          ids.has(task.id) ||
          typeof task.course !== "string" ||
          !task.course.trim() ||
          typeof task.content !== "string" ||
          !task.content.trim() ||
          typeof task.deadline !== "string" ||
          !Number.isFinite(new Date(task.deadline).getTime()) ||
          typeof task.completed !== "boolean"
        ) {
          return false;
        }

        ids.add(task.id);
        return true;
      });

    if (!valid) {
      throw new Error("Invalid saved tasks");
    }

    tasks = parsed;
  }
} catch {
  storageReady = false;
  showMessage(
    "無法讀取儲存資料，目前變更僅保留在此頁，請勿關閉或重新整理。",
    true
  );
}

function showMessage(text, isError = false) {
  clearTimeout(messageTimer);
  message.textContent = text;
  message.classList.toggle("error", isError);

  if (!isError) {
    messageTimer = setTimeout(() => {
      message.textContent = "";
    }, 3500);
  }
}

function saveTasks() {
  if (!storageReady) {
    showMessage(
      "目前無法保存紀錄，變更僅保留在此頁，請勿關閉或重新整理。",
      true
    );
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch {
    showMessage(
      "儲存失敗，變更僅保留在此頁。請檢查瀏覽器儲存空間或設定。",
      true
    );
    return false;
  }
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// 使用本地時間組合欄位值，避免轉成 UTC 後造成時間偏移。
function toLocalInputValue(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

function formatDeadline(value) {
  return new Date(value).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function getStatus(task) {
  if (task.completed) {
    return { text: "已完成", className: "done" };
  }

  const remaining = new Date(task.deadline).getTime() - Date.now();

  if (remaining <= 0) {
    return { text: "已逾期", className: "overdue" };
  }

  if (remaining <= 24 * 60 * 60 * 1000) {
    return { text: "即將到期", className: "soon" };
  }

  return { text: "進行中", className: "" };
}

function resetForm() {
  editingId = null;
  form.reset();
  courseInput.setCustomValidity("");
  contentInput.setCustomValidity("");
  deadlineInput.setCustomValidity("");
  formTitle.textContent = "新增任務";
  submitButton.textContent = "＋ 新增任務";
  cancelButton.hidden = true;
}

function updateProgress() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  document.querySelector("#progress-text").textContent =
    `已完成 ${completed} / ${total} 項任務`;

  document.querySelector("#progress-percent").textContent = `${percent}%`;

  const bar = document.querySelector("#progress-bar");
  bar.value = percent;
  bar.textContent = `${percent}%`;

  document.querySelector("#task-count").textContent = `${total} 項任務`;
}

function createActionButton(text, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `action-button ${className}`;
  button.textContent = text;
  button.addEventListener("click", handler);
  return button;
}

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = `task-card${task.completed ? " completed" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute(
    "aria-label",
    `${task.completed ? "取消完成" : "標記完成"}：${task.course}，${task.content}`
  );

  checkbox.addEventListener("change", () => {
    task.completed = checkbox.checked;
    saveTasks();
    render();
  });

  const body = document.createElement("div");
  body.className = "task-body";

  const top = document.createElement("div");
  top.className = "task-top";

  const course = document.createElement("h3");
  course.className = "task-course";
  course.textContent = task.course;

  const status = getStatus(task);
  const badge = document.createElement("span");
  badge.className = `badge ${status.className}`;
  badge.textContent = status.text;

  const content = document.createElement("p");
  content.className = "task-content";
  content.textContent = task.content;

  const deadline = document.createElement("time");
  deadline.className = "task-deadline";
  deadline.dateTime = new Date(task.deadline).toISOString();
  deadline.textContent = `期限：${formatDeadline(task.deadline)}`;

  const actions = document.createElement("div");
  actions.className = "task-actions";

  actions.append(
    createActionButton("修改", "", () => startEditing(task.id)),
    createActionButton("刪除", "delete", () => deleteTask(task.id))
  );

  top.append(course, badge);
  body.append(top, content, deadline);
  card.append(checkbox, body, actions);

  return card;
}

function render() {
  document.querySelector("#today").textContent =
    new Date().toLocaleDateString("zh-TW", {
      month: "long",
      day: "numeric",
      weekday: "long"
    });

  updateProgress();
  taskList.replaceChildren();

  const visibleTasks = tasks
    .filter((task) => {
      if (currentFilter === "pending") return !task.completed;
      if (currentFilter === "completed") return task.completed;
      return true;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) {
        return Number(a.completed) - Number(b.completed);
      }

      return new Date(a.deadline) - new Date(b.deadline);
    });

  if (visibleTasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const title = document.createElement("p");
    title.textContent = tasks.length === 0
      ? "目前還沒有任務"
      : "此分類目前沒有任務";

    const hint = document.createElement("span");
    hint.textContent = tasks.length === 0
      ? "新增第一項作業，開始整理你的學習計畫。"
      : "試著切換其他分類看看。";

    empty.append(title, hint);
    taskList.append(empty);
    return;
  }

  visibleTasks.forEach((task) => {
    taskList.append(createTaskCard(task));
  });
}

function startEditing(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  editingId = id;
  courseInput.value = task.course;
  contentInput.value = task.content;
  deadlineInput.value = toLocalInputValue(new Date(task.deadline));

  formTitle.textContent = "修改任務";
  submitButton.textContent = "儲存修改";
  cancelButton.hidden = false;

  form.scrollIntoView({ behavior: "smooth", block: "center" });
  courseInput.focus({ preventScroll: true });
}

function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  if (!window.confirm(`確定刪除「${task.course}」的這項任務嗎？`)) {
    return;
  }

  tasks = tasks.filter((item) => item.id !== id);

  if (editingId === id) resetForm();

  const saved = saveTasks();
  render();

  if (saved) showMessage("任務已刪除。");
}

[courseInput, contentInput, deadlineInput].forEach((input) => {
  input.addEventListener("input", () => input.setCustomValidity(""));
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const course = courseInput.value.trim();
  const content = contentInput.value.trim();
  const deadline = deadlineInput.value;

  courseInput.setCustomValidity(course ? "" : "請輸入課程名稱。");
  contentInput.setCustomValidity(content ? "" : "請輸入作業內容。");
  deadlineInput.setCustomValidity(
    Number.isFinite(new Date(deadline).getTime())
      ? ""
      : "請輸入有效的繳交日期與時間。"
  );

  if (!form.reportValidity()) return;

  const wasEditing = editingId !== null;

  if (wasEditing) {
    const task = tasks.find((item) => item.id === editingId);

    if (!task) {
      resetForm();
      showMessage("找不到要修改的任務，請重新操作。", true);
      return;
    }

    Object.assign(task, { course, content, deadline });
  } else {
    tasks.push({
      id: createId(),
      course,
      content,
      deadline,
      completed: false
    });
  }

  const saved = saveTasks();
  resetForm();
  render();

  if (saved) {
    showMessage(wasEditing ? "任務已修改。" : "任務已新增。");
  }
});

cancelButton.addEventListener("click", resetForm);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    filterButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });

    render();
  });
});

// 更新期限標示；操作任務時也會立即更新。
setInterval(render, 60 * 1000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) render();
});

render();
