/* =========================================================
   JDK COURSE - script.js (FINAL v9)
   Fitur lengkap:
   - Username unik + login email/username
   - Tanggal lahir + jenis kelamin
   - Upload gambar kursus (guru/admin)
   - Notifikasi in-app (bell)
   - Riwayat jadwal murid
   - Laporan admin + export CSV
   - Murid hanya bisa batalkan jadwal (konfirmasi oleh guru)
   - Notifikasi pembatalan dua arah (murid ↔ guru)
   ========================================================= */

const DB_KEY = 'jdk_course_db_v9';
const SESSION_KEY = 'jdk_course_session_v1';

const DAYS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
const LEVELS = ['Pemula','Menengah','Lanjutan'];
const GENDERS = ['Laki-laki','Perempuan'];

/* =========================================================
   HASH PASSWORD
   ========================================================= */
function generateSalt(){ return Math.random().toString(36).slice(2, 14); }
function simpleHash(str){
  let h1 = 0x811c9dc5, h2 = 0x1000193;
  for(let i=0;i<str.length;i++){
    const c = str.charCodeAt(i);
    h1 ^= c; h1 = (h1 * 0x01000193) >>> 0;
    h2 = ((h2 << 5) - h2 + c) >>> 0;
  }
  return h1.toString(16).padStart(8,'0') + h2.toString(16).padStart(8,'0');
}
function hashPassword(password, salt){
  let out = simpleHash(salt + password + salt);
  for(let i=0;i<3;i++) out = simpleHash(out + salt);
  return out;
}
function verifyPassword(password, salt, hash){
  return hashPassword(password, salt) === hash;
}

/* =========================================================
   GAMBAR: resize + convert ke base64
   ========================================================= */
