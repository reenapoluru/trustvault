const STORE = {users:"tv_users", docs:"tv_documents", audit:"tv_audit", session:"tv_session"};
const $ = id => document.getElementById(id);
let authMode = "login";
let currentUser = null;
let activeDocId = null;
let toastTimer;

const read = key => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now()+"_"+Math.random().toString(16).slice(2));
const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const formatDate = value => new Date(value).toLocaleString();
function toast(message){ $("toast").textContent=message; $("toast").classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$("toast").classList.remove("show"),2600); }
function logEvent(action, doc, detail=""){
  const events=read(STORE.audit);
  events.unshift({id:uid(),userId:currentUser?.id||"system",userEmail:currentUser?.email||"system",action,docName:doc?.name||"—",docId:doc?.id||"",detail,time:new Date().toISOString()});
  write(STORE.audit,events.slice(0,1000));
}
function setAuthMode(mode){
  authMode=mode; const signup=mode==="signup";
  $("loginTab").classList.toggle("active",!signup); $("signupTab").classList.toggle("active",signup);
  $("nameField").classList.toggle("hidden",!signup); $("roleField").classList.toggle("hidden",!signup);
  $("authHeading").textContent=signup?"Create your account":"Welcome back";
  $("authSubheading").textContent=signup?"Set up your TrustVault workspace.":"Sign in to access your documents.";
  $("authSubmit").textContent=signup?"Create account":"Login";
  $("password").autocomplete=signup?"new-password":"current-password"; $("authMessage").textContent="";
}
$("loginTab").addEventListener("click",()=>setAuthMode("login"));
$("signupTab").addEventListener("click",()=>setAuthMode("signup"));
$("authForm").addEventListener("submit",e=>{
  e.preventDefault(); const email=$("email").value.trim().toLowerCase(), password=$("password").value;
  const users=read(STORE.users);
  if(authMode==="signup"){
    const name=$("fullName").value.trim();
    if(!name){$("authMessage").textContent="Enter your full name.";return;}
    if(users.some(u=>u.email===email)){$("authMessage").textContent="An account with this email already exists.";return;}
    const user={id:uid(),name,email,password,role:$("signupRole").value,createdAt:new Date().toISOString()};
    users.push(user);write(STORE.users,users);currentUser=user;logEvent("ACCOUNT_CREATED",null,`Role: ${user.role}`);openApp();toast("Account created successfully.");
  }else{
    const user=users.find(u=>u.email===email&&u.password===password);
    if(!user){$("authMessage").textContent="Incorrect email or password.";return;}
    currentUser=user;localStorage.setItem(STORE.session,user.id);openApp();logEvent("LOGIN",null,"User signed in.");renderAll();
  }
});
function openApp(){
  localStorage.setItem(STORE.session,currentUser.id);$("authScreen").classList.add("hidden");$("appScreen").classList.remove("hidden");
  $("sidebarName").textContent=currentUser.name;$("sidebarRole").textContent=currentUser.role;$("userAvatar").textContent=currentUser.name[0].toUpperCase();$("topUser").textContent=currentUser.email;
  document.querySelectorAll(".admin-only").forEach(el=>el.classList.toggle("hidden",currentUser.role!=="admin"));
  showView("documents");renderAll();
}
function logout(){if(currentUser)logEvent("LOGOUT",null,"User signed out.");currentUser=null;localStorage.removeItem(STORE.session);$("appScreen").classList.add("hidden");$("authScreen").classList.remove("hidden");$("authForm").reset();setAuthMode("login");}
$("logoutBtn").addEventListener("click",logout);$("topLogout").addEventListener("click",logout);
function showView(view){
  if(view==="admin"&&currentUser.role!=="admin")return;
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  $(view+"View").classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  const titles={documents:"My documents",shared:"Shared with me",admin:"Admin overview",activity:"Audit activity"};$("pageTitle").textContent=titles[view];
  renderAll();
}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
function docs(){return read(STORE.docs);}
function canRead(doc){return doc.ownerId===currentUser.id||!!doc.permissions?.[currentUser.id]||currentUser.role==="admin";}
function canEdit(doc){return doc.ownerId===currentUser.id||doc.permissions?.[currentUser.id]==="edit"||currentUser.role==="admin";}
function card(doc,ownerView){
  const owner=read(STORE.users).find(u=>u.id===doc.ownerId);
  const ext=doc.name.split(".").pop().toUpperCase();
  return `<article class="doc-card"><div class="doc-top"><div class="file-icon">${ext==="PDF"?"PDF":ext==="TXT"?"TXT":"▤"}</div><span class="tag">${safe(doc.category||"Other")}</span></div><h4>${safe(doc.name)}</h4><div class="doc-meta">${ownerView?"Owned by you":`Shared by ${safe(owner?.name||"Unknown")}`}<br>${safe(formatDate(doc.createdAt))} · ${safe(doc.sizeLabel)}</div><div class="doc-actions"><button class="small-btn" data-action="open" data-id="${doc.id}">View</button>${canEdit(doc)?`<button class="small-btn" data-action="edit" data-id="${doc.id}">Edit</button>`:""}${ownerView&&doc.ownerId===currentUser.id?`<button class="small-btn" data-action="share" data-id="${doc.id}">Manage access</button><button class="small-btn danger" data-action="delete" data-id="${doc.id}">Delete</button>`:""}</div></article>`;
}
function renderDocs(){
  const search=$("searchInput").value.trim().toLowerCase(),cat=$("categoryFilter").value,sort=$("sortFilter").value;
  let list=docs().filter(d=>d.ownerId===currentUser.id&&(!search||d.name.toLowerCase().includes(search)||d.category.toLowerCase().includes(search))&&(!cat||d.category===cat));
  if(sort==="name")list.sort((a,b)=>a.name.localeCompare(b.name));else list.sort((a,b)=>sort==="newest"?new Date(b.createdAt)-new Date(a.createdAt):new Date(a.createdAt)-new Date(b.createdAt));
  $("documentGrid").innerHTML=list.map(d=>card(d,true)).join("");$("emptyState").classList.toggle("hidden",list.length>0);
  const own=docs().filter(d=>d.ownerId===currentUser.id);$("totalDocs").textContent=own.length;$("sharedDocs").textContent=own.filter(d=>Object.keys(d.permissions||{}).length).length;
  $("recentActivity").textContent=read(STORE.audit).filter(a=>a.userId===currentUser.id).length;
}
function renderShared(){
  const list=docs().filter(d=>d.ownerId!==currentUser.id&&!!d.permissions?.[currentUser.id]);
  $("sharedGrid").innerHTML=list.map(d=>card(d,false)).join("");$("sharedEmpty").classList.toggle("hidden",list.length>0);
}
function activityMarkup(events){
  if(!events.length)return `<p class="muted">No activity recorded yet.</p>`;
  return events.map(a=>`<div class="activity-row"><div><strong>${safe(a.action.replaceAll("_"," "))} · ${safe(a.docName)}</strong><small>${safe(a.userEmail)} ${a.detail?"— "+safe(a.detail):""}</small></div><small>${safe(formatDate(a.time))}</small></div>`).join("");
}
function renderActivity(){
  const all=read(STORE.audit);const events=currentUser.role==="admin"?all:all.filter(a=>a.userId===currentUser.id||docs().some(d=>d.id===a.docId&&d.ownerId===currentUser.id));
  $("activityList").innerHTML=activityMarkup(events);
  if(currentUser.role==="admin"){$("adminUsers").textContent=read(STORE.users).length;$("adminDocs").textContent=docs().length;$("adminEvents").textContent=all.length;$("adminActivity").innerHTML=activityMarkup(all.slice(0,12));}
}
function renderAll(){if(!currentUser)return;renderDocs();renderShared();renderActivity();}
$("searchInput").addEventListener("input",renderDocs);$("categoryFilter").addEventListener("change",renderDocs);$("sortFilter").addEventListener("change",renderDocs);
$("fileInput").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  const allowed=["application/pdf","text/plain","image/png","image/jpeg","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  if(!allowed.includes(file.type)&&!/\.(pdf|doc|docx|txt|png|jpe?g)$/i.test(file.name)){toast("File type not supported.");e.target.value="";return;}
  if(file.size>2*1024*1024){toast("For this browser demo, files must be 2 MB or smaller.");e.target.value="";return;}
  const reader=new FileReader();reader.onload=()=>{
    const category=prompt("Choose category: Work, Finance, Legal, Personal or Other","Work");if(category===null){e.target.value="";return;}
    const doc={id:uid(),ownerId:currentUser.id,name:file.name,category:["Work","Finance","Legal","Personal","Other"].includes(category)?category:"Other",mime:file.type||"application/octet-stream",data:reader.result,sizeLabel:formatSize(file.size),createdAt:new Date().toISOString(),permissions:{}};
    const all=docs();all.push(doc);write(STORE.docs,all);logEvent("DOCUMENT_UPLOADED",doc,`Category: ${doc.category}`);renderAll();toast("Document uploaded.");e.target.value="";
  };reader.readAsDataURL(file);
});
function formatSize(n){return n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;}
function getDoc(id){return docs().find(d=>d.id===id);}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-action]");if(!b)return;
  const doc=getDoc(b.dataset.id);if(!doc)return;
  if(!canRead(doc)){logEvent("ACCESS_DENIED",doc,"Unauthorised document access attempt.");toast("Access denied.");return;}
  if(b.dataset.action==="open")openPreview(doc);
  if(b.dataset.action==="share"&&doc.ownerId===currentUser.id)openShare(doc);
  if(b.dataset.action==="delete"&&doc.ownerId===currentUser.id)deleteDoc(doc);
  if(b.dataset.action==="edit")editDoc(doc);
});
function openPreview(doc){
  if(!canRead(doc)){logEvent("ACCESS_DENIED",doc,"Preview blocked.");toast("Access denied.");return;}
  $("previewTitle").textContent=doc.name;const content=$("previewContent");content.innerHTML="";
  if(doc.mime.startsWith("image/")){const img=document.createElement("img");img.src=doc.data;img.alt=doc.name;content.appendChild(img);}
  else if(doc.mime==="text/plain"){const pre=document.createElement("pre");pre.textContent=decodeURIComponent(escape(atob(doc.data.split(",")[1]||"")));content.appendChild(pre);}
  else content.textContent="Preview is not available for this file type. Use Download file to open it.";
  $("downloadLink").href=doc.data;$("downloadLink").download=doc.name;
  $("previewModal").classList.remove("hidden");logEvent("DOCUMENT_VIEWED",doc,"Document preview opened.");
}
function closePreview(){$("previewModal").classList.add("hidden");}
$("closePreview").addEventListener("click",closePreview);$("closePreviewBottom").addEventListener("click",closePreview);
function editDoc(doc){
  if(!canEdit(doc)){logEvent("EDIT_DENIED",doc,"User does not have edit permission.");toast("You do not have edit permission.");return;}
  if(doc.mime!=="text/plain"){toast("In-browser editing is available for TXT files only.");return;}
  const old=atob(doc.data.split(",")[1]||"");const updated=prompt("Edit document text:",old);if(updated===null)return;
  const all=docs(),i=all.findIndex(d=>d.id===doc.id);all[i].data="data:text/plain;base64,"+btoa(unescape(encodeURIComponent(updated)));write(STORE.docs,all);logEvent("DOCUMENT_EDITED",all[i],"Text file content updated.");renderAll();toast("Document updated.");
}
function deleteDoc(doc){
  if(!confirm(`Delete "${doc.name}"? This cannot be undone in this demo.`))return;
  write(STORE.docs,docs().filter(d=>d.id!==doc.id));logEvent("DOCUMENT_DELETED",doc,"Owner deleted document.");renderAll();toast("Document deleted.");
}
function openShare(doc){
  activeDocId=doc.id;$("shareDocName").textContent=doc.name;$("shareEmail").value="";$("shareMessage").textContent="";renderAccess();$("shareModal").classList.remove("hidden");
}
function renderAccess(){
  const doc=getDoc(activeDocId);if(!doc)return;
  const users=read(STORE.users).filter(u=>doc.permissions?.[u.id]);
  $("accessList").innerHTML=users.length?users.map(u=>`<div class="access-row"><div><strong>${safe(u.name)}</strong><small>${safe(u.email)} · ${doc.permissions[u.id]==="edit"?"Can edit":"Can view and download"}</small></div><button class="small-btn danger" data-revoke="${u.id}">Revoke</button></div>`).join(""):`<p class="muted">No one has access yet.</p>`;
}
$("accessList").addEventListener("click",e=>{
  const b=e.target.closest("[data-revoke]");if(!b)return;const doc=getDoc(activeDocId);if(!doc||doc.ownerId!==currentUser.id)return;
  delete doc.permissions[b.dataset.revoke];write(STORE.docs,docs().map(d=>d.id===doc.id?doc:d));logEvent("PERMISSION_REVOKED",doc,`Access removed for ${b.dataset.revoke}.`);renderAccess();renderAll();toast("Access revoked.");
});
$("shareForm").addEventListener("submit",e=>{
  e.preventDefault();const doc=getDoc(activeDocId);if(!doc||doc.ownerId!==currentUser.id)return;
  const email=$("shareEmail").value.trim().toLowerCase(),user=read(STORE.users).find(u=>u.email===email);
  if(!user){$("shareMessage").textContent="No registered account found with that email.";return;}
  if(user.id===currentUser.id){$("shareMessage").textContent="You already own this document.";return;}
  doc.permissions=doc.permissions||{};doc.permissions[user.id]=$("sharePermission").value;write(STORE.docs,docs().map(d=>d.id===doc.id?doc:d));
  logEvent("PERMISSION_GRANTED",doc,`Access granted to ${email} (${doc.permissions[user.id]}).`);$("shareMessage").textContent="Access granted."; $("shareMessage").classList.add("success");renderAccess();renderAll();
});
function closeShare(){$("shareModal").classList.add("hidden");activeDocId=null;}
$("closeShare").addEventListener("click",closeShare);
$("shareModal").addEventListener("click",e=>{if(e.target===$("shareModal"))closeShare();});
$("previewModal").addEventListener("click",e=>{if(e.target===$("previewModal"))closePreview();});
function init(){
  // Demo administrator account. Change/remove this before any real deployment.
  const existingUsers=read(STORE.users);
  if(!existingUsers.some(u=>u.role==="admin")){
    existingUsers.push({id:uid(),name:"TrustVault Admin",email:"admin@trustvault.demo",password:"Admin123!",role:"admin",createdAt:new Date().toISOString()});
    write(STORE.users,existingUsers);
  }
  const id=localStorage.getItem(STORE.session);if(id){const user=read(STORE.users).find(u=>u.id===id);if(user){currentUser=user;openApp();return;}}
  $("authScreen").classList.remove("hidden");$("appScreen").classList.add("hidden");
}
init();
