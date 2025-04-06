const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const API_BASE = 'http://localhost:3000/api';

// Test user credentials
const TEST_USERS = {
  owner: {
    email: 'proprietario@teste.com',
    password: 'senha123',
    userType: 'owner'
  },
  certifier: {
    email: 'certificador@teste.com',
    password: 'senha456',
    userType: 'certifier'
  }
};

async function runTests() {
  console.log('Iniciando testes do sistema de créditos de carbono...\n');

  // Test user registration
  console.log('1. Testando registro de usuários:');
  let ownerToken, certifierToken;

  try {
    let response = await axios.post(`${API_BASE}/register`, TEST_USERS.owner);
    ownerToken = response.data.token;
    console.log('✅ Proprietário registrado com sucesso');

    response = await axios.post(`${API_BASE}/register`, TEST_USERS.certifier);
    certifierToken = response.data.token;
    console.log('✅ Certificador registrado com sucesso\n');
  } catch (err) {
    console.error('❌ Falha no registro:', err.response?.data || err.message);
    return;
  }

  // Test asset declaration
  console.log('2. Testando declaração de ativo:');
  let assetId;

  try {
    const form = new FormData();
    form.append('country', 'BR');
    form.append('region', 'Norte');
    form.append('state', 'Amazonas');
    form.append('biome', 'amazonia');
    form.append('totalArea', '1500');
    form.append('preservedArea', '1200');
    form.append('documents', fs.createReadStream('./test-document.pdf'));

    const response = await axios.post(`${API_BASE}/assets`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${ownerToken}`
      }
    });

    assetId = response.data.assetId;
    console.log('✅ Ativo declarado com sucesso. ID:', assetId);
    console.log('   Créditos estimados:', response.data.credits, '\n');
  } catch (err) {
    console.error('❌ Falha na declaração:', err.response?.data || err.message);
    return;
  }

  // Test certification
  console.log('3. Testando certificação:');
  let certificateId;

  try {
    // Get pending assets
    let response = await axios.get(`${API_BASE}/pending-assets`, {
      headers: { Authorization: `Bearer ${certifierToken}` }
    });

    const assetToCertify = response.data.find(a => a.id === assetId);
    if (!assetToCertify) {
      throw new Error('Ativo não encontrado para certificação');
    }

    // Certify asset
    response = await axios.post(
      `${API_BASE}/certify/${assetId}`,
      {},
      { headers: { Authorization: `Bearer ${certifierToken}` } }
    );

    certificateId = response.data.certificate.id;
    console.log('✅ Ativo certificado com sucesso. Certificado ID:', certificateId);
    console.log('   Hash blockchain:', response.data.certificate.blockchainHash, '\n');
  } catch (err) {
    console.error('❌ Falha na certificação:', err.response?.data || err.message);
    return;
  }

  // Test credit retirement
  console.log('4. Testando aposentadoria de créditos:');
  try {
    const response = await axios.post(
      `${API_BASE}/retire/${certificateId}`,
      {},
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );

    console.log('✅ Créditos aposentados com sucesso');
    console.log('   Data de aposentadoria:', response.data.certificate.retiredAt, '\n');
  } catch (err) {
    console.error('❌ Falha na aposentadoria:', err.response?.data || err.message);
    return;
  }

  // Final system check
  console.log('5. Verificando estado final do sistema:');
  try {
    // Check owner assets
    const ownerAssets = await axios.get(`${API_BASE}/my-assets`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });

    const certifiedAsset = ownerAssets.data.find(a => a.id === assetId);
    if (!certifiedAsset || certifiedAsset.status !== 'approved') {
      throw new Error('Ativo não foi corretamente certificado');
    }

    console.log('✅ Sistema funcionando corretamente');
    console.log('   Estado do ativo:', certifiedAsset.status);
    console.log('   Certificado vinculado:', certifiedAsset.certificateId);
  } catch (err) {
    console.error('❌ Falha na verificação final:', err.response?.data || err.message);
    return;
  }
}

// Create a dummy test file if it doesn't exist
if (!fs.existsSync('./test-document.pdf')) {
  fs.writeFileSync('./test-document.pdf', 'This is a test document');
}

// Start the tests
runTests().catch(console.error);