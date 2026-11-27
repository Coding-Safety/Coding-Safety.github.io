async function initAdmin() {
  if (!getToken()) return;
  try {
    const userRes = await fetch('https://github.com', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!userRes.ok) throw new Error('인증 실패');
    const user = await userRes.json();
    document.getElementById('userInfo').innerText = '접속 계정: ' + user.login;
    document.getElementById('authCard').classList.add('hidden');
    document.getElementById('adminArea').classList.remove('hidden');
    await loadCompanies();
    await loadPosts();
  } catch (e) {
    alert('토큰이 유효하지 않거나 권한이 없습니다.');
    localStorage.removeItem('gh_safety_token');
  }
}

async function loadPosts() {
  const area = document.getElementById('postListArea');
  area.innerHTML = '';
  try {
    const files = await ghApi('_posts');
    files.reverse();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.name.endsWith('.md')) continue;
      const data = await ghApi(f.path);
      const text = decodeB64(data.content);
      const titleMatch = text.match(/title:\s*(.+)/);
      const compMatch = text.match(/company:\s*(.+)/);
      const title = titleMatch ? titleMatch.slice(1, 2).join('').replace(/["']/g, '').trim() : f.name;
      const company = compMatch ? compMatch.slice(1, 2).join('').replace(/["']/g, '').trim() : '';
      area.innerHTML += '<div class="post-row"><div><span style="font-size:0.8rem; color:#1e3a8a; font-weight:bold;">[' + company + ']</span> <strong>' + title + '</strong></div><div style="display:flex; gap:6px;"><button class="btn btn-sub" style="padding:6px 10px; font-size:0.8rem;" onclick="editPost(\'' + f.path + '\')">수정</button><button class="btn btn-danger" onclick="deleteFile(\'' + f.path + '\', \'' + f.sha + '\', \'post\')">삭제</button></div></div>';
    }
  } catch (e) {
    area.innerHTML = '등록된 글이 없습니다.';
  }
}

async function editPost(path) {
  const data = await ghApi(path);
  const text = decodeB64(data.content);
  const dash = '\x2d\x2d\x2d';
  const parts = text.split(dash);
  const front = parts.slice(1, 2).join('');
  const body = parts.slice(2).join(dash).trim();
  const getVal = function(key) {
    const m = front.match(new RegExp(key + ':\\s*(.+)'));
    return m ? m.slice(1, 2).join('').replace(/["']/g, '').trim() : '';
  };
  document.getElementById('editPath').value = path;
  document.getElementById('editSha').value = data.sha;
  document.getElementById('companySelect').value = getVal('company');
  document.getElementById('postTitle').value = getVal('title');
  document.getElementById('workType').value = getVal('work_type');
  document.getElementById('postDate').value = getVal('date').slice(0, 10);
  document.getElementById('postBody').value = body;
  existingImages = [];
  const imgMatches = front.match(/-\s*["']?(\/assets\/images\/[^\s"']+)["']?/g);
  if (imgMatches) {
    existingImages = imgMatches.map(function(line) {
      return line.replace(/^-\s*["']?/, '').replace(/["']?$/, '').trim();
    });
  }
  newImageFiles = [];
  renderPreviews();
  document.getElementById('formTitle').innerText = '위험성평가 수정 중';
  document.getElementById('cancelEditBtn').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  document.getElementById('editPath').value = '';
  document.getElementById('editSha').value = '';
  document.getElementById('postTitle').value = '';
  document.getElementById('workType').value = '';
  document.getElementById('postDate').valueAsDate = new Date();
  document.getElementById('postBody').value = '';
  existingImages = [];
  newImageFiles = [];
  renderPreviews();
  document.getElementById('formTitle').innerText = '새 위험성평가 등록';
  document.getElementById('cancelEditBtn').classList.add('hidden');
}

function fileToBase64(file) {
  return new Promise(function(resolve) {
    const reader = new FileReader();
    reader.onload = function() { resolve(reader.result.split(',').pop()); };
    reader.readAsDataURL(file);
  });
}

async function savePost() {
  const company = document.getElementById('companySelect').value;
  const title = document.getElementById('postTitle').value.trim();
  const workType = document.getElementById('workType').value.trim();
  const date = document.getElementById('postDate').value;
  const body = document.getElementById('postBody').value;
  if (!company || !title || !workType || !date) return alert('필수 항목(*)을 모두 입력하세요.');
  const btn = document.getElementById('submitBtn');
  const status = document.getElementById('statusMsg');
  btn.disabled = true;
  try {
    const finalImages = existingImages.slice();
    for (let i = 0; i < newImageFiles.length; i++) {
      status.innerText = '이미지 업로드 중... (' + (i + 1) + '/' + newImageFiles.length + ')';
      const file = newImageFiles[i];
      const ext = file.name.split('.').pop();
      const imgPath = 'assets/images/' + Date.now() + '_' + i + '.' + ext;
      const b64 = await fileToBase64(file);
      await ghApi(imgPath, 'PUT', { message: 'Upload image ' + imgPath, content: b64 });
      finalImages.push('/' + imgPath);
    }
    status.innerText = '위험성평가 문서 저장 중...';
    let imgYaml = '';
    if (finalImages.length > 0) {
      imgYaml = 'assessment_images:\n' + finalImages.map(function(img) { return '  - "' + img + '"'; }).join('\n') + '\n';
    }
    const dash = '\x2d\x2d\x2d';
    const mdContent = dash + '\nlayout: post\ncompany: "' + company + '"\ntitle: "' + title + '"\nwork_type: "' + workType + '"\ndate: ' + date + '\n' + imgYaml + dash + '\n\n' + body + '\n';
    const editPath = document.getElementById('editPath').value;
    const editSha = document.getElementById('editSha').value;
    const targetPath = editPath || ('_posts/' + date + '-' + Date.now() + '.md');
    const payload = { message: 'Save post ' + title, content: encodeB64(mdContent) };
    if (editSha) payload.sha = editSha;
    await ghApi(targetPath, 'PUT', payload);
    status.innerText = '저장 완료! 약 1분 뒤 홈페이지에 반영됩니다.';
    resetForm();
    await loadPosts();
  } catch (e) {
    alert('저장 중 오류가 발생했습니다: ' + e.message);
    status.innerText = '';
  } finally {
    btn.disabled = false;
  }
}

async function deleteFile(path, sha, type) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  await ghApi(path, 'DELETE', { message: 'Delete ' + path, sha: sha });
  alert('삭제되었습니다.');
  if (type === 'company') loadCompanies();
  else loadPosts();
}

initAdmin();
