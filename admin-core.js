const OWNER = 'Coding-Safety';
const REPO = 'Coding-Safety.github.io';
let existingImages = [];
let newImageFiles = [];

document.getElementById('postDate').valueAsDate = new Date();

function getToken() { return localStorage.getItem('gh_safety_token'); }

function saveToken() {
  const val = document.getElementById('tokenInput').value.trim();
  if (!val) return alert('토큰을 입력하세요.');
  localStorage.setItem('gh_safety_token', val);
  initAdmin();
}

function logout() {
  localStorage.removeItem('gh_safety_token');
  location.reload();
}

function switchTab(tabId, btn) {
  document.getElementById('writeTab').classList.add('hidden');
  document.getElementById('companyTab').classList.add('hidden');
  document.getElementById(tabId).classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
}

async function ghApi(path, method, body) {
  method = method || 'GET';
  const url = 'https://github.com' + OWNER + '/' + REPO + '/contents/' + path + '?t=' + Date.now();
  const res = await fetch(url, {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + getToken(),
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) throw new Error('GitHub API 오류 (' + res.status + ')');
  return res.json();
}

function encodeB64(str) { return btoa(unescape(encodeURIComponent(str))); }
function decodeB64(b64) { return decodeURIComponent(escape(atob(b64.replace(/\n/g, '')))); }

function handleFiles(files) {
  for (let i = 0; i < files.length; i++) {
    newImageFiles.push(files[i]);
  }
  document.getElementById('imageFiles').value = '';
  renderPreviews();
}

function renderPreviews() {
  const grid = document.getElementById('previewGrid');
  grid.innerHTML = '';
  existingImages.forEach(function(url, idx) {
    grid.innerHTML += '<div class="preview-item"><img src="' + url + '"><button type="button" class="del-img-btn" onclick="removeExistingImg(' + idx + ')">✕</button></div>';
  });
  newImageFiles.forEach(function(file, idx) {
    const blobUrl = URL.createObjectURL(file);
    grid.innerHTML += '<div class="preview-item"><img src="' + blobUrl + '"><span class="badge-new">새 파일</span><button type="button" class="del-img-btn" onclick="removeNewImg(' + idx + ')">✕</button></div>';
  });
}

function removeExistingImg(idx) { existingImages.splice(idx, 1); renderPreviews(); }
function removeNewImg(idx) { newImageFiles.splice(idx, 1); renderPreviews(); }

async function loadCompanies() {
  const select = document.getElementById('companySelect');
  const listArea = document.getElementById('companyListArea');
  select.innerHTML = '';
  listArea.innerHTML = '';
  try {
    const files = await ghApi('_companies');
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.name.endsWith('.md')) continue;
      const data = await ghApi(f.path);
      const text = decodeB64(data.content);
      const nameMatch = text.match(/name:\s*(.+)/);
      const compName = nameMatch ? nameMatch.slice(1, 2).join('').replace(/["']/g, '').trim() : f.name;
      select.innerHTML += '<option value="' + compName + '">' + compName + '</option>';
      listArea.innerHTML += '<div class="post-row"><strong>' + compName + '</strong><button class="btn btn-danger" onclick="deleteFile(\'' + f.path + '\', \'' + f.sha + '\', \'company\')">삭제</button></div>';
    }
  } catch (e) {
    select.innerHTML = '<option value="">등록된 업체가 없습니다</option>';
  }
}

async function addCompany() {
  const name = document.getElementById('newCompanyName').value.trim();
  const work = document.getElementById('newCompanyWork').value.trim();
  const manager = document.getElementById('newCompanyManager').value.trim();
  if (!name) return alert('업체명을 입력하세요.');
  const dash = '\x2d\x2d\x2d';
  const content = dash + '\nname: "' + name + '"\nwork_type: "' + work + '"\nmanager: "' + manager + '"\n' + dash + '\n';
  const path = '_companies/' + Date.now() + '.md';
  await ghApi(path, 'PUT', { message: 'Add company ' + name, content: encodeB64(content) });
  alert('업체가 추가되었습니다.');
  document.getElementById('newCompanyName').value = '';
  document.getElementById('newCompanyWork').value = '';
  document.getElementById('newCompanyManager').value = '';
  loadCompanies();
}
