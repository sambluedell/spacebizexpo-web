const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const isVercel = process.env.VERCEL === '1';

// 数据文件路径（Vercel 用 /tmp，本地用 data/）
const DATA_DIR = isVercel ? '/tmp/data' : path.join(__dirname, 'data');
const UPLOAD_DIR = isVercel ? '/tmp/uploads' : path.join(__dirname, 'uploads');

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
const ROOT_DIR = isVercel ? process.cwd() : __dirname;
app.use(express.static(ROOT_DIR));

// 请求日志
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - from ${ip}`);
  next();
});

const REGISTRATIONS_FILE = path.join(DATA_DIR, 'registrations.json');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');
const EXHIBITORS_FILE = path.join(DATA_DIR, 'exhibitors.json');
const MEDIA_FILE = path.join(DATA_DIR, 'media.json');
const DOWNLOADS_FILE = path.join(DATA_DIR, 'downloads.json');

// 初始化数据文件
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(REGISTRATIONS_FILE)) fs.writeFileSync(REGISTRATIONS_FILE, '[]');
if (!fs.existsSync(NEWS_FILE)) fs.writeFileSync(NEWS_FILE, '[]');
if (!fs.existsSync(EXHIBITORS_FILE)) fs.writeFileSync(EXHIBITORS_FILE, '[]');
if (!fs.existsSync(MEDIA_FILE)) fs.writeFileSync(MEDIA_FILE, '[]');
if (!fs.existsSync(DOWNLOADS_FILE)) fs.writeFileSync(DOWNLOADS_FILE, '[]');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// ===================== API 路由 =====================

// 参展报名
app.post('/api/register', (req, res) => {
  try {
    const data = req.body;
    const registrations = JSON.parse(fs.readFileSync(REGISTRATIONS_FILE, 'utf-8'));
    const newReg = {
      id: Date.now(),
      ...data,
      status: '待确认',
      createdAt: new Date().toISOString()
    };
    registrations.push(newReg);
    fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify(registrations, null, 2));
    res.json({ success: true, message: '报名成功！我们会尽快与您联系。', data: newReg });
  } catch (err) {
    res.status(500).json({ success: false, message: '提交失败，请重试' });
  }
});

// 获取所有报名记录（后台用）
app.get('/api/registrations', (req, res) => {
  try {
    const registrations = JSON.parse(fs.readFileSync(REGISTRATIONS_FILE, 'utf-8'));
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ success: false, message: '读取失败' });
  }
});

// 更新报名状态
app.put('/api/registrations/:id', (req, res) => {
  try {
    const registrations = JSON.parse(fs.readFileSync(REGISTRATIONS_FILE, 'utf-8'));
    const idx = registrations.findIndex(r => r.id == req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: '未找到' });
    registrations[idx] = { ...registrations[idx], ...req.body };
    fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify(registrations, null, 2));
    res.json({ success: true, data: registrations[idx] });
  } catch (err) {
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 删除报名记录
app.delete('/api/registrations/:id', (req, res) => {
  try {
    let registrations = JSON.parse(fs.readFileSync(REGISTRATIONS_FILE, 'utf-8'));
    registrations = registrations.filter(r => r.id != req.params.id);
    fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify(registrations, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// 获取统计数据
app.get('/api/stats', (req, res) => {
  try {
    const registrations = JSON.parse(fs.readFileSync(REGISTRATIONS_FILE, 'utf-8'));
    res.json({
      total: registrations.length,
      pending: registrations.filter(r => r.status === '待确认').length,
      confirmed: registrations.filter(r => r.status === '已确认').length,
      completed: registrations.filter(r => r.status === '已完成').length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: '读取失败' });
  }
});

// 新闻管理
app.get('/api/news', (req, res) => {
  try {
    const news = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf-8'));
    res.json(news);
  } catch (err) {
    res.status(500).json({ success: false, message: '读取失败' });
  }
});

app.post('/api/news', upload.single('image'), (req, res) => {
  try {
    const news = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf-8'));
    const newItem = {
      id: Date.now(),
      title: req.body.title,
      summary: req.body.summary,
      content: req.body.content,
      image: req.file ? '/uploads/' + req.file.filename : '',
      date: new Date().toISOString().split('T')[0]
    };
    news.push(newItem);
    fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2));
    res.json({ success: true, data: newItem });
  } catch (err) {
    res.status(500).json({ success: false, message: '添加失败' });
  }
});

app.delete('/api/news/:id', (req, res) => {
  try {
    let news = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf-8'));
    news = news.filter(n => n.id != req.params.id);
    fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// ===== 通用 CRUD 辅助 =====
function createCrudRoutes(apiPath, filePath, fieldName) {
  // GET 列表
  app.get(apiPath, (req, res) => {
    try { res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8'))); }
    catch { res.json([]); }
  });
  // POST 新增
  app.post(apiPath, (req, res) => {
    try {
      const items = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const newItem = { id: Date.now(), ...req.body };
      items.push(newItem);
      fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
      res.json({ success: true, data: newItem });
    } catch { res.status(500).json({ success: false, message: '添加失败' }); }
  });
  // DELETE 删除
  app.delete(apiPath + '/:id', (req, res) => {
    try {
      let items = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      items = items.filter(i => i.id != req.params.id);
      fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
      res.json({ success: true });
    } catch { res.status(500).json({ success: false, message: '删除失败' }); }
  });
}

// 展商目录
createCrudRoutes('/api/exhibitors', EXHIBITORS_FILE);
// 合作媒体
createCrudRoutes('/api/media', MEDIA_FILE);
// 资料下载
createCrudRoutes('/api/downloads', DOWNLOADS_FILE);

// 文件上传（图片）
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '请选择文件' });
  res.json({ success: true, url: '/uploads/' + req.file.filename });
});

// 登录验证（简单版）
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'e0005068') {
    res.json({ success: true, token: 'admin-token' });
  } else {
    res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
});

// ===== SPA 回退：非 API 路由都返回 index.html =====
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const indexPath = path.join(ROOT_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('index.html not found');
  }
});

// ===================== 启动服务器（本地）/ 导出（Vercel） =====================
if (!isVercel) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 航天展网站已启动！`);
    console.log(`   主站: http://localhost:${PORT}/`);
    console.log(`   📊 后台管理: http://localhost:${PORT}/admin/`);
    console.log(`   ⚠️  后台默认账号: admin  密码: e0005068`);
  });
}

module.exports = app;
