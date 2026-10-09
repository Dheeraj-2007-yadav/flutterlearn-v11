"use strict";
/* FlutterForward Resources — resource library with admin uploads.
   Plugs into the existing app: adds a "Resources" tab and #/resources view.
   Uses Firestore via compat SDK (loaded in index.html). Link-based uploads.
   ADMIN_EMAIL must be set to the owner's login email to enable uploads. */
const ADMIN_EMAIL = "dy78dy77@gmail.com";

(function(){
  // TABS and views are const globals (not on window) — access via global scope
  try{
    if(typeof TABS === "undefined" || typeof views === "undefined") return;
  }catch(e){ return; }

  // 1. Add nav tab
  const RES_TAB = {
    route: "#/resources",
    label: "Resources",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>',
    match: ["resources"]
  };
  TABS.push(RES_TAB);

  // 1b. Inject into already-rendered nav (desktop topbar + mobile sidebar)
  function injectNav(){
    // Desktop topbar
    document.querySelectorAll(".nav-links").forEach(function(nav){
      if(nav.querySelector('[href="#/resources"]')) return;
      const a = document.createElement("a");
      a.className = "nav-link";
      a.dataset.match = "resources";
      a.href = "#/resources";
      a.textContent = "Resources";
      nav.appendChild(a);
    });
    // Mobile sidebar
    document.querySelectorAll(".sidebar .side-links, #sidebar .side-nav").forEach(function(nav){
      if(nav.querySelector('[href="#/resources"]')) return;
      const a = document.createElement("a");
      a.className = "side-link";
      a.dataset.match = "resources";
      a.href = "#/resources";
      a.innerHTML = '<span class="side-ic">' + RES_TAB.icon + '</span><span>Resources</span>';
      nav.appendChild(a);
    });
    // Fallback: any sidebar link container
    const sideBar = document.getElementById("sidebar");
    if(sideBar && !sideBar.querySelector('[href="#/resources"]')){
      const links = sideBar.querySelectorAll("nav, .side-links");
      links.forEach(function(nav){
        const a = document.createElement("a");
        a.className = "side-link";
        a.dataset.match = "resources";
        a.href = "#/resources";
        a.innerHTML = '<span class="side-ic">' + RES_TAB.icon + '</span><span>Resources</span>';
        nav.appendChild(a);
      });
    }
  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ setTimeout(injectNav, 100); });
  }else{
    setTimeout(injectNav, 100);
  }

  // 2. Firestore handle (initialized lazily)
  let db = null, firestoreReady = false;
  function initData(){
    if(firestoreReady) return true;
    try{
      if(!window.firebase || !firebase.firestore) return false;
      if(!db){
        db = firebase.firestore();
      }
      firestoreReady = true;
      return true;
    }catch(e){ return false; }
  }

  function isAdmin(){
    try{
      const u = firebase.auth().currentUser;
      return !!(u && u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
        && ADMIN_EMAIL !== "ADMIN_EMAIL_PLACEHOLDER");
    }catch(e){ return false; }
  }

  function escHtml(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  function fileIcon(type){
    const t = String(type||"").toLowerCase();
    if(t.includes("pdf")) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
    if(t.includes("video")||t.includes("mp4")) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="13" height="12" rx="2"/><path d="m22 8-6 4 6 4z"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
  }

  // Extract Google Drive file ID from share links
  function driveFileId(url){
    try{
      const m = String(url||"").match(/\/d\/([a-zA-Z0-9_-]+)/) || String(url||"").match(/[?&]id=([a-zA-Z0-9_-]+)/);
      return m ? m[1] : null;
    }catch(e){ return null; }
  }

  // Drive thumbnail URL (400px wide)
  function driveThumb(url){
    const id = driveFileId(url);
    return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w400" : null;
  }

  // Drive embedded preview URL (opens inside our site)
  function drivePreview(url){
    const id = driveFileId(url);
    return id ? "https://drive.google.com/file/d/" + id + "/preview" : url;
  }

  window.__resFallbackIcon = function(type){ return fileIcon(type); };

  // Open resource in an in-site modal instead of navigating to Drive
  window.__resPreview = function(title, url){
    const previewUrl = drivePreview(url);
    let modal = document.getElementById("res-preview-modal");
    if(!modal){
      modal = document.createElement("div");
      modal.id = "res-preview-modal";
      modal.className = "res-modal";
      modal.innerHTML =
        '<div class="res-modal-backdrop" id="res-modal-backdrop"></div>' +
        '<div class="res-modal-box">' +
          '<div class="res-modal-head"><h3 id="res-modal-title"></h3>' +
          '<button class="res-modal-close" id="res-modal-close" aria-label="Close">&times;</button></div>' +
          '<div class="res-modal-body"><iframe id="res-modal-frame" frameborder="0" allowfullscreen></iframe></div>' +
        '</div>';
      document.body.appendChild(modal);
      document.getElementById("res-modal-close").addEventListener("click", closeResModal);
      document.getElementById("res-modal-backdrop").addEventListener("click", closeResModal);
      document.addEventListener("keydown", function(e){ if(e.key === "Escape") closeResModal(); });
    }
    document.getElementById("res-modal-title").textContent = title;
    document.getElementById("res-modal-frame").src = previewUrl;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  };
  function closeResModal(){
    const modal = document.getElementById("res-preview-modal");
    if(modal){
      modal.classList.remove("open");
      document.getElementById("res-modal-frame").src = "";
    }
    document.body.style.overflow = "";
  }

  // 3. The Resources view
  views.resources = function(){
    const admin = isAdmin();
    return `
    <div class="wrap">
      <div class="page-head">
        <h1>Resources</h1>
        <p class="page-sub">Curated materials to boost your Flutter learning.</p>
      </div>
      ${admin ? `
      <div class="card" id="res-admin" style="margin-bottom:20px">
        <h3 style="margin-bottom:12px">Add resource <span class="pill pill-admin">Admin</span></h3>
        <div class="res-form">
          <input type="url" id="res-link" class="input" placeholder="File link (Google Drive share link, etc.)" />
          <input type="text" id="res-title" class="input" placeholder="Title" />
          <textarea id="res-desc" class="input" placeholder="Description" rows="2"></textarea>
          <div class="res-row">
            <label class="res-toggle"><input type="checkbox" id="res-paid" /> Paid</label>
            <input type="text" id="res-price" class="input" placeholder="Price (e.g. ₹199)" style="display:none" />
          </div>
          <button class="btn btn-blue" id="res-publish">Publish</button>
          <div id="res-status" class="res-status"></div>
        </div>
      </div>` : ``}
      <div id="res-list"><div class="card"><p class="muted">Loading resources…</p></div></div>
    </div>`;
  };

  // Setup wiring after view renders (inline <script> doesn't run via innerHTML)
  function wireResourcesPage(){
    const list = document.getElementById("res-list");
    if(!list || list.dataset.wired) return;
    list.dataset.wired = "1";
    const paid = document.getElementById("res-paid");
    const price = document.getElementById("res-price");
    if(paid && price){
      paid.addEventListener("change", function(){ price.style.display = paid.checked ? "" : "none"; });
    }
    const btn = document.getElementById("res-publish");
    if(btn){
      btn.addEventListener("click", function(){ window.__resPublish(); });
    }
    window.__resLoad();
  }
  // Watch for the resources page appearing
  new MutationObserver(function(){
    if((location.hash||"").startsWith("#/resources")){
      wireResourcesPage();
    }
  }).observe(document.body, { childList: true, subtree: true });

  // 4. Load and render resource list
  window.__resLoad = function(){
    const list = document.getElementById("res-list");
    if(!list) return;
    if(!initData()){
      list.innerHTML = '<div class="card"><p class="muted">Resources are unavailable right now. Please try again later.</p></div>';
      return;
    }
    db.collection("resources").orderBy("uploadedAt","desc").get().then(function(snap){
      if(snap.empty){
        list.innerHTML = '<div class="card"><p class="muted">No resources yet. Check back soon!</p></div>';
        return;
      }
      let html = '<div class="res-grid">';
      let idx = 0;
      window.__resData = window.__resData || {};
      snap.forEach(function(doc){
        const r = doc.data();
        const paid = r.freeOrPaid === "paid";
        const key = "res" + (idx++);
        window.__resData[key] = { title: r.title, url: r.storageUrl };
        const thumb = driveThumb(r.storageUrl);
        const thumbHtml = thumb
          ? `<div class="res-thumb"><img src="${escHtml(thumb)}" alt="" loading="lazy" onerror="this.parentNode.innerHTML=window.__resFallbackIcon('${escHtml(r.type||'file')}')" /></div>`
          : `<div class="res-thumb res-thumb-icon">${fileIcon(r.type)}</div>`;
        html += `
        <div class="card res-card">
          ${thumbHtml}
          <div class="res-body">
            <div class="res-title-row">
              <h3>${escHtml(r.title)}</h3>
              <span class="pill ${paid?"pill-paid":"pill-free"}">${paid?"Paid":"Free"}</span>
            </div>
            ${r.description ? `<p class="muted res-desc">${escHtml(r.description)}</p>` : ``}
            <div class="res-foot">
              ${paid && r.price ? `<span class="res-price">${escHtml(r.price)}</span>` : ``}
              ${paid
                ? `<button class="btn res-btn" data-paid-note>Contact admin to purchase</button>`
                : `<button class="btn btn-blue res-btn" onclick="window.__resPreview(window.__resData['${key}'].title, window.__resData['${key}'].url)">View resource</button>`}
            </div>
          </div>
        </div>`;
      });
      html += '</div>';
      list.innerHTML = html;
      list.querySelectorAll("[data-paid-note]").forEach(function(b){
        b.addEventListener("click", function(){
          alert("This is a paid resource. Please contact the admin to purchase access.");
        });
      });
    }).catch(function(){
      list.innerHTML = '<div class="card"><p class="muted">Could not load resources. Please try again later.</p></div>';
    });
  };

  // 5. Admin publish handler (link-based: paste a Drive/share link)
  window.__resPublish = function(){
    const status = document.getElementById("res-status");
    const say = function(msg){ if(status) status.textContent = msg; };
    if(!isAdmin()){ say("Admin access required."); return; }
    if(!initData()){ say("Database is not ready. Enable Firestore in the Firebase console, then reload."); return; }
    const link = (document.getElementById("res-link").value||"").trim();
    const title = (document.getElementById("res-title").value||"").trim();
    const desc = (document.getElementById("res-desc").value||"").trim();
    const paid = document.getElementById("res-paid").checked;
    const price = (document.getElementById("res-price").value||"").trim();
    if(!link){ say("Paste the file link first."); return; }
    if(!/^https?:\/\//i.test(link)){ say("Link must start with http:// or https://"); return; }
    if(!title){ say("Add a title."); return; }
    if(paid && !price){ say("Add a price for paid resources."); return; }
    say("Publishing…");
    let type = "link";
    try{
      const ext = link.split("?")[0].split(".").pop().toLowerCase();
      if(["pdf","mp4","zip","doc","docx","ppt","pptx","xls","xlsx","txt"].includes(ext)) type = ext;
    }catch(e){}
    db.collection("resources").add({
      title: title,
      description: desc,
      type: type,
      freeOrPaid: paid ? "paid" : "free",
      price: paid ? price : "",
      storageUrl: link,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(){
      say("Published!");
      document.getElementById("res-link").value = "";
      document.getElementById("res-title").value = "";
      document.getElementById("res-desc").value = "";
      document.getElementById("res-price").value = "";
      document.getElementById("res-paid").checked = false;
      document.getElementById("res-price").style.display = "none";
      window.__resLoad();
    }).catch(function(e){
      say("Publish failed: " + (e && e.message ? e.message : "try again"));
    });
  };

  // 6. Refresh admin panel visibility on auth change (in case admin logs in/out while on page)
  if(window.firebase && firebase.auth){
    firebase.auth().onAuthStateChanged(function(){
      if((location.hash||"").startsWith("#/resources") && window.route) window.route();
    });
  }
})();
