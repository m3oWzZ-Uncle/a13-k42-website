import { createClient } from '@supabase/supabase-js';
import { authConfig } from './auth-config.js';

const $ = (selector) => document.querySelector(selector);
const containers = { memory: $('.albums'), milestone: $('.timeline'), note: $('.note-grid') };
const login = $('#login-button');
const logout = $('#logout-button');
const accountName = $('#account-name');
const adminTools = $('#admin-tools');
let client, user, profile, generation = 0, entries = [], refreshTimer;
const status = (text) => { $('#account-message').textContent = text; };
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function check(result) { if (result.error) throw result.error; return result.data; }
function errorText(error) {
  console.error('A13-K42:', error);
  if (/last admin/i.test(error?.message || '')) return 'Cần giữ ít nhất một admin. Hãy cấp quyền cho người khác trước.';
  if (/42501|403/.test(String(error?.code || error?.status || '')) || /permission|row.level|admin access/i.test(error?.message || '')) {
    return 'Tài khoản không có quyền thực hiện thao tác này. Hãy tải lại trang để cập nhật quyền.';
  }
  return 'Không thể hoàn tất. Kiểm tra kết nối và thử lại; nội dung đang nhập vẫn được giữ.';
}
function clearContent(message) {
  for (const container of Object.values(containers)) {
    container.replaceChildren(element('p', message, 'empty-state'));
  }
}
function hideManagement(closeDialogs = false) {
  adminTools.hidden = true;
  document.querySelectorAll('.entry-actions').forEach(node => node.remove());
  if (closeDialogs) document.querySelectorAll('dialog[open]').forEach(node => { node.close(); node.remove(); });
}
function dialog(title) {
  const modal = element('dialog', undefined, 'entry-dialog');
  const header = element('div', undefined, 'dialog-head');
  const close = element('button', 'Đóng');
  close.type = 'button';
  close.addEventListener('click', () => modal.close());
  header.append(element('h2', title), close);
  modal.append(header);
  modal.addEventListener('close', () => modal.remove());
  document.body.append(modal);
  return modal;
}
function field(form, title, tag, attributes, value = '') {
  const label = element('label', title);
  const input = element(tag);
  for (const [key, item] of Object.entries(attributes)) input.setAttribute(key, item);
  input.value = value;
  label.append(input); form.append(label);
  return input;
}
function actions(entry) {
  const group = element('div', undefined, 'entry-actions');
  const edit = element('button', 'Sửa');
  edit.addEventListener('click', () => editEntry(entry));
  const remove = element('button', 'Xóa');
  remove.addEventListener('click', async () => {
    if (!confirm(`Xóa kỷ niệm “${entry.title}”?`)) return;
    remove.disabled = true;
    try {
      const removed = check(await client.from('entries').delete().eq('id', entry.id).select('id'));
      if (!removed?.length) throw { code: '42501' };
      let cleanupFailed = false;
      if (entry.image_path) {
        const { error } = await client.storage.from('class-photos').remove([entry.image_path]);
        cleanupFailed = Boolean(error);
      }
      await refresh();
      status(cleanupFailed ? 'Đã xóa bài. Ảnh cũ chưa xóa được khỏi kho lưu trữ.' : 'Đã xóa kỷ niệm.');
    } catch (error) { status(errorText(error)); remove.disabled = false; }
  });
  group.append(edit, remove); return group;
}
async function refresh() {
  const revision = ++generation;
  hideManagement();
  profile = null;
  try {
    const { session } = check(await client.auth.getSession());
    if (revision !== generation) return;
    user = session?.user || null;
    login.hidden = Boolean(user); logout.hidden = !user; accountName.hidden = !user;
    if (!user) { hideManagement(true); clearContent('Đăng nhập Google để xem kỷ niệm của lớp.'); accountName.textContent = ''; return; }
    clearContent('Đang tải kỷ niệm…');
    const member = check(await client.from('profiles').select('id,display_name,email,role').eq('id', user.id).single());
    const records = check(await client.from('entries').select('*').order('created_at', { ascending: false }));
    if (revision !== generation) return;
    profile = member; entries = records;
    if (member.role !== 'admin') hideManagement(true);
    accountName.textContent = `${member.display_name || member.email} · ${member.role === 'admin' ? 'Admin' : 'Chỉ xem'}`;
    adminTools.hidden = member.role !== 'admin';
    for (const container of Object.values(containers)) container.replaceChildren();
    for (const entry of records) {
      const card = element('article', undefined, entry.kind === 'note' ? 'entry-card entry-note' : 'entry-card');
      if (entry.image_path) {
        const result = await client.storage.from('class-photos').createSignedUrl(entry.image_path, 3600);
        if (revision !== generation) return;
        if (result.error) card.append(element('p', 'Ảnh tạm thời chưa tải được.', 'form-help'));
        else {
          const image = element('img', undefined, 'entry-photo');
          image.src = result.data.signedUrl; image.alt = entry.title; image.loading = 'lazy';
          image.addEventListener('error', () => { image.replaceWith(element('p', 'Ảnh tạm thời chưa tải được.', 'form-help')); }, { once: true });
          card.append(image);
        }
      }
      card.append(element('h3', entry.title), element('p', entry.body, 'entry-body'));
      if (entry.happened_on) {
        const date = element('time', new Date(entry.happened_on + 'T00:00:00').toLocaleDateString('vi-VN'), 'entry-date');
        date.dateTime = entry.happened_on; card.append(date);
      }
      if (member.role === 'admin') card.append(actions(entry));
      containers[entry.kind].append(card);
    }
    for (const [kind, container] of Object.entries(containers)) {
      if (!records.some(entry => entry.kind === kind)) container.append(element('p', 'Chưa có nội dung. Những trang ký ức đang chờ được viết.', 'empty-state'));
    }
    status('');
  } catch (error) {
    if (revision !== generation) return;
    profile = null; hideManagement(); clearContent('Chưa tải được kỷ niệm. Hãy tải lại trang để thử lại.'); status(errorText(error));
  }
}
async function validatePhoto(file) {
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!extensions[file.type] || file.size > 10 * 1024 * 1024) throw new Error('Ảnh cần là JPG, PNG hoặc WebP và tối đa 10 MB.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('File không phải ảnh hợp lệ.'); }
  const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width * bitmap.height <= 50000000;
  bitmap.close();
  if (!valid) throw new Error('Ảnh quá lớn. Hãy giảm kích thước ảnh rồi thử lại.');
  return extensions[file.type];
}
function editEntry(entry) {
  if (profile?.role !== 'admin') return;
  const modal = dialog(entry ? 'Sửa kỷ niệm' : 'Thêm một trang ký ức');
  const form = element('form');
  const kind = field(form, 'Loại nội dung', 'select', { required: '' });
  for (const [value, text] of [['memory','Ảnh / kỷ niệm'],['milestone','Dấu mốc'],['note','Lưu bút']]) {
    const option = element('option', text); option.value = value; kind.append(option);
  }
  kind.value = entry?.kind || 'memory';
  const title = field(form, 'Tiêu đề', 'input', { required: '', maxlength: '160' }, entry?.title || '');
  const body = field(form, 'Câu chuyện / lời nhắn', 'textarea', { maxlength: '10000' }, entry?.body || '');
  const date = field(form, 'Ngày kỷ niệm (không bắt buộc)', 'input', { type: 'date' }, entry?.happened_on || '');
  const photo = field(form, 'Ảnh (không bắt buộc)', 'input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
  form.append(element('p', entry?.image_path ? 'Để trống để giữ ảnh cũ. Chọn ảnh mới để thay thế (JPG/PNG/WebP, tối đa 10 MB).' : 'JPG, PNG hoặc WebP; tối đa 10 MB.', 'form-help'));
  let removePhoto;
  if (entry?.image_path) {
    removePhoto = field(form, 'Xóa ảnh hiện tại', 'select', {});
    for (const [value,text] of [['keep','Giữ ảnh'],['remove','Xóa ảnh']]) { const option = element('option',text); option.value=value; removePhoto.append(option); }
  }
  const errorBox = element('p', '', 'form-error'); errorBox.setAttribute('role','alert');
  const save = element('button', 'Lưu kỷ niệm'); save.type = 'submit';
  const controls = element('div', undefined, 'dialog-actions'); controls.append(save);
  form.append(errorBox, controls); modal.append(form); modal.showModal();
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (save.disabled) return;
    errorBox.textContent = ''; save.disabled = true;
    const id = entry?.id || crypto.randomUUID();
    let uploadedPath = null;
    let saved = false;
    try {
      const file = photo.files[0];
      let imagePath = removePhoto?.value === 'remove' ? null : entry?.image_path || null;
      if (file) {
        let extension;
        try { extension = await validatePhoto(file); } catch (error) { errorBox.textContent = error.message; return; }
        uploadedPath = `${user.id}/${id}/${crypto.randomUUID()}.${extension}`;
        check(await client.storage.from('class-photos').upload(uploadedPath, file, { contentType: file.type, upsert: false }));
        imagePath = uploadedPath;
      }
      const data = { kind: kind.value, title: title.value.trim(), body: body.value, happened_on: date.value || null, image_path: imagePath };
      if (!data.title) throw new Error('Empty title');
      const result = entry
        ? await client.from('entries').update(data).eq('id', id).select('id')
        : await client.from('entries').insert({ ...data, id, created_by: user.id }).select('id');
      if (!check(result)?.length) throw { code: '42501' };
      saved = true;
      let cleanupFailed = false;
      if (entry?.image_path && entry.image_path !== imagePath) {
        cleanupFailed = Boolean((await client.storage.from('class-photos').remove([entry.image_path])).error);
      }
      modal.close(); await refresh();
      status(cleanupFailed ? 'Đã lưu kỷ niệm. Ảnh cũ chưa xóa được khỏi kho lưu trữ.' : 'Đã lưu kỷ niệm.');
    } catch (error) {
      if (uploadedPath && !saved) await client.storage.from('class-photos').remove([uploadedPath]);
      errorBox.textContent = errorText(error);
    } finally { save.disabled = false; }
  });
}
async function manageMembers() {
  if (profile?.role !== 'admin') return;
  const modal = dialog('Quản lý quyền thành viên');
  const box = element('div');
  const errorBox = element('p', '', 'form-error'); errorBox.setAttribute('role','alert');
  modal.append(element('p', 'Tài khoản mới chỉ được xem. Admin có thể quản lý nội dung và cấp hoặc thu hồi quyền admin.', 'form-help'), box, errorBox);
  modal.showModal();
  try {
    const members = check(await client.from('profiles').select('id,email,display_name,role').order('created_at'));
    for (const member of members) {
      const row = element('div', undefined, 'member-row');
      const detail = element('div');
      detail.append(element('p', member.display_name || member.email), element('small', `${member.email} · ${member.role === 'admin' ? 'Admin' : 'Chỉ xem'}`));
      const button = element('button', member.role === 'admin' ? 'Chuyển sang chỉ xem' : 'Cấp quyền admin');
      button.addEventListener('click', async () => {
        const role = member.role === 'admin' ? 'viewer' : 'admin';
        if (!confirm(`${role === 'admin' ? 'Cấp toàn quyền admin cho' : 'Thu hồi quyền admin của'} ${member.email}?`)) return;
        button.disabled = true; errorBox.textContent = '';
        try {
          check(await client.rpc('set_member_role', { target_user: member.id, new_role: role }));
          modal.close(); await refresh();
          if (profile?.role === 'admin') await manageMembers();
          status('Đã cập nhật quyền tài khoản.');
        } catch (error) { errorBox.textContent = errorText(error); button.disabled = false; }
      });
      row.append(detail, button); box.append(row);
    }
  } catch (error) { errorBox.textContent = errorText(error); }
}
$('#add-entry').addEventListener('click', () => editEntry());
$('#manage-members').addEventListener('click', manageMembers);
if (!authConfig.url || !authConfig.key) {
  login.disabled = true;
  status('Đăng nhập Google đang được kết nối. Kỷ niệm riêng của lớp sẽ mở sau khi đăng nhập.');
} else {
  client = createClient(authConfig.url, authConfig.key, { auth: { flowType: 'pkce', detectSessionInUrl: true } });
  login.addEventListener('click', async () => {
    login.disabled = true;
    try {
      check(await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('/', location.origin).href } }));
    } catch (error) { status(errorText(error)); login.disabled = false; }
  });
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try { check(await client.auth.signOut()); await refresh(); }
    catch (error) { status(errorText(error)); }
    finally { logout.disabled = false; }
  });
  // Defer SDK calls outside its auth-state callback to avoid a session lock.
  client.auth.onAuthStateChange((event, session) => {
    generation++; hideManagement(event === 'SIGNED_OUT' || Boolean(user && session?.user?.id !== user.id)); clearContent('Đang cập nhật tài khoản…');
    clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 0);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !document.querySelector('dialog[open]')) refresh(); });
  setInterval(() => { if (user && !document.hidden && !document.querySelector('dialog[open]')) refresh(); }, 10 * 60 * 1000);
  const oauthError = new URLSearchParams(location.hash.slice(1)).get('error_description') || new URLSearchParams(location.search).get('error_description');
  if (oauthError) { status('Đăng nhập chưa hoàn tất. Hãy thử lại.'); history.replaceState(null, '', location.pathname); }
  refresh();
}
