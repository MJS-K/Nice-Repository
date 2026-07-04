const DEFAULT_USER = "我自己";
const DEFAULT_TASKS = [
  { id:"run",   name:"跑步",   icon:"🏃" },
  { id:"water", name:"喝水",   icon:"💧" },
  { id:"notes", name:"做笔记", icon:"📝" },
  { id:"study", name:"学习",   icon:"📚" },
];
const STORAGE_KEY = "mjs_checkin";

// === State ===
let state = loadState();
let currentDate = new Date();

function dflt() {
  return { users:[DEFAULT_USER], tasks:JSON.parse(JSON.stringify(DEFAULT_TASKS)), checks:{} };
}
function loadState() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) { const p = JSON.parse(r); if (p&&p.users&&p.tasks&&p.checks) return p; }
  } catch(_) {}
  return dflt();
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayStr() { return fmt(new Date()); }
function isToday(d) { return fmt(d)===todayStr(); }

function chkKey(tid) {
  return `${fmt(currentDate)}:${document.getElementById("username").value}:${tid}`;
}
function isChk(tid) { return !!state.checks[chkKey(tid)]; }

// === Actions ===
function toggle(tid) {
  const k = chkKey(tid);
  if (state.checks[k]) delete state.checks[k]; else state.checks[k] = true;
  save(); render();
}
function delTask(tid) {
  state.tasks = state.tasks.filter(t=>t.id!==tid);
  for (const k of Object.keys(state.checks)) { if (k.endsWith(`:${tid}`)) delete state.checks[k]; }
  save(); render();
}
function addTask(name) {
  state.tasks.push({ id:"t_"+Date.now()+"_"+Math.random().toString(36).slice(2,6), name, icon:"📌" });
  save(); render();
}
function addUser(name) {
  if (!state.users.includes(name)) { state.users.push(name); save(); render(); }
}

function getWeekRange() {
  const t = new Date();
  const dow = t.getDay(), diff = dow===0?6:dow-1;
  const mon = new Date(t); mon.setDate(t.getDate()-diff);
  const sun = new Date(mon); sun.setDate(mon.getDate()+6);
  return {mon,sun};
}

// === Render ===
function render() {
  renderDate(); renderTasks(); renderProgress();
  renderUsers(); renderOverview();
}

function renderDate() {
  const d = currentDate;
  const wd = ["日","一","二","三","四","五","六"];
  const s = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 星期${wd[d.getDay()]}`;
  document.getElementById("displayDate").textContent = isToday(d) ? "今天" : s;
  document.getElementById("todayBtn").style.display = isToday(d) ? "none" : "inline-block";
}

function renderProgress() {
  let done = 0;
  for (const t of state.tasks) { if (isChk(t.id)) done++; }
  const total = state.tasks.length;
  document.getElementById("progressText").textContent = `${done} / ${total}`;
  document.getElementById("progressFill").style.width = total>0 ? `${(done/total)*100}%` : "0%";
}

function renderTasks() {
  const c = document.getElementById("taskList"); c.innerHTML = "";
  for (const t of state.tasks) {
    const chk = isChk(t.id);
    const el = document.createElement("div"); el.className = "task-item";
    el.innerHTML = `
      <div class="task-check ${chk?"done":""}" data-id="${t.id}">${chk?"✓":""}</div>
      <span class="task-icon">${t.icon||"📌"}</span>
      <span class="task-name ${chk?"done":""}">${t.name}</span>
      <button class="task-del" data-id="${t.id}">×</button>
    `;
    el.querySelector(".task-check").addEventListener("click", ()=>toggle(t.id));
    el.querySelector(".task-del").addEventListener("click", e=>{
      e.stopPropagation();
      const d = document.getElementById("confirmDialog");
      document.getElementById("confirmTitle").textContent = `删除「${t.name}」？`;
      document.getElementById("confirmMessage").textContent = "相关打卡记录也会一并删除。";
      d.showModal();
      d.addEventListener("close",()=>{ if (d.returnValue==="ok") delTask(t.id); }, {once:true});
    });
    c.appendChild(el);
  }
}

function renderUsers() {
  const sel = document.getElementById("username");
  const cur = sel.value;
  sel.innerHTML = "";
  for (const u of state.users) {
    const o = document.createElement("option"); o.value=u; o.textContent=u; sel.appendChild(o);
  }
  sel.value = state.users.includes(cur) ? cur : state.users[0];
}
document.getElementById("username").addEventListener("change", render);

function renderOverview() {
  const c = document.getElementById("overviewChart");
  const {mon,sun} = getWeekRange();
  const today = new Date();
  const days = []; const labels = ["一","二","三","四","五","六","日"];
  const d = new Date(mon);
  while (d<=sun) {
    days.push({date:new Date(d), label:labels[days.length],
      isToday:fmt(d)===fmt(today), isFuture:d>today});
    d.setDate(d.getDate()+1);
  }
  if (state.tasks.length===0) { c.innerHTML="<div class='ov-empty'>暂无任务</div>"; return; }

  const curUser = document.getElementById("username").value;
  const totalTasks = state.tasks.length;

  let html = "<table class='ov-table'><thead><tr><th></th>";
  for (const x of days) {
    html+=`<th${x.isToday?' style="color:var(--accent)"':''}>${x.label}</th>`;
  }
  html+="<th>完成</th></tr></thead><tbody>";

  for (const u of state.users) {
    const me = u===curUser;
    html+=`<tr><td class="user-cell${me?' me':''}">${me?'· ':''}${u}</td>`;
    let full=0;
    for (const x of days) {
      if (x.isFuture) { html+=`<td class="ov-cell future">-</td>`; continue; }
      let done=0;
      for (const t of state.tasks) { if (state.checks[`${fmt(x.date)}:${u}:${t.id}`]) done++; }
      const cls = done===totalTasks ? "done" : (done>0?"partial":"none");
      html+=`<td class="ov-cell ${cls}${x.isToday?' today':''}">${done}/${totalTasks}</td>`;
      if (done===totalTasks) full++;
    }
    html+=`<td class="ov-total">${full}</td></tr>`;
  }
  html+="</tbody></table>";
  c.innerHTML = html;
}

// === Nav ===
document.getElementById("prevDay").addEventListener("click", ()=>{ currentDate.setDate(currentDate.getDate()-1); render(); });
document.getElementById("nextDay").addEventListener("click", ()=>{ currentDate.setDate(currentDate.getDate()+1); render(); });
document.getElementById("todayBtn").addEventListener("click", ()=>{ currentDate=new Date(); render(); });
document.getElementById("addUserBtn").addEventListener("click", ()=>{
  const d=document.getElementById("addUserDialog"); document.getElementById("newUserName").value=""; d.showModal();
  d.addEventListener("close",()=>{ const v=document.getElementById("newUserName").value.trim(); if(d.returnValue==="ok"&&v) addUser(v); }, {once:true});
});
document.getElementById("addTaskBtn").addEventListener("click", ()=>{
  const d=document.getElementById("addTaskDialog"); document.getElementById("newTaskName").value=""; d.showModal();
  d.addEventListener("close",()=>{ const v=document.getElementById("newTaskName").value.trim(); if(d.returnValue==="ok"&&v) addTask(v); }, {once:true});
});

// === Init ===
render();
