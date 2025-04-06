require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Apenas arquivos PDF, JPG ou PNG são permitidos'));
  }
});

// Temporary database (replace with real database in production)
const db = {
  users: [],
  assets: [],
  certificates: []
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Helper functions
const generateCertificateId = () => {
  return `CARBON-${Date.now().toString(36).toUpperCase()}`;
};

const calculateCarbonCredits = (area, biome) => {
  // Simplified calculation - in production this would use complex models
  const biomeFactors = {
    'amazonia': 200,
    'cerrado': 150,
    'mata_atlantica': 180,
    'caatinga': 120,
    'pampa': 100,
    'pantanal': 160
  };
  return Math.floor(area * biomeFactors[biome] || 100);
};

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, userType } = req.body;
    
    // Validate input
    if (!email || !password || !userType) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    // Check if user exists
    if (db.users.some(u => u.email === email)) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      userType, // 'owner' or 'certifier'
      createdAt: new Date()
    };

    db.users.push(user);

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, userType: user.userType },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({ token, userType: user.userType });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = db.users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, userType: user.userType },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, userType: user.userType });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Asset declaration endpoint
app.post('/api/assets', authenticate, upload.array('documents'), (req, res) => {
  try {
    const { country, region, state, biome, totalArea, preservedArea } = req.body;
    const files = req.files || [];

    // Validate input
    if (!country || !region || !state || !biome || !totalArea || !preservedArea) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    // Create asset
    const asset = {
      id: Date.now().toString(),
      ownerId: req.user.id,
      country,
      region,
      state,
      biome,
      totalArea: parseFloat(totalArea),
      preservedArea: parseFloat(preservedArea),
      documents: files.map(f => ({
        name: f.originalname,
        path: f.path,
        size: f.size
      })),
      status: 'pending',
      createdAt: new Date(),
      credits: calculateCarbonCredits(preservedArea, biome)
    };

    db.assets.push(asset);

    res.status(201).json({
      message: 'Declaração enviada com sucesso',
      assetId: asset.id,
      credits: asset.credits
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no processamento da declaração' });
  }
});

// Certifier endpoints
app.get('/api/pending-assets', authenticate, (req, res) => {
  if (req.user.userType !== 'certifier') {
    return res.status(403).json({ error: 'Acesso não autorizado' });
  }

  const pendingAssets = db.assets.filter(a => a.status === 'pending');
  res.json(pendingAssets);
});

app.post('/api/certify/:assetId', authenticate, (req, res) => {
  if (req.user.userType !== 'certifier') {
    return res.status(403).json({ error: 'Acesso não autorizado' });
  }

  const assetId = req.params.assetId;
  const asset = db.assets.find(a => a.id === assetId);
  
  if (!asset) {
    return res.status(404).json({ error: 'Ativo não encontrado' });
  }

  // Create certificate
  const certificate = {
    id: generateCertificateId(),
    assetId,
    certifierId: req.user.id,
    issuedAt: new Date(),
    blockchainHash: `0x${Math.random().toString(16).substr(2, 64)}`,
    retired: false
  };

  db.certificates.push(certificate);
  asset.status = 'approved';
  asset.certificateId = certificate.id;

  res.json({
    message: 'Ativo certificado com sucesso',
    certificate
  });
});

// Owner endpoints
app.get('/api/my-assets', authenticate, (req, res) => {
  const myAssets = db.assets.filter(a => a.ownerId === req.user.id);
  res.json(myAssets);
});

app.post('/api/retire/:certificateId', authenticate, (req, res) => {
  const certificateId = req.params.certificateId;
  const certificate = db.certificates.find(c => c.id === certificateId);
  
  if (!certificate) {
    return res.status(404).json({ error: 'Certificado não encontrado' });
  }

  const asset = db.assets.find(a => a.certificateId === certificateId);
  if (!asset || asset.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Acesso não autorizado' });
  }

  certificate.retired = true;
  certificate.retiredAt = new Date();

  res.json({
    message: 'Créditos aposentados com sucesso',
    certificate
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});