# Sistema de Créditos de Carbono

Plataforma para declaração e certificação de ativos ambientais para o mercado de carbono.

## Funcionalidades

- Cadastro de usuários (proprietários e certificadores)
- Declaração de ativos ambientais com upload de documentos
- Análise e certificação por certificadores habilitados
- Emissão de certificados com registro em blockchain
- Aposentadoria de créditos comercializados
- Monitoramento anual de estoque de carbono

## Tecnologias Utilizadas

- Frontend: HTML5, Tailwind CSS, Font Awesome
- Backend: Node.js, Express
- Autenticação: JWT
- Blockchain: Modelo de certificados criptografados
- Armazenamento: Sistema de arquivos (para demonstração)

## Instalação

1. Instale o Node.js (v16+)
2. Clone este repositório
3. Instale as dependências:

```bash
cd server
npm install
```

4. Crie um arquivo `.env` na pasta `server` com:

```
JWT_SECRET=sua-chave-secreta-aqui
```

## Execução

1. Inicie o servidor:

```bash
cd server
node server.js
```

2. Acesse o frontend abrindo `frontend/index.html` no navegador

3. Para testes automatizados:

```bash
node test-server.js
```

## Estrutura de Arquivos

```
carbon-credits-system/
├── frontend/          # Interface do usuário
├── server/            # Backend e API
├── blockchain/        # Esquemas e contratos
└── README.md          # Documentação
```

## Próximos Passos

- Integração com blockchain real (Ethereum/Polygon)
- Banco de dados permanente (PostgreSQL/MongoDB)
- Painel administrativo avançado
- Relatórios de estoque de carbono
- API para integração com mercados de carbono