function resizeImage(file, maxWidth = 800, quality = 0.75){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if(w > maxWidth){
          h = Math.round(h * maxWidth / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleCourseImage(event){
  const file = event.target.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')){ toast('File harus berupa gambar','error'); return; }
  if(file.size > 5 * 1024 * 1024){ toast('Ukuran gambar maksimal 5 MB','error'); return; }
  try{
    const base64 = await resizeImage(file, 800, 0.75);
    document.getElementById('courseImageData').value = base64;
    document.getElementById('imgPreview').src = base64;
    document.getElementById('imgPreview').style.display = 'block';
    document.getElementById('imgPlaceholder').style.display = 'none';
    document.getElementById('btnRemoveImg').style.display = 'inline-flex';
    toast('Gambar berhasil diproses','success');
  } catch(err){
    toast('Gagal memproses gambar','error');
  }
}

function clearCourseImage(){
  document.getElementById('courseImageData').value = '';
  document.getElementById('imgPreview').src = '';
  document.getElementById('imgPreview').style.display = 'none';
  document.getElementById('imgPlaceholder').style.display = 'inline';
  document.getElementById('btnRemoveImg').style.display = 'none';
  document.getElementById('courseImgInput').value = '';
}

/* =========================================================
   TANGGAL LAHIR & UMUR
   ========================================================= */
function hitungUmur(tglLahir){
  if(!tglLahir) return null;
  const birth = new Date(tglLahir);
  if(isNaN(birth.getTime())) return null;
  const now = new Date();
  let umur = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if(m < 0 || (m === 0 && now.getDate() < birth.getDate())) umur--;
  return umur;
}
function fmtTanggalLahir(tgl){
  if(!tgl) return '-';
  const d = new Date(tgl);
  if(isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
}
function isTanggalLahirValid(tgl){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(tgl || '')) return false;
  const d = new Date(tgl);
  if(isNaN(d.getTime())) return false;
  const umur = hitungUmur(tgl);
  if(umur === null) return false;
  return umur >= 5 && umur <= 100;
}

/* =========================================================
   VALIDASI USERNAME
   ========================================================= */
function isUsernameValid(username){
  if(typeof username !== 'string') return false;
  return /^[a-zA-Z0-9_]{3,20}$/.test(username.trim());
}
function isUsernameTaken(username, excludeId=null){
  const t = (username||'').toLowerCase().trim();
  return db.users.some(u => u.id !== excludeId && (u.username||'').toLowerCase() === t);
}

/* =========================================================
   DATABASE
   ========================================================= */
function makeUser(id, name, username, email, password, role, extra={}){
  const salt = generateSalt();
  return {
    id, name, username, email, salt,
    passwordHash: hashPassword(password, salt),
    role,
    tanggalLahir: '2000-01-01',
    jenisKelamin: 'Laki-laki',
    ...extra
  };
}

function seedDB(){
  return {
    nextId: { user:6, category:6, course:7, schedule:9, booking:1, notification:1 },
    users: [
      makeUser(1,'Admin JDK',    'admin',   'admin@jdk.com', 'admin123', 'admin',
        { tanggalLahir:'1994-05-12', jenisKelamin:'Laki-laki' }),
      makeUser(2,'Budi Santoso', 'budi',    'budi@jdk.com',  'guru123',  'guru',
        { tanggalLahir:'1989-03-20', jenisKelamin:'Laki-laki', bio:'Guru Matematika, 10 tahun pengalaman mengajar SMA & Olimpiade.' }),
      makeUser(3,'Siti Aminah',  'siti',    'siti@jdk.com',  'guru123',  'guru',
        { tanggalLahir:'1996-08-15', jenisKelamin:'Perempuan', bio:'Guru Bahasa Inggris, spesialis IELTS & TOEFL.' }),
      makeUser(4,'Andi Pratama', 'andi',    'andi@jdk.com',  'guru123',  'guru',
        { tanggalLahir:'1992-11-08', jenisKelamin:'Laki-laki', bio:'Software Engineer & pengajar Programming untuk pemula.' }),
      makeUser(5,'Rina Wati',    'rina',    'rina@jdk.com',  'murid123', 'murid',
        { tanggalLahir:'2006-02-14', jenisKelamin:'Perempuan' }),
    ],
    categories: [
      { id:1, name:'Matematika' },
      { id:2, name:'Bahasa' },
      { id:3, name:'Programming' },
      { id:4, name:'Musik' },
      { id:5, name:'Desain' },
    ],
    courses: [
      { id:1, title:'Matematika Dasar SMA', categoryId:1, level:'Pemula', guruId:2, price:150000, duration:3, image:'', description:'Kursus matematika dasar untuk siswa SMA kelas 10-12. Materi meliputi aljabar, trigonometri, dan persiapan ujian.' },
      { id:2, title:'Persiapan Olimpiade Matematika', categoryId:1, level:'Lanjutan', guruId:2, price:250000, duration:6, image:'', description:'Pembinaan intensif untuk olimpiade matematika tingkat kabupaten, provinsi, dan nasional.' },
      { id:3, title:'Bahasa Inggris Percakapan', categoryId:2, level:'Pemula', guruId:3, price:180000, duration:3, image:'', description:'Latihan percakapan bahasa Inggris sehari-hari dengan metode komunikatif.' },
      { id:4, title:'IELTS Preparation', categoryId:2, level:'Menengah', guruId:3, price:300000, duration:4, image:'', description:'Persiapan tes IELTS untuk keperluan studi ke luar negeri.' },
      { id:5, title:'Python untuk Pemula', categoryId:3, level:'Pemula', guruId:4, price:200000, duration:3, image:'', description:'Belajar dasar pemrograman Python dari nol: variabel, kontrol alur, fungsi, dan struktur data.' },
      { id:6, title:'Web Development HTML & CSS', categoryId:3, level:'Menengah', guruId:4, price:220000, duration:4, image:'', description:'Membangun website statis modern dengan HTML5 dan CSS3, termasuk layout responsif.' },
    ],
    schedules: [
      { id:1, courseId:1, day:'Senin',  start:'16:00', end:'17:30', quota:5, booked:0 },
      { id:2, courseId:1, day:'Rabu',   start:'16:00', end:'17:30', quota:5, booked:0 },
      { id:3, courseId:3, day:'Selasa', start:'19:00', end:'20:00', quota:8, booked:0 },
      { id:4, courseId:3, day:'Kamis',  start:'19:00', end:'20:00', quota:8, booked:0 },
      { id:5, courseId:5, day:'Sabtu',  start:'09:00', end:'10:30', quota:6, booked:0 },
      { id:6, courseId:5, day:'Minggu', start:'09:00', end:'10:30', quota:6, booked:0 },
      { id:7, courseId:4, day:'Jumat',  start:'18:00', end:'19:30', quota:4, booked:0 },
      { id:8, courseId:6, day:'Sabtu',  start:'13:00', end:'15:00', quota:5, booked:0 },
    ],
    bookings: [],
    notifications: [],
  };
}

function loadDB(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    if(raw){
      const d = JSON.parse(raw);
      if(!d.notifications) d.notifications = [];
      if(!d.nextId.notification) d.nextId.notification = 1;
      if(d.courses) d.courses.forEach(c => { if(typeof c.image === 'undefined') c.image = ''; });
      return d;
    }
  }catch(e){}
  const fresh = seedDB();
  localStorage.setItem(DB_KEY, JSON.stringify(fresh));
  return fresh;
}

function saveDB(){
  try{
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch(e){
    if(e.name === 'QuotaExceededError' || e.code === 22){
      toast('Penyimpanan penuh! Hapus beberapa gambar kursus atau data lama.','error');
    } else {
      toast('Gagal menyimpan data','error');
    }
  }
}

let db = loadDB();
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
let ui = { authTab:'login', adminTab:'users', guruTab:'courses', muridTab:'active' };
let filterState = { q:'', category:'', level:'', day:'' };

/* =========================================================
   HELPERS
   ========================================================= */
function uid(k){ return db.nextId[k]++; }
function currentUser(){ return session ? db.users.find(u=>u.id===session) : null; }
function findUser(id){ return db.users.find(u=>u.id===id); }
function findCategory(id){ return db.categories.find(c=>c.id===id); }
function findCourse(id){ return db.courses.find(c=>c.id===id); }
function findSchedule(id){ return db.schedules.find(s=>s.id===id); }
function coursesByGuru(id){ return db.courses.filter(c=>c.guruId===id); }
function schedulesByCourse(id){ return db.schedules.filter(s=>s.courseId===id); }
function initials(name){ return name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase(); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
function fmtPrice(n){ return 'Rp ' + n.toLocaleString('id-ID'); }
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function timeAgo(iso){
  const diff = (Date.now() - new Date(iso)) / 1000;
  if(diff < 60) return 'Baru saja';
  if(diff < 3600) return Math.floor(diff/60) + ' menit lalu';
  if(diff < 86400) return Math.floor(diff/3600) + ' jam lalu';
  return Math.floor(diff/86400) + ' hari lalu';
}

function isEmailValid(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function isNameValid(n){ return typeof n === 'string' && n.trim().length >= 3; }
function isPasswordValid(p){ return typeof p === 'string' && p.length >= 6; }
function isPositiveNumber(n){ return !isNaN(n) && Number(n) > 0; }
function isGenderValid(g){ return GENDERS.includes(g); }

function findUserByLogin(input){
  const t = String(input||'').toLowerCase().trim();
  if(!t) return null;
  return db.users.find(u =>
    u.email.toLowerCase() === t ||
    (u.username && u.username.toLowerCase() === t)
  );
}

function toast(msg, type='info'){
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.3s'; }, 2200);
  setTimeout(()=>el.remove(), 2600);
}

function go(hash){ location.hash = hash; }
function logout(){
  session = null;
  localStorage.removeItem(SESSION_KEY);
  toast('Berhasil logout','info');
  go('#/');
  render();
}

/* =========================================================
   NOTIFIKASI
   ========================================================= */
function addNotification(userId, message, type='info'){
  if(!userId) return;
  db.notifications.push({
    id: uid('notification'),
    userId, message, type,
    read: false,
    createdAt: new Date().toISOString(),
  });
  saveDB();
}
function unreadCount(userId){
  return db.notifications.filter(n => n.userId === userId && !n.read).length;
}
function markAllRead(userId){
  db.notifications.filter(n => n.userId === userId).forEach(n => n.read = true);
  saveDB();
}
function markAllReadAndRefresh(){
  const user = currentUser();
  if(!user) return;
  markAllRead(user.id);
  closeNotifPanel();
  render();
}
function toggleNotifPanel(e){
  if(e) e.stopPropagation();
  const panel = document.getElementById('notifPanel');
  if(panel){ panel.remove(); return; }
  const user = currentUser();
  if(!user) return;

  const notifs = db.notifications
    .filter(n => n.userId === user.id)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 30);

  const div = document.createElement('div');
  div.id = 'notifPanel';
  div.className = 'notif-panel';
  div.onclick = (ev) => ev.stopPropagation();
  div.innerHTML = `
    <div class="notif-header">
      <b>🔔 Notifikasi</b>
      ${notifs.some(n=>!n.read) ? `<button class="btn btn-outline btn-sm" onclick="markAllReadAndRefresh()">Tandai Dibaca</button>` : ''}
    </div>
    <div class="notif-list">
      ${notifs.length === 0
        ? `<div style="text-align:center;padding:30px 20px;color:var(--gray-500)">
            <div style="font-size:32px;margin-bottom:8px">📭</div>
            <p>Belum ada notifikasi</p>
          </div>`
        : notifs.map(n => `
          <div class="notif-item ${n.read ? '' : 'unread'}">
            <div>${escapeHtml(n.message)}</div>
            <div class="time">${timeAgo(n.createdAt)}</div>
          </div>`).join('')}
    </div>
  `;
  document.body.appendChild(div);
}
function closeNotifPanel(){
  const p = document.getElementById('notifPanel');
  if(p) p.remove();
}
document.addEventListener('click', () => closeNotifPanel());

/* =========================================================
   ROUTER
   ========================================================= */
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

function render(){
  renderNav();
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  const app = document.getElementById('app');
  const user = currentUser();

  if((parts[0]==='bookings' || parts[0]==='guru' || parts[0]==='admin') && !user){
    app.innerHTML = cardNotLoggedIn(); return;
  }
  if(parts[0]==='guru' && user.role!=='guru' && user.role!=='admin'){ app.innerHTML = noAccess(); return; }
  if(parts[0]==='admin' && user.role!=='admin'){ app.innerHTML = noAccess(); return; }

  switch(parts[0]){
    case undefined: case '': renderHome(app); break;
    case 'login':    renderAuth(app); break;
    case 'courses':  parts[1] ? renderCourseDetail(app, +parts[1]) : renderCourses(app); break;
    case 'bookings': renderBookings(app); break;
    case 'guru':     renderGuruDash(app); break;
    case 'admin':    renderAdminDash(app); break;
    default:
      app.innerHTML = `<div class="empty"><div class="ico">🔍</div><h3>Halaman tidak ditemukan</h3></div>`;
  }
}
function noAccess(){
  return `<div class="empty"><div class="ico">⛔</div><h3>Akses ditolak</h3>
  <p class="muted">Anda tidak memiliki hak untuk membuka halaman ini.</p></div>`;
}
function cardNotLoggedIn(){
  return `<div class="empty">
    <div class="ico">🔒</div>
    <h3>Silakan login terlebih dahulu</h3>
    <p class="muted" style="margin:10px 0 18px">Halaman ini hanya dapat diakses setelah login.</p>
    <a href="#/login" class="btn btn-primary">Login / Daftar</a>
  </div>`;
}

/* =========================================================
   NAV
   ========================================================= */
function renderNav(){
  const el = document.getElementById('navLinks');
  const user = currentUser();
  const path = (location.hash.replace(/^#/, '') || '/').split('/')[1] || '';
  const active = (p)=> p===path ? 'active' : '';

  if(!user){
    el.innerHTML = `
      <a href="#/" class="${active('')}">Beranda</a>
      <a href="#/courses" class="${active('courses')}">Kursus</a>
      <a href="#/login" class="btn btn-primary btn-sm">Login / Daftar</a>
    `;
    return;
  }
  const roleLink =
    user.role==='admin' ? `<a href="#/admin" class="${active('admin')}">Admin Panel</a>` :
    user.role==='guru'  ? `<a href="#/guru" class="${active('guru')}">Dashboard Guru</a>` :
                          `<a href="#/bookings" class="${active('bookings')}">Jadwal Saya</a>`;

  const unread = unreadCount(user.id);
  el.innerHTML = `
    <a href="#/" class="${active('')}">Beranda</a>
    <a href="#/courses" class="${active('courses')}">Kursus</a>
    ${roleLink}
    <button class="bell-wrap" id="bellIcon" title="Notifikasi" onclick="toggleNotifPanel(event)">
      <span class="bell-icon">🔔</span>
      ${unread > 0 ? `<span class="bell-badge">${unread > 9 ? '9+' : unread}</span>` : ''}
    </button>
    <div class="nav-user">
      <div class="avatar">${initials(user.name)}</div>
      <div class="user-info">
        <b>${escapeHtml(user.name)}</b>
        <small>@${escapeHtml(user.username||'-')} · ${user.role}</small>
      </div>
      <button class="btn btn-outline btn-sm" onclick="logout()">Logout</button>
    </div>
  `;
}

/* =========================================================
   HOME
   ========================================================= */
function renderHome(app){
  const totalKursus = db.courses.length;
  const totalGuru   = db.users.filter(u=>u.role==='guru').length;
  const totalMurid  = db.users.filter(u=>u.role==='murid').length;

  app.innerHTML = `
    <section class="hero">
      <h1>Temukan Kursus yang Tepat, Atur Jadwal Tanpa Bentrok</h1>
      <p>JDK Course menghubungkan murid dengan guru terbaik. Cari kursus sesuai kebutuhan & tingkat kemampuan, lalu pesan jadwal belajar yang tidak bertabrakan dengan aktivitas Anda.</p>
      <div class="row">
        <a href="#/courses" class="btn btn-primary">🔍 Jelajahi Kursus</a>
        ${!currentUser() ? `<a href="#/login" class="btn btn-outline" style="background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.4)">Daftar Sekarang</a>` : ''}
      </div>
    </section>

    <div class="stat-grid">
      <div class="stat"><div class="num">${totalKursus}</div><div class="lbl">Kursus Tersedia</div></div>
      <div class="stat"><div class="num">${totalGuru}</div><div class="lbl">Guru Pengajar</div></div>
      <div class="stat"><div class="num">${totalMurid}</div><div class="lbl">Murid Terdaftar</div></div>
      <div class="stat"><div class="num">${db.categories.length}</div><div class="lbl">Kategori Kursus</div></div>
    </div>

    <div class="between">
      <h2>Kursus Populer</h2>
      <a href="#/courses" class="btn btn-outline btn-sm">Lihat Semua →</a>
    </div>
    <div class="grid">${db.courses.slice(0,3).map(courseCard).join('')}</div>
  `;
}

function courseCard(c){
  const guru = findUser(c.guruId);
  const cat  = findCategory(c.categoryId);
  const scheds = schedulesByCourse(c.id);
  const days = [...new Set(scheds.map(s=>s.day))].join(', ') || '-';
  const levelBadge = c.level==='Pemula' ? 'green' : c.level==='Menengah' ? 'orange' : 'red';

  const thumbStyle = c.image
    ? `background-image:url('${c.image}');background-size:cover;background-position:center;`
    : `background:linear-gradient(135deg,var(--primary),#7c3aed);`;
  const thumbContent = c.image ? '' : escapeHtml(c.title[0]);

  return `
    <a class="course-card" href="#/courses/${c.id}">
      <div class="course-thumb" style="${thumbStyle}">${thumbContent}</div>
      <div class="course-body">
        <h3>${escapeHtml(c.title)}</h3>
        <div class="muted">👨‍🏫 ${escapeHtml(guru?guru.name:'-')}</div>
        <div class="muted">📅 ${escapeHtml(days)}</div>
        <div class="badges">
          <span class="badge gray">${escapeHtml(cat?cat.name:'-')}</span>
          <span class="badge ${levelBadge}">${c.level}</span>
        </div>
        <div class="between" style="margin-top:10px">
          <span class="price">${fmtPrice(c.price)}</span>
          <span class="muted">${c.duration} bulan</span>
        </div>
      </div>
    </a>
  `;
}

/* =========================================================
   AUTH
   ========================================================= */
function renderAuth(app){
  const isLogin = ui.authTab === 'login';
  app.innerHTML = `
    <div class="card auth-card">
      <div class="auth-tabs">
        <button class="${isLogin?'active':''}" onclick="ui.authTab='login';render()">Login</button>
        <button class="${!isLogin?'active':''}" onclick="ui.authTab='register';render()">Daftar</button>
      </div>
      ${isLogin ? loginForm() : registerForm()}
    </div>
  `;
}

function loginForm(){
  return `
    <h3>Masuk ke Akun Anda</h3>
    <p class="muted" style="margin-bottom:16px">Gunakan email atau username yang terdaftar.</p>
    <form onsubmit="handleLogin(event)">
      <div class="form-group">
        <label>Email atau Username</label>
        <input type="text" name="identifier" required placeholder="nama@email.com atau username">
      </div>
      <div class="form-group"><label>Password</label><input type="password" name="password" required placeholder="••••••••"></div>
      <button class="btn btn-primary btn-block" type="submit">Login</button>
    </form>
    <div style="margin-top:16px;padding:12px;background:var(--gray-50);border-radius:8px;font-size:12px;color:var(--gray-500);line-height:1.7">
      <b>Akun demo:</b><br>
      Admin: admin@jdk.com / admin123<br>
      Guru: budi@jdk.com / guru123<br>
      Murid: rina@jdk.com / murid123<br>
      <i>Bisa juga login pakai username: admin / budi / rina</i>
    </div>
  `;
}

function registerForm(){
  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate())
    .toISOString().slice(0,10);
  const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate())
    .toISOString().slice(0,10);

  return `
    <h3>Buat Akun Baru</h3>
    <p class="muted" style="margin-bottom:16px">Lengkapi data diri Anda untuk mendaftar.</p>
    <form onsubmit="handleRegister(event)">
      <div class="form-group">
        <label>Nama Lengkap</label>
        <input type="text" name="name" required minlength="3" placeholder="Nama minimal 3 karakter">
      </div>
      <div class="form-group">
        <label>Username</label>
        <input type="text" name="username" required minlength="3" maxlength="20"
          pattern="[a-zA-Z0-9_]{3,20}"
          title="3-20 karakter, hanya huruf, angka, dan underscore"
          placeholder="contoh: budi_123">
        <small class="muted" style="font-size:11px">3-20 karakter, hanya huruf, angka, dan underscore (_).</small>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" required placeholder="nama@email.com">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" required minlength="6" placeholder="Minimal 6 karakter">
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Tanggal Lahir</label>
          <input type="date" name="tanggalLahir" required min="${minDate}" max="${maxDate}">
        </div>
        <div class="form-group">
          <label>Jenis Kelamin</label>
          <select name="jenisKelamin" required>
            <option value="">-- Pilih --</option>
            <option value="Laki-laki">Laki-laki</option>
            <option value="Perempuan">Perempuan</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Daftar Sebagai</label>
        <select name="role" required>
          <option value="murid">Murid</option>
          <option value="guru">Guru</option>
        </select>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Daftar</button>
    </form>
  `;
}

function handleLogin(e){
  e.preventDefault();
  const f = e.target;
  const identifier = f.identifier.value.trim();
  const pass = f.password.value;

  const user = findUserByLogin(identifier);
  if(!user){ toast('Email/username atau password salah','error'); return; }
  if(!verifyPassword(pass, user.salt, user.passwordHash)){ toast('Email/username atau password salah','error'); return; }

  session = user.id;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  toast('Login berhasil. Selamat datang, '+user.name,'success');
  f.reset(); go('#/'); render();
}

function handleRegister(e){
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  const username = f.username.value.trim();
  const email = f.email.value.trim().toLowerCase();
  const pass = f.password.value;
  const tanggalLahir = f.tanggalLahir.value;
  const jenisKelamin = f.jenisKelamin.value;
  const role = f.role.value;

  if(!isNameValid(name)){ toast('Nama minimal 3 karakter','error'); return; }
  if(!isUsernameValid(username)){ toast('Username 3-20 karakter, hanya huruf, angka, dan underscore','error'); return; }
  if(isUsernameTaken(username)){ toast('Username sudah dipakai, coba yang lain','error'); return; }
  if(!isEmailValid(email)){ toast('Format email tidak valid','error'); return; }
  if(!isPasswordValid(pass)){ toast('Password minimal 6 karakter','error'); return; }
  if(!tanggalLahir){ toast('Tanggal lahir wajib diisi','error'); return; }
  if(!isTanggalLahirValid(tanggalLahir)){ toast('Tanggal lahir tidak valid (umur 5 - 100 tahun)','error'); return; }
  if(!isGenderValid(jenisKelamin)){ toast('Pilih jenis kelamin','error'); return; }
  if(db.users.some(u=>u.email.toLowerCase()===email)){ toast('Email sudah terdaftar','error'); return; }

  const salt = generateSalt();
  const u = {
    id: uid('user'),
    name, username, email, salt,
    passwordHash: hashPassword(pass, salt),
    role,
    tanggalLahir,
    jenisKelamin,
    ...(role === 'guru' ? { bio:'' } : {}),
  };
  db.users.push(u); saveDB();
  session = u.id;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  toast('Registrasi berhasil','success');
  go('#/'); render();
}

/* =========================================================
   COURSES LIST + FILTER
   ========================================================= */
function renderCourses(app){
  const { q, category, level, day } = filterState;
  let list = db.courses.slice();
  if(q){
    const t = q.toLowerCase();
    list = list.filter(c =>
      c.title.toLowerCase().includes(t) ||
      c.description.toLowerCase().includes(t) ||
      (findUser(c.guruId)?.name||'').toLowerCase().includes(t));
  }
  if(category) list = list.filter(c => c.categoryId === +category);
  if(level)    list = list.filter(c => c.level === level);
  if(day)      list = list.filter(c => schedulesByCourse(c.id).some(s=>s.day===day));

  app.innerHTML = `
    <div class="between">
      <div>
        <h1>Jelajahi Kursus</h1>
        <p class="muted">Temukan kursus yang sesuai kebutuhan dan tingkat kemampuan Anda.</p>
      </div>
      <span class="muted">${list.length} kursus ditemukan</span>
    </div>

    <div class="filter-bar" style="margin-top:18px">
      <input placeholder="🔍 Cari kursus, guru, atau topik..." value="${escapeHtml(q)}"
             oninput="filterState.q=this.value;renderCourses(document.getElementById('app'))">
      <select onchange="filterState.category=this.value;renderCourses(document.getElementById('app'))">
        <option value="">Semua Kategori</option>
        ${db.categories.map(c=>`<option value="${c.id}" ${category==c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
      </select>
      <select onchange="filterState.level=this.value;renderCourses(document.getElementById('app'))">
        <option value="">Semua Tingkat</option>
        ${LEVELS.map(l=>`<option ${level===l?'selected':''}>${l}</option>`).join('')}
      </select>
      <select onchange="filterState.day=this.value;renderCourses(document.getElementById('app'))">
        <option value="">Semua Hari</option>
        ${DAYS.map(d=>`<option ${day===d?'selected':''}>${d}</option>`).join('')}
      </select>
    </div>

    ${list.length===0
      ? `<div class="empty"><div class="ico">📭</div><h3>Tidak ada kursus yang cocok</h3><p class="muted">Coba ubah kata kunci atau filter.</p></div>`
      : `<div class="grid">${list.map(courseCard).join('')}</div>`}
  `;
}

/* =========================================================
   COURSE DETAIL
   ========================================================= */
function renderCourseDetail(app, id){
  const c = findCourse(id);
  if(!c){ app.innerHTML = `<div class="empty"><div class="ico">❌</div><h3>Kursus tidak ditemukan</h3></div>`; return; }
  const guru = findUser(c.guruId);
  const cat = findCategory(c.categoryId);
  const scheds = schedulesByCourse(c.id);
  const user = currentUser();
  const levelBadge = c.level==='Pemula' ? 'green' : c.level==='Menengah' ? 'orange' : 'red';
  const umurGuru = guru ? hitungUmur(guru.tanggalLahir) : null;

  const banner = c.image
    ? `<img src="${c.image}" alt="${escapeHtml(c.title)}" style="width:100%;max-height:320px;object-fit:cover;border-radius:12px;margin-bottom:18px;display:block;">`
    : '';

  app.innerHTML = `
    <a href="#/courses" class="btn btn-outline btn-sm" style="margin-bottom:14px">← Kembali</a>
    ${banner}
    <div class="detail-grid">
      <div class="card">
        <div class="badges" style="margin-bottom:10px">
          <span class="badge gray">${escapeHtml(cat?cat.name:'-')}</span>
          <span class="badge ${levelBadge}">${c.level}</span>
        </div>
        <h1>${escapeHtml(c.title)}</h1>
        <p class="muted" style="margin:10px 0 16px">${escapeHtml(c.description)}</p>
        <div class="row" style="gap:20px;font-size:14px;color:var(--gray-700)">
          <span>👨‍🏫 Guru: <b>${escapeHtml(guru?guru.name:'-')}</b></span>
          <span>⏱️ Durasi: <b>${c.duration} bulan</b></span>
          <span>💰 <b class="price">${fmtPrice(c.price)}</b></span>
        </div>
      </div>
      <div class="card">
        <h3>👤 Profil Guru</h3>
        <div class="row" style="align-items:center;margin:10px 0">
          <div class="avatar" style="width:48px;height:48px;font-size:18px">${guru?initials(guru.name):'?'}</div>
          <div>
            <b>${escapeHtml(guru?guru.name:'-')}</b><br>
            <small class="muted">@${escapeHtml(guru?.username||'-')}</small>
          </div>
        </div>
        ${guru ? `
          <div class="muted" style="font-size:13px;margin-bottom:4px">
            🎂 ${fmtTanggalLahir(guru.tanggalLahir)} ${umurGuru !== null ? `(${umurGuru} tahun)` : ''}
          </div>
          <div class="muted" style="font-size:13px;margin-bottom:8px">
            🚻 ${escapeHtml(guru.jenisKelamin || '-')}
          </div>
        ` : ''}
        <p class="muted" style="font-size:13px">${escapeHtml(guru?.bio||'Belum ada deskripsi.')}</p>
      </div>
    </div>

    <h2>📅 Jadwal Tersedia</h2>
    ${scheds.length===0
      ? `<div class="empty"><div class="ico">📭</div><p>Belum ada jadwal untuk kursus ini.</p></div>`
      : scheds.map(s => {
          const sisa = s.quota - s.booked;
          const isFull = sisa <= 0;
          const alreadyBooked = user && db.bookings.some(b =>
            b.muridId===user.id && b.scheduleId===s.id && b.status !== 'cancelled');
          return `
            <div class="sched-item">
              <div class="info">
                <b>${s.day} • ${s.start} - ${s.end}</b>
                <small>Kuota: ${s.booked}/${s.quota} ${isFull?'(Penuh)':`(${sisa} tersisa)`}</small>
              </div>
              <div>
                ${!user ? `<a href="#/login" class="btn btn-outline btn-sm">Login untuk Pesan</a>`
                  : user.role !== 'murid' ? `<span class="muted" style="font-size:13px">Hanya murid yang dapat memesan</span>`
                  : alreadyBooked ? `<span class="badge green">Sudah Dipesan</span>`
                  : isFull ? `<span class="badge red">Penuh</span>`
                  : `<button class="btn btn-primary btn-sm" onclick="bookSchedule(${s.id})">Pesan Jadwal</button>`}
              </div>
            </div>`;
        }).join('')}
  `;
}

/* =========================================================
   BOOKING
   ========================================================= */
function bookSchedule(scheduleId){
  const user = currentUser();
  if(!user || user.role!=='murid'){ toast('Hanya murid yang dapat memesan','error'); return; }
  const s = findSchedule(scheduleId);
  if(!s){ toast('Jadwal tidak ditemukan','error'); return; }

  const myActive = db.bookings.filter(b => b.muridId===user.id && b.status!=='cancelled');
  const bentrok = myActive.some(b => {
    const bs = findSchedule(b.scheduleId);
    if(!bs) return false;
    return bs.day===s.day && overlaps(bs.start, bs.end, s.start, s.end);
  });
  if(bentrok){ toast('Jadwal bentrok dengan pesanan Anda yang lain','error'); return; }
  if(s.booked >= s.quota){ toast('Kuota jadwal sudah penuh','error'); return; }

  const booking = {
    id: uid('booking'),
    muridId: user.id,
    courseId: s.courseId,
    scheduleId: s.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.bookings.push(booking);
  s.booked++;

  const c = findCourse(s.courseId);
  addNotification(c.guruId,
    `📩 ${user.name} (@${user.username}) memesan jadwal ${s.day} ${s.start}-${s.end} untuk kursus "${c.title}". Menunggu konfirmasi Anda.`,
    'info');

  saveDB();
  toast('Jadwal berhasil dipesan. Menunggu konfirmasi guru.','success');
  render();
}
function overlaps(s1,e1,s2,e2){ return s1 < e2 && s2 < e1; }

/* =========================================================
   BOOKINGS (MURID) — HANYA tombol Batalkan
   ========================================================= */
function renderBookings(app){
  const user = currentUser();
  const tab = ui.muridTab || 'active';
  const all = db.bookings.filter(b => b.muridId === user.id);
  const active = all.filter(b => b.status !== 'cancelled')
                    .sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  const history = all.filter(b => b.status === 'cancelled')
                     .sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  const list = tab === 'active' ? active : history;

  app.innerHTML = `
    <h1>📅 Jadwal Belajar Saya</h1>
    <p class="muted" style="margin-bottom:16px">Jadwal berstatus <b>Menunggu</b> akan dikonfirmasi oleh guru. Anda hanya dapat membatalkan jadwal.</p>

    <div class="subtabs">
      <button class="${tab==='active'?'active':''}" onclick="ui.muridTab='active';render()">
        Aktif (${active.length})
      </button>
      <button class="${tab==='history'?'active':''}" onclick="ui.muridTab='history';render()">
        Riwayat (${history.length})
      </button>
    </div>

    ${list.length===0
      ? (tab === 'active'
        ? `<div class="empty"><div class="ico">📭</div><h3>Belum ada jadwal aktif</h3>
           <p class="muted" style="margin:10px 0 16px">Mulai cari kursus dan pesan jadwal belajar.</p>
           <a href="#/courses" class="btn btn-primary">Jelajahi Kursus</a></div>`
        : `<div class="empty"><div class="ico">📜</div><h3>Belum ada riwayat</h3>
           <p class="muted">Jadwal yang dibatalkan akan muncul di sini.</p></div>`)
      : `<div class="table-wrap"><table>
          <thead><tr>
            <th>Kursus</th><th>Guru</th><th>Hari</th><th>Jam</th><th>Status</th><th>Aksi</th>
          </tr></thead>
          <tbody>
          ${list.map(b=>{
            const c = findCourse(b.courseId);
            const s = findSchedule(b.scheduleId);
            const g = c ? findUser(c.guruId) : null;
            return `<tr>
              <td><b>${escapeHtml(c?c.title:'-')}</b></td>
              <td>${escapeHtml(g?g.name:'-')}</td>
              <td>${escapeHtml(s?s.day:'-')}</td>
              <td>${escapeHtml(s?(s.start+'-'+s.end):'-')}</td>
              <td>${statusBadge(b.status)}</td>
              <td style="white-space:nowrap">
                ${b.status==='pending' || b.status==='confirmed'
                  ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id})">Batalkan</button>`
                  : `<span class="muted">-</span>`}
              </td>
            </tr>`;
          }).join('')}
          </tbody>
        </table></div>`}
  `;
}

function statusBadge(s){
  const map = { pending:'orange', confirmed:'green', cancelled:'red' };
  const lbl = { pending:'Menunggu', confirmed:'Dikonfirmasi', cancelled:'Dibatalkan' };
  return `<span class="badge ${map[s]}">${lbl[s]}</span>`;
}

/* =========================================================
   CANCEL — notifikasi dua arah
   ========================================================= */
function cancelBooking(id){
  const b = db.bookings.find(x=>x.id===id);
  if(!b) return;
  if(!confirm('Yakin ingin membatalkan jadwal ini?')) return;

  const actor = currentUser();
  const murid = findUser(b.muridId);
  const c     = findCourse(b.courseId);
  const s     = findSchedule(b.scheduleId);
  const guru  = c ? findUser(c.guruId) : null;

  b.status = 'cancelled';
  if(s && s.booked>0) s.booked--;

  const jadwal = s ? `${s.day} ${s.start}-${s.end}` : '-';
  const kursus = c ? c.title : '-';

  if(actor && murid && actor.id === murid.id){
    // Murid batalkan → notif ke GURU
    if(guru){
      addNotification(guru.id,
        `❌ ${murid.name} (@${murid.username}) membatalkan jadwal ${jadwal} untuk kursus "${kursus}".`,
        'warning');
    }
  } else if(actor && guru && actor.id === guru.id){
    // Guru batalkan → notif ke MURID
    if(murid){
      addNotification(murid.id,
        `❌ Jadwal Anda untuk "${kursus}" (${jadwal}) telah dibatalkan oleh ${guru.name} (@${guru.username}).`,
        'warning');
    }
  } else if(actor && actor.role === 'admin'){
    // Admin batalkan → notif ke MURID dan GURU
    if(murid){
      addNotification(murid.id,
        `❌ Jadwal Anda untuk "${kursus}" (${jadwal}) dibatalkan oleh admin.`,
        'warning');
    }
    if(guru){
      addNotification(guru.id,
        `❌ Jadwal ${murid ? murid.name : 'murid'} untuk "${kursus}" (${jadwal}) dibatalkan oleh admin.`,
        'warning');
    }
  }

  saveDB();
  toast('Jadwal dibatalkan','info');
  render();
}

/* =========================================================
   CONFIRM — oleh guru
   ========================================================= */
function confirmBooking(id){
  const b = db.bookings.find(x=>x.id===id);
  if(!b) return;
  b.status = 'confirmed';

  const c = findCourse(b.courseId);
  const s = findSchedule(b.scheduleId);
  const g = c ? findUser(c.guruId) : null;
  if(c && s){
    addNotification(b.muridId,
      `✅ Jadwal Anda untuk "${c.title}" (${s.day} ${s.start}-${s.end}) telah dikonfirmasi oleh ${g?g.name:'guru'}.`,
      'success');
  }
  saveDB();
  toast('Jadwal dikonfirmasi','success');
  render();
}

/* =========================================================
   GURU DASHBOARD
   ========================================================= */
function renderGuruDash(app){
  const user = currentUser();
  const tab = ui.guruTab;
  const myCourses = coursesByGuru(user.id);
  const myCourseIds = myCourses.map(c=>c.id);
  const myBookings = db.bookings.filter(b => myCourseIds.includes(b.courseId));

  app.innerHTML = `
    <h1>Dashboard Guru</h1>
    <p class="muted" style="margin-bottom:16px">Kelola kursus, jadwal, dan konfirmasi pemesanan murid.</p>

    <div class="stat-grid">
      <div class="stat"><div class="num">${myCourses.length}</div><div class="lbl">Kursus Saya</div></div>
      <div class="stat"><div class="num">${db.schedules.filter(s=>myCourseIds.includes(s.courseId)).length}</div><div class="lbl">Jadwal</div></div>
      <div class="stat"><div class="num">${myBookings.filter(b=>b.status==='pending').length}</div><div class="lbl">Menunggu Konfirmasi</div></div>
      <div class="stat"><div class="num">${myBookings.filter(b=>b.status==='confirmed').length}</div><div class="lbl">Terkonfirmasi</div></div>
    </div>

    <div class="tabs">
      <button class="${tab==='courses'?'active':''}" onclick="ui.guruTab='courses';render()">Kursus Saya</button>
      <button class="${tab==='schedules'?'active':''}" onclick="ui.guruTab='schedules';render()">Jadwal</button>
      <button class="${tab==='bookings'?'active':''}" onclick="ui.guruTab='bookings';render()">Pemesanan Murid</button>
      <button class="${tab==='profile'?'active':''}" onclick="ui.guruTab='profile';render()">Profil Saya</button>
    </div>

    <div>${renderGuruTab(tab, myCourses, myCourseIds, myBookings)}</div>
  `;
}

function renderGuruTab(tab, myCourses, myCourseIds, myBookings){
  if(tab==='courses'){
    return `
      <div class="between" style="margin-bottom:12px">
        <h3>Daftar Kursus</h3>
        <button class="btn btn-primary btn-sm" onclick="openCourseForm()">+ Tambah Kursus</button>
      </div>
      ${myCourses.length===0
        ? `<div class="empty"><div class="ico">📚</div><p>Belum ada kursus. Tambahkan kursus pertama Anda.</p></div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>Gambar</th><th>Judul</th><th>Kategori</th><th>Tingkat</th><th>Durasi</th><th>Harga</th><th>Aksi</th></tr></thead>
            <tbody>
              ${myCourses.map(c=>`
                <tr>
                  <td>${c.image
                    ? `<img src="${c.image}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;">`
                    : `<div style="width:50px;height:50px;border-radius:6px;background:linear-gradient(135deg,var(--primary),#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;">${escapeHtml(c.title[0])}</div>`}
                  </td>
                  <td><b>${escapeHtml(c.title)}</b></td>
                  <td>${escapeHtml(findCategory(c.categoryId)?.name||'-')}</td>
                  <td>${c.level}</td>
                  <td>${c.duration} bulan</td>
                  <td>${fmtPrice(c.price)}</td>
                  <td>
                    <button class="btn btn-outline btn-sm" onclick="openCourseForm(${c.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCourse(${c.id})">Hapus</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table></div>`}
    `;
  }

  if(tab==='schedules'){
    return `
      <div class="between" style="margin-bottom:12px">
        <h3>Jadwal Kursus</h3>
        ${myCourses.length>0 ? `<button class="btn btn-primary btn-sm" onclick="openScheduleForm()">+ Tambah Jadwal</button>` : ''}
      </div>
      ${myCourses.length===0
        ? `<div class="empty"><div class="ico">📅</div><p>Tambahkan kursus terlebih dahulu sebelum membuat jadwal.</p></div>`
        : renderScheduleTable(myCourses)}
    `;
  }

  if(tab==='bookings'){
    const pending = myBookings.filter(b=>b.status==='pending');
    const confirmed = myBookings.filter(b=>b.status==='confirmed');
    const cancelled = myBookings.filter(b=>b.status==='cancelled');
    return `
      <div class="subtabs">
        <button onclick="ui.guruBookTab='pending';render()" class="${(ui.guruBookTab||'pending')==='pending'?'active':''}">
          Menunggu (${pending.length})
        </button>
        <button onclick="ui.guruBookTab='confirmed';render()" class="${ui.guruBookTab==='confirmed'?'active':''}">
          Terkonfirmasi (${confirmed.length})
        </button>
        <button onclick="ui.guruBookTab='cancelled';render()" class="${ui.guruBookTab==='cancelled'?'active':''}">
          Dibatalkan (${cancelled.length})
        </button>
      </div>
      ${renderGuruBookingTable()}
    `;
  }

  if(tab==='profile'){
    const user = currentUser();
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate())
      .toISOString().slice(0,10);
    const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate())
      .toISOString().slice(0,10);
    return `
      <div class="card" style="max-width:600px">
        <h3>Profil Guru</h3>
        <p class="muted" style="margin:6px 0 16px">Perbarui informasi profil Anda yang akan ditampilkan pada halaman detail kursus.</p>
        <form onsubmit="saveGuruProfile(event)">
          <div class="form-group"><label>Nama Lengkap</label>
            <input name="name" required minlength="3" value="${escapeHtml(user.name)}"></div>
          <div class="form-group"><label>Username</label>
            <input type="text" name="username" required minlength="3" maxlength="20"
              pattern="[a-zA-Z0-9_]{3,20}"
              title="3-20 karakter, hanya huruf, angka, dan underscore"
              value="${escapeHtml(user.username||'')}">
            <small class="muted" style="font-size:11px">3-20 karakter, hanya huruf, angka, dan underscore (_).</small></div>
          <div class="form-group"><label>Email</label>
            <input type="email" name="email" required value="${escapeHtml(user.email)}"></div>
          <div class="form-grid">
            <div class="form-group"><label>Tanggal Lahir</label>
              <input type="date" name="tanggalLahir" required min="${minDate}" max="${maxDate}"
                value="${user.tanggalLahir||''}"></div>
            <div class="form-group"><label>Jenis Kelamin</label>
              <select name="jenisKelamin" required>
                ${GENDERS.map(g=>`<option ${user.jenisKelamin===g?'selected':''}>${g}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group"><label>Bio / Keahlian</label>
            <textarea name="bio" placeholder="Deskripsikan keahlian dan pengalaman Anda...">${escapeHtml(user.bio||'')}</textarea></div>
          <button class="btn btn-primary" type="submit">Simpan Perubahan</button>
        </form>
      </div>
    `;
  }
}

function renderGuruBookingTable(){
  const user = currentUser();
  const myCourses = coursesByGuru(user.id);
  const ids = myCourses.map(c=>c.id);
  const tab = ui.guruBookTab || 'pending';
  const list = db.bookings.filter(b => ids.includes(b.courseId) && b.status === tab);

  if(list.length === 0){
    return `<div class="empty"><div class="ico">📭</div><p>Tidak ada pemesanan pada kategori ini.</p></div>`;
  }
  return `<div class="table-wrap"><table>
    <thead><tr><th>Murid</th><th>Kursus</th><th>Hari</th><th>Jam</th><th>Status</th><th>Dipesan pada</th><th>Aksi</th></tr></thead>
    <tbody>
    ${list.map(b=>{
      const m = findUser(b.muridId);
      const c = findCourse(b.courseId);
      const s = findSchedule(b.scheduleId);
      return `<tr>
        <td>${escapeHtml(m?m.name:'-')}<br><small class="muted">@${escapeHtml(m?.username||'-')}</small></td>
        <td>${escapeHtml(c?c.title:'-')}</td>
        <td>${escapeHtml(s?s.day:'-')}</td>
        <td>${escapeHtml(s?(s.start+'-'+s.end):'-')}</td>
        <td>${statusBadge(b.status)}</td>
        <td><small class="muted">${fmtDate(b.createdAt)}</small></td>
        <td style="white-space:nowrap">
          ${b.status==='pending'
            ? `<button class="btn btn-success btn-sm" onclick="confirmBooking(${b.id})">Konfirmasi</button>
               <button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id})">Tolak</button>`
            : b.status==='confirmed'
            ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id})">Batalkan</button>`
            : `<span class="muted">-</span>`}
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table></div>`;
}

function saveGuruProfile(e){
  e.preventDefault();
  const f = e.target;
  const user = currentUser();
  const name = f.name.value.trim();
  const username = f.username.value.trim();
  const email = f.email.value.trim().toLowerCase();
  const tanggalLahir = f.tanggalLahir.value;
  const jenisKelamin = f.jenisKelamin.value;
  const bio = f.bio.value.trim();

  if(!isNameValid(name)){ toast('Nama minimal 3 karakter','error'); return; }
  if(!isUsernameValid(username)){ toast('Username 3-20 karakter (huruf/angka/underscore)','error'); return; }
  if(isUsernameTaken(username, user.id)){ toast('Username sudah dipakai pengguna lain','error'); return; }
  if(!isEmailValid(email)){ toast('Format email tidak valid','error'); return; }
  if(!isTanggalLahirValid(tanggalLahir)){ toast('Tanggal lahir tidak valid','error'); return; }
  if(!isGenderValid(jenisKelamin)){ toast('Pilih jenis kelamin','error'); return; }
  if(db.users.some(u => u.email.toLowerCase()===email && u.id!==user.id)){
    toast('Email sudah dipakai pengguna lain','error'); return;
  }
  user.name = name;
  user.username = username;
  user.email = email;
  user.tanggalLahir = tanggalLahir;
  user.jenisKelamin = jenisKelamin;
  user.bio = bio;
  saveDB();
  toast('Profil diperbarui','success');
  render();
}

function renderScheduleTable(courses){
  const ids = courses.map(c=>c.id);
  const scheds = db.schedules.filter(s=>ids.includes(s.courseId));
  if(scheds.length===0){
    return `<div class="empty"><div class="ico">📅</div><p>Belum ada jadwal. Tambahkan jadwal baru.</p></div>`;
  }
  return `<div class="table-wrap"><table>
    <thead><tr><th>Kursus</th><th>Hari</th><th>Jam</th><th>Kuota</th><th>Aksi</th></tr></thead>
    <tbody>
      ${scheds.map(s=>{
        const c = findCourse(s.courseId);
        return `<tr>
          <td>${escapeHtml(c?c.title:'-')}</td>
          <td>${s.day}</td>
          <td>${s.start} - ${s.end}</td>
          <td>${s.booked}/${s.quota}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="openScheduleForm(${s.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteSchedule(${s.id})">Hapus</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;
}

/* =========================================================
   MODAL COURSE (dengan upload gambar)
   ========================================================= */
function openCourseForm(id){
  const editing = id ? findCourse(id) : null;
  const user = currentUser();
  const guruList = db.users.filter(u=>u.role==='guru');
  const guruField = (user.role==='admin')
    ? `<div class="form-group"><label>Guru Pengajar</label>
        <select name="guruId" required>
          ${guruList.map(g=>`<option value="${g.id}" ${editing?.guruId===g.id?'selected':''}>${escapeHtml(g.name)} (@${escapeHtml(g.username||'-')})</option>`).join('')}
        </select></div>`
    : '';

  const hasImage = editing && editing.image;

  const modal = document.createElement('div');
  modal.className = 'modal-bg';
  modal.onclick = (e)=>{ if(e.target===modal) modal.remove(); };
  modal.innerHTML = `
    <div class="modal">
      <h3>${editing?'Edit Kursus':'Tambah Kursus'}</h3>
      <form onsubmit="saveCourse(event, ${id||'null'})">
        <div class="form-group"><label>Judul Kursus</label>
          <input name="title" required minlength="3" value="${escapeHtml(editing?.title||'')}"></div>
        ${guruField}

        <div class="form-group">
          <label>Gambar Kursus (opsional)</label>
          <div style="border:1px dashed var(--gray-200);border-radius:8px;padding:14px;text-align:center;margin-bottom:8px;background:var(--gray-50)">
            <img id="imgPreview" src="${hasImage ? editing.image : ''}" alt="Preview"
              style="max-width:100%;max-height:200px;border-radius:8px;${hasImage ? 'display:block;margin:0 auto;' : 'display:none;'}">
            <span id="imgPlaceholder" style="color:var(--gray-500);font-size:13px;${hasImage ? 'display:none;' : 'display:inline;'}">
              📷 Belum ada gambar. Pilih file di bawah.
            </span>
          </div>
          <input type="file" id="courseImgInput" accept="image/*" onchange="handleCourseImage(event)"
            style="width:100%;padding:8px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;margin-bottom:8px;">
          <input type="hidden" name="imageData" id="courseImageData" value="${hasImage ? escapeHtml(editing.image) : ''}">
          <button type="button" id="btnRemoveImg" class="btn btn-danger btn-sm"
            onclick="clearCourseImage()" style="${hasImage ? '' : 'display:none;'}">🗑️ Hapus Gambar</button>
          <p class="muted" style="font-size:11px;margin-top:6px">Format: JPG/PNG. Maks 5MB. Gambar otomatis diperkecil.</p>
        </div>

        <div class="form-grid">
          <div class="form-group"><label>Kategori</label>
            <select name="categoryId" required>
              ${db.categories.map(c=>`<option value="${c.id}" ${editing?.categoryId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Tingkat</label>
            <select name="level" required>
              ${LEVELS.map(l=>`<option ${editing?.level===l?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group"><label>Harga (Rp)</label>
            <input type="number" name="price" required min="0" value="${editing?.price||''}"></div>
          <div class="form-group"><label>Durasi (bulan)</label>
            <input type="number" name="duration" required min="1" max="24" value="${editing?.duration||3}"></div>
        </div>
        <div class="form-group"><label>Deskripsi</label>
          <textarea name="description" required minlength="10">${escapeHtml(editing?.description||'')}</textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="this.closest('.modal-bg').remove()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveCourse(e, id){
  e.preventDefault();
  const f = e.target;
  const user = currentUser();
  const title = f.title.value.trim();
  const price = +f.price.value;
  const duration = +f.duration.value;
  const description = f.description.value.trim();
  const image = f.imageData.value || '';

  if(title.length < 3){ toast('Judul minimal 3 karakter','error'); return; }
  if(!isPositiveNumber(price)){ toast('Harga harus lebih dari 0','error'); return; }
  if(!isPositiveNumber(duration) || duration > 24){ toast('Durasi 1-24 bulan','error'); return; }
  if(description.length < 10){ toast('Deskripsi minimal 10 karakter','error'); return; }

  const guruId = user.role === 'admin' ? +f.guruId.value : user.id;

  if(id){
    const c = findCourse(id);
    Object.assign(c, {
      title, categoryId:+f.categoryId.value, level:f.level.value,
      price, duration, description, image,
      ...(user.role==='admin' ? { guruId } : {})
    });
    toast('Kursus diperbarui','success');
  } else {
    db.courses.push({
      id: uid('course'), title,
      categoryId:+f.categoryId.value, level:f.level.value,
      guruId, price, duration, description, image,
    });
    toast('Kursus ditambahkan','success');
  }
  saveDB();
  document.querySelector('.modal-bg')?.remove();
  render();
}

function deleteCourse(id){
  if(!confirm('Hapus kursus ini? Jadwal dan pemesanan terkait juga akan dihapus.')) return;
  const schedIds = db.schedules.filter(s=>s.courseId===id).map(s=>s.id);
  db.courses = db.courses.filter(c=>c.id!==id);
  db.schedules = db.schedules.filter(s=>s.courseId!==id);
  db.bookings = db.bookings.filter(b=>!schedIds.includes(b.scheduleId));
  saveDB();
  toast('Kursus dihapus','info');
  render();
}

/* =========================================================
   MODAL SCHEDULE
   ========================================================= */
function openScheduleForm(id){
  const editing = id ? findSchedule(id) : null;
  const user = currentUser();
  const availableCourses = user.role === 'admin' ? db.courses : coursesByGuru(user.id);
  if(availableCourses.length === 0){ toast('Tambahkan kursus terlebih dahulu','error'); return; }
  const selectedCourseId = editing?.courseId || availableCourses[0].id;

  const modal = document.createElement('div');
  modal.className = 'modal-bg';
  modal.onclick = (e)=>{ if(e.target===modal) modal.remove(); };
  modal.innerHTML = `
    <div class="modal">
      <h3>${editing?'Edit Jadwal':'Tambah Jadwal'}</h3>
      <form onsubmit="saveSchedule(event, ${id||'null'})">
        <div class="form-group"><label>Kursus</label>
          <select name="courseId" required ${editing?'disabled':''}>
            ${availableCourses.map(c=>`<option value="${c.id}" ${selectedCourseId===c.id?'selected':''}>${escapeHtml(c.title)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Hari</label>
          <select name="day" required>
            ${DAYS.map(d=>`<option ${editing?.day===d?'selected':''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="form-grid">
          <div class="form-group"><label>Jam Mulai</label>
            <input type="time" name="start" required value="${editing?.start||'09:00'}"></div>
          <div class="form-group"><label>Jam Selesai</label>
            <input type="time" name="end" required value="${editing?.end||'10:00'}"></div>
        </div>
        <div class="form-group"><label>Kuota Murid</label>
          <input type="number" name="quota" required min="1" max="100" value="${editing?.quota||5}"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="this.closest('.modal-bg').remove()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveSchedule(e, id){
  e.preventDefault();
  const f = e.target;
  const day = f.day.value, start = f.start.value, end = f.end.value, quota = +f.quota.value;

  if(start >= end){ toast('Jam selesai harus lebih besar dari jam mulai','error'); return; }
  if(!isPositiveNumber(quota)){ toast('Kuota harus lebih dari 0','error'); return; }

  if(id){
    const s = findSchedule(id);
    if(quota < s.booked){ toast('Kuota tidak boleh lebih kecil dari jumlah terpesan','error'); return; }
    Object.assign(s, { day, start, end, quota });
    toast('Jadwal diperbarui','success');
  } else {
    db.schedules.push({
      id: uid('schedule'),
      courseId: +f.courseId.value,
      day, start, end, quota, booked:0,
    });
    toast('Jadwal ditambahkan','success');
  }
  saveDB();
  document.querySelector('.modal-bg')?.remove();
  render();
}

function deleteSchedule(id){
  const s = findSchedule(id);
  if(!s) return;
  if(s.booked>0 && !confirm('Jadwal ini sudah dipesan murid. Yakin hapus?')) return;
  db.schedules = db.schedules.filter(x=>x.id!==id);
  db.bookings = db.bookings.filter(b=>b.scheduleId!==id);
  saveDB();
  toast('Jadwal dihapus','info');
  render();
}

/* =========================================================
   ADMIN DASHBOARD
   ========================================================= */
function renderAdminDash(app){
  const tab = ui.adminTab;
  app.innerHTML = `
    <h1>Admin Panel</h1>
    <p class="muted" style="margin-bottom:16px">Kelola data pengguna, guru, kategori, kursus, jadwal, laporan, dan backup.</p>

    <div class="stat-grid">
      <div class="stat"><div class="num">${db.users.length}</div><div class="lbl">Pengguna</div></div>
      <div class="stat"><div class="num">${db.users.filter(u=>u.role==='guru').length}</div><div class="lbl">Guru</div></div>
      <div class="stat"><div class="num">${db.courses.length}</div><div class="lbl">Kursus</div></div>
      <div class="stat"><div class="num">${db.schedules.length}</div><div class="lbl">Jadwal</div></div>
      <div class="stat"><div class="num">${db.bookings.length}</div><div class="lbl">Pemesanan</div></div>
    </div>

    <div class="tabs">
      <button class="${tab==='users'?'active':''}"      onclick="ui.adminTab='users';render()">Pengguna</button>
      <button class="${tab==='guru'?'active':''}"       onclick="ui.adminTab='guru';render()">Guru</button>
      <button class="${tab==='categories'?'active':''}" onclick="ui.adminTab='categories';render()">Kategori</button>
      <button class="${tab==='courses'?'active':''}"    onclick="ui.adminTab='courses';render()">Kursus</button>
      <button class="${tab==='schedules'?'active':''}"  onclick="ui.adminTab='schedules';render()">Jadwal</button>
      <button class="${tab==='bookings'?'active':''}"   onclick="ui.adminTab='bookings';render()">Pemesanan</button>
      <button class="${tab==='report'?'active':''}"     onclick="ui.adminTab='report';render()">Laporan</button>
      <button class="${tab==='backup'?'active':''}"     onclick="ui.adminTab='backup';render()">Backup</button>
    </div>

    <div>${renderAdminTab(tab)}</div>
  `;
}

function renderAdminTab(tab){
  if(tab==='users'){
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Nama</th><th>Username</th><th>Email</th><th>Tanggal Lahir</th><th>Umur</th><th>Jenis Kelamin</th><th>Role</th><th>Aksi</th></tr></thead>
        <tbody>
          ${db.users.map(u=>{
            const umur = hitungUmur(u.tanggalLahir);
            return `<tr>
              <td>${u.id}</td>
              <td>${escapeHtml(u.name)}</td>
              <td>@${escapeHtml(u.username||'-')}</td>
              <td>${escapeHtml(u.email)}</td>
              <td>${fmtTanggalLahir(u.tanggalLahir)}</td>
              <td>${umur !== null ? umur + ' thn' : '-'}</td>
              <td>${escapeHtml(u.jenisKelamin || '-')}</td>
              <td><span class="badge gray">${u.role}</span></td>
              <td>
                ${u.role!=='admin'
                  ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Hapus</button>`
                  : `<span class="muted">-</span>`}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    `;
  }
  if(tab==='guru'){
    const gurus = db.users.filter(u=>u.role==='guru');
    return `
      <div class="between" style="margin-bottom:12px">
        <h3>Data Guru</h3>
        <button class="btn btn-primary btn-sm" onclick="openGuruForm()">+ Tambah Guru</button>
      </div>
      ${gurus.length===0
        ? `<div class="empty"><div class="ico">👨‍🏫</div><p>Belum ada data guru.</p></div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>ID</th><th>Nama</th><th>Username</th><th>Email</th><th>Tanggal Lahir</th><th>Umur</th><th>Jenis Kelamin</th><th>Kursus</th><th>Aksi</th></tr></thead>
            <tbody>
              ${gurus.map(g=>{
                const umur = hitungUmur(g.tanggalLahir);
                return `<tr>
                  <td>${g.id}</td>
                  <td><b>${escapeHtml(g.name)}</b></td>
                  <td>@${escapeHtml(g.username||'-')}</td>
                  <td>${escapeHtml(g.email)}</td>
                  <td>${fmtTanggalLahir(g.tanggalLahir)}</td>
                  <td>${umur !== null ? umur + ' thn' : '-'}</td>
                  <td>${escapeHtml(g.jenisKelamin || '-')}</td>
                  <td>${db.courses.filter(c=>c.guruId===g.id).length}</td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-outline btn-sm" onclick="openGuruForm(${g.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser(${g.id})">Hapus</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>`}
    `;
  }
  if(tab==='categories'){
    return `
      <div class="between" style="margin-bottom:12px">
        <h3>Daftar Kategori</h3>
        <button class="btn btn-primary btn-sm" onclick="openCategoryForm()">+ Tambah Kategori</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Nama</th><th>Jumlah Kursus</th><th>Aksi</th></tr></thead>
        <tbody>
          ${db.categories.map(c=>`
            <tr>
              <td>${c.id}</td>
              <td>${escapeHtml(c.name)}</td>
              <td>${db.courses.filter(x=>x.categoryId===c.id).length}</td>
              <td>
                <button class="btn btn-outline btn-sm" onclick="openCategoryForm(${c.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteCategory(${c.id})">Hapus</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table></div>
    `;
  }
  if(tab==='courses'){
    return `
      <div class="between" style="margin-bottom:12px">
        <h3>Semua Kursus</h3>
        <button class="btn btn-primary btn-sm" onclick="openCourseForm()">+ Tambah Kursus</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Gambar</th><th>Judul</th><th>Kategori</th><th>Guru</th><th>Tingkat</th><th>Durasi</th><th>Harga</th><th>Aksi</th></tr></thead>
        <tbody>
          ${db.courses.map(c=>{
            const g = findUser(c.guruId);
            return `<tr>
              <td>${c.image
                ? `<img src="${c.image}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;">`
                : `<div style="width:50px;height:50px;border-radius:6px;background:linear-gradient(135deg,var(--primary),#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;">${escapeHtml(c.title[0])}</div>`}
              </td>
              <td>${escapeHtml(c.title)}</td>
              <td>${escapeHtml(findCategory(c.categoryId)?.name||'-')}</td>
              <td>${escapeHtml(g?g.name:'-')}</td>
              <td>${c.level}</td>
              <td>${c.duration} bulan</td>
              <td>${fmtPrice(c.price)}</td>
              <td style="white-space:nowrap">
                <button class="btn btn-outline btn-sm" onclick="openCourseForm(${c.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteCourse(${c.id})">Hapus</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    `;
  }
  if(tab==='schedules'){
    return `
      <div class="between" style="margin-bottom:12px">
        <h3>Semua Jadwal</h3>
        <button class="btn btn-primary btn-sm" onclick="openScheduleForm()">+ Tambah Jadwal</button>
      </div>
      ${db.schedules.length===0
        ? `<div class="empty"><div class="ico">📅</div><p>Belum ada jadwal.</p></div>`
        : `<div class="table-wrap"><table>
            <thead><tr><th>ID</th><th>Kursus</th><th>Guru</th><th>Hari</th><th>Jam</th><th>Kuota</th><th>Aksi</th></tr></thead>
            <tbody>
              ${db.schedules.map(s=>{
                const c = findCourse(s.courseId);
                const g = c ? findUser(c.guruId) : null;
                return `<tr>
                  <td>${s.id}</td>
                  <td>${escapeHtml(c?c.title:'-')}</td>
                  <td>${escapeHtml(g?g.name:'-')}</td>
                  <td>${s.day}</td>
                  <td>${s.start} - ${s.end}</td>
                  <td>${s.booked}/${s.quota}</td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-outline btn-sm" onclick="openScheduleForm(${s.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSchedule(${s.id})">Hapus</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>`}
    `;
  }
  if(tab==='bookings'){
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Murid</th><th>Kursus</th><th>Jadwal</th><th>Status</th><th>Dipesan pada</th></tr></thead>
        <tbody>
          ${db.bookings.length===0
            ? `<tr><td colspan="6" style="text-align:center;color:var(--gray-500);padding:24px">Belum ada pemesanan</td></tr>`
            : db.bookings.map(b=>{
                const m = findUser(b.muridId);
                const c = findCourse(b.courseId);
                const s = findSchedule(b.scheduleId);
                return `<tr>
                  <td>${b.id}</td>
                  <td>${escapeHtml(m?m.name:'-')}<br><small class="muted">@${escapeHtml(m?.username||'-')}</small></td>
                  <td>${escapeHtml(c?c.title:'-')}</td>
                  <td>${escapeHtml(s?(s.day+' '+s.start+'-'+s.end):'-')}</td>
                  <td>${statusBadge(b.status)}</td>
                  <td><small class="muted">${fmtDate(b.createdAt)}</small></td>
                </tr>`;
              }).join('')}
        </tbody>
      </table></div>
    `;
  }
  if(tab==='report'){
    const totalPendapatan = db.bookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => {
        const c = findCourse(b.courseId);
        return sum + (c ? c.price : 0);
      }, 0);
    const perStatus = {
      pending: db.bookings.filter(b=>b.status==='pending').length,
      confirmed: db.bookings.filter(b=>b.status==='confirmed').length,
      cancelled: db.bookings.filter(b=>b.status==='cancelled').length,
    };

    return `
      <div class="report-grid">
        <div class="report-card">
          <h4>Total Kursus</h4>
          <div class="big-num">${db.courses.length}</div>
          <div class="sub">${db.categories.length} kategori</div>
        </div>
        <div class="report-card">
          <h4>Total Jadwal</h4>
          <div class="big-num">${db.schedules.length}</div>
          <div class="sub">${db.schedules.reduce((s,x)=>s+x.booked,0)} kursi terisi</div>
        </div>
        <div class="report-card">
          <h4>Total Pemesanan</h4>
          <div class="big-num">${db.bookings.length}</div>
          <div class="sub">${perStatus.confirmed} dikonfirmasi · ${perStatus.pending} menunggu · ${perStatus.cancelled} dibatalkan</div>
        </div>
        <div class="report-card">
          <h4>Potensi Pendapatan</h4>
          <div class="big-num" style="font-size:20px">${fmtPrice(totalPendapatan)}</div>
          <div class="sub">Dari pemesanan aktif</div>
        </div>
      </div>

      <h3 style="margin:20px 0 12px">📥 Export Laporan (CSV)</h3>
      <div class="export-grid">
        <button class="export-btn" onclick="exportCSV('courses')">
          <span class="icon">📚</span>
          <span class="label"><b>Data Kursus</b><small>${db.courses.length} kursus</small></span>
        </button>
        <button class="export-btn" onclick="exportCSV('schedules')">
          <span class="icon">📅</span>
          <span class="label"><b>Data Jadwal</b><small>${db.schedules.length} jadwal</small></span>
        </button>
        <button class="export-btn" onclick="exportCSV('bookings')">
          <span class="icon">📋</span>
          <span class="label"><b>Data Pemesanan</b><small>${db.bookings.length} pemesanan</small></span>
        </button>
        <button class="export-btn" onclick="exportCSV('users')">
          <span class="icon">👥</span>
          <span class="label"><b>Data Pengguna</b><small>${db.users.length} pengguna</small></span>
        </button>
      </div>

      <h3 style="margin:24px 0 12px">📊 Rekap Per Kategori</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Kategori</th><th>Jumlah Kursus</th><th>Total Pemesanan</th></tr></thead>
        <tbody>
          ${db.categories.map(cat => {
            const courses = db.courses.filter(c=>c.categoryId===cat.id);
            const cids = courses.map(c=>c.id);
            const bookings = db.bookings.filter(b=>cids.includes(b.courseId));
            return `<tr>
              <td>${escapeHtml(cat.name)}</td>
              <td>${courses.length}</td>
              <td>${bookings.length}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    `;
  }
  if(tab==='backup'){
    const dataStr = JSON.stringify(db, null, 2);
    const size = (new Blob([dataStr]).size / 1024).toFixed(2);
    const imgCount = db.courses.filter(c=>c.image).length;
    return `
      <div class="card" style="margin-bottom:16px">
        <h3>💾 Export Data</h3>
        <p class="muted" style="margin:6px 0 12px">Unduh seluruh data dalam format JSON. Lakukan backup secara berkala.</p>
        <p class="muted" style="font-size:12px">Ukuran data: <b>${size} KB</b> · Gambar kursus: <b>${imgCount}</b></p>
        <div class="row" style="margin-top:12px">
          <button class="btn btn-primary" onclick="exportData()">⬇️ Download Backup (.json)</button>
          <button class="btn btn-outline" onclick="copyData()">📋 Copy ke Clipboard</button>
        </div>
      </div>

      <div class="card">
        <h3>📥 Import Data</h3>
        <p class="muted" style="margin:6px 0 12px">Pulihkan data dari file backup JSON. <b>Peringatan:</b> data saat ini akan ditimpa.</p>
        <input type="file" id="importFile" accept=".json" style="padding:8px;border:1px solid var(--gray-200);border-radius:8px">
        <div class="row" style="margin-top:12px">
          <button class="btn btn-danger" onclick="importData()">Upload & Restore</button>
          <button class="btn btn-outline" onclick="resetData()">Reset ke Data Awal</button>
        </div>
      </div>
    `;
  }
}

/* =========================================================
   EXPORT CSV
   ========================================================= */
function toCSV(rows){
  return rows.map(row =>
    row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\n');
}

function downloadCSV(filename, csv){
  const blob = new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportCSV(type){
  const ts = new Date().toISOString().slice(0,10);
  if(type === 'courses'){
    const rows = [['ID','Judul','Kategori','Guru','Tingkat','Durasi (bulan)','Harga','Ada Gambar']];
    db.courses.forEach(c => rows.push([
      c.id, c.title,
      findCategory(c.categoryId)?.name || '',
      findUser(c.guruId)?.name || '',
      c.level, c.duration, c.price,
      c.image ? 'Ya' : 'Tidak',
    ]));
    downloadCSV(`laporan_kursus_${ts}.csv`, toCSV(rows));
  } else if(type === 'schedules'){
    const rows = [['ID','Kursus','Guru','Hari','Mulai','Selesai','Kuota','Terisi']];
    db.schedules.forEach(s => {
      const c = findCourse(s.courseId);
      rows.push([s.id, c?.title||'', c?findUser(c.guruId)?.name:'', s.day, s.start, s.end, s.quota, s.booked]);
    });
    downloadCSV(`laporan_jadwal_${ts}.csv`, toCSV(rows));
  } else if(type === 'bookings'){
    const rows = [['ID','Murid','Username','Kursus','Guru','Hari','Jam','Status','Dipesan pada']];
    db.bookings.forEach(b => {
      const m = findUser(b.muridId);
      const c = findCourse(b.courseId);
      const s = findSchedule(b.scheduleId);
      rows.push([
        b.id, m?.name||'', m?.username||'', c?.title||'', c?findUser(c.guruId)?.name:'',
        s?.day||'', s?(s.start+'-'+s.end):'', b.status, fmtDate(b.createdAt),
      ]);
    });
    downloadCSV(`laporan_pemesanan_${ts}.csv`, toCSV(rows));
  } else if(type === 'users'){
    const rows = [['ID','Nama','Username','Email','Tanggal Lahir','Umur','Jenis Kelamin','Role']];
    db.users.forEach(u => rows.push([
      u.id, u.name, u.username || '', u.email,
      u.tanggalLahir || '',
      hitungUmur(u.tanggalLahir) ?? '',
      u.jenisKelamin || '',
      u.role,
    ]));
    downloadCSV(`laporan_pengguna_${ts}.csv`, toCSV(rows));
  }
  toast('Laporan CSV diunduh','success');
}

/* =========================================================
   BACKUP / RESTORE / RESET
   ========================================================= */
function exportData(){
  const dataStr = JSON.stringify(db, null, 2);
  const blob = new Blob([dataStr], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.download = `jdk_course_backup_${ts}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Backup diunduh','success');
}

function copyData(){
  navigator.clipboard.writeText(JSON.stringify(db, null, 2))
    .then(()=>toast('Data dicopy ke clipboard','success'))
    .catch(()=>toast('Gagal copy','error'));
}

function importData(){
  const input = document.getElementById('importFile');
  if(!input || !input.files[0]){ toast('Pilih file JSON terlebih dahulu','error'); return; }
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const parsed = JSON.parse(e.target.result);
      if(!parsed.users || !parsed.courses){ toast('Format file tidak valid','error'); return; }
      if(!confirm('Data saat ini akan ditimpa. Lanjutkan?')) return;
      db = parsed;
      if(!db.notifications) db.notifications = [];
      if(!db.nextId.notification) db.nextId.notification = 1;
      db.courses.forEach(c => { if(typeof c.image === 'undefined') c.image = ''; });
      saveDB();
      toast('Data berhasil dipulihkan','success');
      render();
    }catch(err){ toast('File JSON rusak','error'); }
  };
  reader.readAsText(input.files[0]);
}

function resetData(){
  if(!confirm('Reset semua data ke pengaturan awal?')) return;
  db = seedDB(); saveDB();
  session = null; localStorage.removeItem(SESSION_KEY);
  toast('Data direset','info'); go('#/'); render();
}

/* =========================================================
   ADMIN: CRUD GURU (dengan username)
   ========================================================= */
function openGuruForm(id){
  const editing = id ? findUser(id) : null;
  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate())
    .toISOString().slice(0,10);
  const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate())
    .toISOString().slice(0,10);

  const modal = document.createElement('div');
  modal.className = 'modal-bg';
  modal.onclick = (e)=>{ if(e.target===modal) modal.remove(); };
  modal.innerHTML = `
    <div class="modal">
      <h3>${editing?'Edit Guru':'Tambah Guru'}</h3>
      <form onsubmit="saveGuru(event, ${id||'null'})">
        <div class="form-group"><label>Nama Lengkap</label>
          <input name="name" required minlength="3" value="${escapeHtml(editing?.name||'')}"></div>
        <div class="form-group"><label>Username</label>
          <input type="text" name="username" required minlength="3" maxlength="20"
            pattern="[a-zA-Z0-9_]{3,20}"
            title="3-20 karakter, hanya huruf, angka, dan underscore"
            value="${escapeHtml(editing?.username||'')}">
          <small class="muted" style="font-size:11px">3-20 karakter, hanya huruf, angka, dan underscore (_).</small></div>
        <div class="form-group"><label>Email</label>
          <input type="email" name="email" required value="${escapeHtml(editing?.email||'')}"></div>
        ${editing ? '' : `<div class="form-group"><label>Password</label>
          <input type="password" name="password" required minlength="6" placeholder="Minimal 6 karakter"></div>`}
        <div class="form-grid">
          <div class="form-group"><label>Tanggal Lahir</label>
            <input type="date" name="tanggalLahir" required min="${minDate}" max="${maxDate}"
              value="${editing?.tanggalLahir||''}"></div>
          <div class="form-group"><label>Jenis Kelamin</label>
            <select name="jenisKelamin" required>
              ${GENDERS.map(g=>`<option ${editing?.jenisKelamin===g?'selected':''}>${g}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group"><label>Bio / Keahlian</label>
          <textarea name="bio">${escapeHtml(editing?.bio||'')}</textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="this.closest('.modal-bg').remove()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveGuru(e, id){
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  const username = f.username.value.trim();
  const email = f.email.value.trim().toLowerCase();
  const tanggalLahir = f.tanggalLahir.value;
  const jenisKelamin = f.jenisKelamin.value;
  const bio = f.bio.value.trim();

  if(!isNameValid(name)){ toast('Nama minimal 3 karakter','error'); return; }
  if(!isUsernameValid(username)){ toast('Username 3-20 karakter (huruf/angka/underscore)','error'); return; }
  if(isUsernameTaken(username, id)){ toast('Username sudah dipakai pengguna lain','error'); return; }
  if(!isEmailValid(email)){ toast('Format email tidak valid','error'); return; }
  if(!isTanggalLahirValid(tanggalLahir)){ toast('Tanggal lahir tidak valid (umur 5 - 100 tahun)','error'); return; }
  if(!isGenderValid(jenisKelamin)){ toast('Pilih jenis kelamin','error'); return; }
  if(db.users.some(u => u.email.toLowerCase()===email && u.id!==id)){
    toast('Email sudah dipakai pengguna lain','error'); return;
  }

  if(id){
    const g = findUser(id);
    g.name = name; g.username = username; g.email = email; g.bio = bio;
    g.tanggalLahir = tanggalLahir; g.jenisKelamin = jenisKelamin;
    toast('Data guru diperbarui','success');
  } else {
    const pass = f.password.value;
    if(!isPasswordValid(pass)){ toast('Password minimal 6 karakter','error'); return; }
    const salt = generateSalt();
    db.users.push({
      id: uid('user'), name, username, email, salt,
      passwordHash: hashPassword(pass, salt),
      role:'guru', bio, tanggalLahir, jenisKelamin,
    });
    toast('Guru ditambahkan','success');
  }
  saveDB();
  document.querySelector('.modal-bg')?.remove();
  render();
}

/* =========================================================
   DELETE USER / KATEGORI
   ========================================================= */
function deleteUser(id){
  const u = findUser(id);
  if(!u) return;
  if(u.role === 'admin'){ toast('Tidak dapat menghapus admin','error'); return; }
  if(!confirm(`Hapus pengguna "${u.name}"? Kursus & jadwal terkait juga akan dihapus.`)) return;

  const courseIds = db.courses.filter(c=>c.guruId===id).map(c=>c.id);
  db.users = db.users.filter(x=>x.id!==id);
  db.courses = db.courses.filter(c=>c.guruId!==id);
  db.schedules = db.schedules.filter(s=>!courseIds.includes(s.courseId));
  db.bookings = db.bookings.filter(b=>b.muridId!==id && !courseIds.includes(b.courseId));
  saveDB();
  toast('Pengguna dihapus','info');
  render();
}

function openCategoryForm(id){
  const editing = id ? findCategory(id) : null;
  const modal = document.createElement('div');
  modal.className = 'modal-bg';
  modal.onclick = (e)=>{ if(e.target===modal) modal.remove(); };
  modal.innerHTML = `
    <div class="modal">
      <h3>${editing?'Edit Kategori':'Tambah Kategori'}</h3>
      <form onsubmit="saveCategory(event, ${id||'null'})">
        <div class="form-group"><label>Nama Kategori</label>
          <input name="name" required minlength="3" value="${escapeHtml(editing?.name||'')}"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="this.closest('.modal-bg').remove()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveCategory(e, id){
  e.preventDefault();
  const name = e.target.name.value.trim();
  if(!isNameValid(name)){ toast('Nama kategori minimal 3 karakter','error'); return; }
  if(id){
    findCategory(id).name = name;
    toast('Kategori diperbarui','success');
  } else {
    db.categories.push({ id: uid('category'), name });
    toast('Kategori ditambahkan','success');
  }
  saveDB();
  document.querySelector('.modal-bg')?.remove();
  render();
}

function deleteCategory(id){
  if(db.courses.some(c=>c.categoryId===id)){ toast('Kategori masih dipakai kursus','error'); return; }
  if(!confirm('Hapus kategori ini?')) return;
  db.categories = db.categories.filter(c=>c.id!==id);
  saveDB();
  toast('Kategori dihapus','info');
  render();
}

/* =========================================================
   EXPOSE KE WINDOW
   ========================================================= */
Object.assign(window, {
  render, renderCourses,
  filterState, ui,
  handleLogin, handleRegister, logout,
  bookSchedule, cancelBooking, confirmBooking,
  openCourseForm, saveCourse, deleteCourse,
  openScheduleForm, saveSchedule, deleteSchedule,
  openCategoryForm, saveCategory, deleteCategory,
  openGuruForm, saveGuru, deleteUser,
  saveGuruProfile,
  exportData, copyData, importData, resetData,
  exportCSV,
  toggleNotifPanel, markAllReadAndRefresh,
  handleCourseImage, clearCourseImage,
});