const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storage = require('./storage');

const app = express();
const PORT = process.env.PORT || 8080;
const isVercel = process.env.VERCEL === '1';

const UPLOAD_DIR = isVercel ? '/tmp/uploads' : path.join(__dirname, 'uploads');

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== 手动静态文件服务（兼容 Vercel Lambda） =====
const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();

  let filePath = path.join(__dirname, decodeURI(req.path));
  if (!fs.existsSync(filePath)) return next();
  const stat = fs.statSync(filePath);

  if (stat.isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (!fs.existsSync(indexPath)) return next();
    filePath = indexPath;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_MAP[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.sendFile(filePath);
});

// 请求日志
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - from ${ip}`);
  next();
});

// 初始化上传目录
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 文件上传配置
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: multerStorage });

// ===== API 路由（数据通过 storage 读写，支持本地 JSON / Vercel Redis） =====

// 调试
app.get('/api/debug', (req, res) => {
  const dir = __dirname;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const allFiles = entries.map(e => ({ name: e.name, isDir: e.isDirectory(), isFile: e.isFile() }));
  res.json({ dir, allFiles, cwd: process.cwd() });
});

// 参展报名
app.post('/api/register', async (req, res) => {
  try {
    const newReg = { ...req.body, status: '待确认', createdAt: new Date().toISOString() };
    const saved = await storage.add('registrations', newReg);
    res.json({ success: true, message: '报名成功！我们会尽快与您联系。', data: saved });
  } catch {
    res.status(500).json({ success: false, message: '提交失败，请重试' });
  }
});

app.get('/api/registrations', async (req, res) => {
  try { res.json(await storage.readAll('registrations')); }
  catch { res.status(500).json({ success: false, message: '读取失败' }); }
});

app.put('/api/registrations/:id', async (req, res) => {
  try {
    const updated = await storage.updateOne('registrations', req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: '未找到' });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

app.delete('/api/registrations/:id', async (req, res) => {
  try {
    await storage.remove('registrations', req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// 统计数据
app.get('/api/stats', async (req, res) => {
  try {
    const registrations = await storage.readAll('registrations');
    res.json({
      total: registrations.length,
      pending: registrations.filter(r => r.status === '待确认').length,
      confirmed: registrations.filter(r => r.status === '已确认').length,
      completed: registrations.filter(r => r.status === '已完成').length
    });
  } catch {
    res.status(500).json({ success: false, message: '读取失败' });
  }
});

// 新闻管理
app.get('/api/news', async (req, res) => {
  try { res.json(await storage.readAll('news')); }
  catch { res.status(500).json({ success: false, message: '读取失败' }); }
});

app.post('/api/news', upload.single('image'), async (req, res) => {
  try {
    const newItem = {
      title: req.body.title,
      summary: req.body.summary,
      content: req.body.content,
      image: req.file ? '/uploads/' + req.file.filename : '',
      date: new Date().toISOString().split('T')[0]
    };
    const saved = await storage.add('news', newItem);
    res.json({ success: true, data: saved });
  } catch {
    res.status(500).json({ success: false, message: '添加失败' });
  }
});

app.delete('/api/news/:id', async (req, res) => {
  try {
    await storage.remove('news', req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// ===== 通用 CRUD 辅助（使用 storage） =====
function createCrudRoutes(apiPath, key) {
  app.get(apiPath, async (req, res) => {
    try { res.json(await storage.readAll(key)); }
    catch { res.json([]); }
  });
  app.post(apiPath, async (req, res) => {
    try {
      const newItem = await storage.add(key, req.body);
      res.json({ success: true, data: newItem });
    } catch { res.status(500).json({ success: false, message: '添加失败' }); }
  });
  app.delete(apiPath + '/:id', async (req, res) => {
    try {
      await storage.remove(key, req.params.id);
      res.json({ success: true });
    } catch { res.status(500).json({ success: false, message: '删除失败' }); }
  });
}

// 展商目录
createCrudRoutes('/api/exhibitors', 'exhibitors');
// 合作媒体
createCrudRoutes('/api/media', 'media');
// 资料下载
createCrudRoutes('/api/downloads', 'downloads');

// 文件上传
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '请选择文件' });
  res.json({ success: true, url: '/uploads/' + req.file.filename });
});

// 登录验证
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'e0005068') {
    res.json({ success: true, token: 'admin-token' });
  } else {
    res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
});

// ===== 启动 =====
async function start() {
  if (isVercel) {
    await storage.seedIfEmpty();
  }
  if (!isVercel) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 航天展网站已启动！`);
      console.log(`   主站: http://localhost:${PORT}/`);
      console.log(`   📊 后台管理: http://localhost:${PORT}/admin/`);
      console.log(`   ⚠️  后台默认账号: admin  密码: e0005068`);
    });
  }
}
start();

module.exports = app;
