const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const validateLogin = require('./middleware/validateLogin');
const verifyJWT = require('./middleware/verifyJWT'); 

const PIPEFY_TOKEN = process.env.PIPEFYKEY;
const ORG_ID = process.env.PIPEFY_ORG_ID;
const { google } = require('googleapis');

// Inicialização segura com diagnóstico de erro
let prisma;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch (e) {
  console.error('ERRO AO INICIALIZAR O PRISMA:', e.message);
}


router.post('/login', validateLogin, async (req, res) => {
  const { username, password } = req.body;

  // 1. Valida se a camada do Prisma está operacional
  if (!prisma) {
    return res.status(500).json({ 
      error: 'Prisma não disponível no servidor. Configure a camada de dados.' 
    });
  }

  try {
    // 2. Busca do usuário na base de dados
    const user = await prisma.user.findUnique({ 
      where: { username: username?.trim() } 
    });

    // 3. Diagnóstico de Usuário não Encontrado
    if (!user) {
      console.log(`[LOGIN FAILED] Usuário "${username}" não foi encontrado no banco.`);
      return res.status(401).json({ 
        error: 'Credenciais inválidas',
        reason: 'USER_NOT_FOUND'
      });
    }

    const storedPassword = user.password_hash;
    const isBcryptHash = storedPassword && storedPassword.startsWith('$2');
    let validPassword = false;

    // 4. Comparação da senha (suporta BCrypt e texto puro legado)
    if (isBcryptHash) {
      validPassword = await bcrypt.compare(password, storedPassword);
    } else {
      // Fallback para senha em texto limpo salva no banco
      validPassword = (password === storedPassword);

      // Auto-migration: Atualiza para hash bcrypt no banco na primeira entrada válida
      if (validPassword) {
        console.log(`Migrando senha do usuário "${username}" para hash BCrypt...`);
        const newHash = await bcrypt.hash(password, 10);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { password_hash: newHash }
        });
      }
    }

    if (!validPassword) {
      console.log(`[LOGIN FAILED] Senha incorreta para o usuário "${username}".`);
      return res.status(401).json({ 
        error: 'Credenciais inválidas',
        reason: 'INVALID_PASSWORD'
      });
    }

    // 5. Garantia de existência do segredo JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('ERRO CRÍTICO: JWT_SECRET não definida no ambiente (.env)');
      return res.status(500).json({ error: 'Erro de configuração no servidor' });
    }

    // Tratamento para ID do tipo BigInt/String
    const userId = typeof user.id === 'bigint' ? user.id.toString() : user.id;

    // 6. Geração do Token JWT
    const token = jwt.sign(
      { 
        id: userId, 
        username: user.username, 
        role: user.role 
      }, 
      jwtSecret, 
      { expiresIn: '3h' }
    );

    return res.json({
      token,
      user: {
        id: userId,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Erro ao executar login no servidor:', error);
    return res.status(500).json({ error: 'Erro interno ao processar login' });
  }
});

// ==========================================
// ROTA: /pipes
// ==========================================
router.get('/pipes', verifyJWT,async (req, res) => {
  try {
    const query = `
      query GetOrgPipes($orgId: ID!) {
        organization(id: $orgId) {
          id
          name
          pipes {
            id
            name
          }
        }
      }
    `;

    const response = await fetch('https://api.pipefy.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PIPEFY_TOKEN}`
      },
      body: JSON.stringify({
        query,
        variables: { orgId: ORG_ID }
      })
    });

    const result = await response.json();

    if (result.errors) {
      return res.status(400).json({ errors: result.errors });
    }

    const pipes = result.data.organization.pipes || [];

    const cardsQuery = `
      query GetCardsFromPipe($pipeId: ID!) {
        allCards(pipeId: $pipeId, first: 100) {
          edges {
            node {
              id
              current_phase {
                name
                done
              }
            }
          }
        }
      }
    `;

    const pipeCounts = await Promise.all(
      pipes.map(async (pipe) => {
        const cardsResponse = await fetch('https://api.pipefy.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PIPEFY_TOKEN}`
          },
          body: JSON.stringify({
            query: cardsQuery,
            variables: { pipeId: pipe.id }
          })
        });

        const cardsResult = await cardsResponse.json();
        const edges = cardsResult?.data?.allCards?.edges || [];
        const activeCount = edges.reduce((count, edge) => {
          const phase = edge.node.current_phase;
          const phaseName = phase?.name?.trim().toLowerCase() || '';
          const done = phase?.done;
          if (done || phaseName === 'feito' || phaseName === 'arquivado') {
            return count;
          }
          return count + 1;
        }, 0);

        return {
          ...pipe,
          cards_count: activeCount
        };
      })
    );

    res.json({
      organization: result.data.organization.name,
      pipes: pipeCounts
    });

  } catch (error) {
    console.error('Erro ao buscar pipes do Pipefy:', error);
    res.status(500).json({ error: 'Erro ao buscar pipes do Pipefy' });
  }
});

// ==========================================
// ROTA: /latecards
// ==========================================
router.get('/latecards',verifyJWT,  async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(1, Math.min(50, parseInt(req.query.pageSize, 10) || 10));

    // 1. Busca todos os pipes da organização
    const pipesQuery = `
      query GetOrgPipes($orgId: ID!) {
        organization(id: $orgId) {
          name
          pipes {
            id
            name
          }
        }
      }
    `;

    const orgResponse = await fetch('https://api.pipefy.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PIPEFY_TOKEN}`
      },
      body: JSON.stringify({
        query: pipesQuery,
        variables: { orgId: ORG_ID }
      })
    });

    const orgResult = await orgResponse.json();

    if (orgResult.errors) {
      return res.status(400).json({ errors: orgResult.errors });
    }

    const orgName = orgResult.data.organization.name;
    const pipes = orgResult.data.organization.pipes || [];

    // 2. Query para buscar os cards de cada pipe com created_at e due_date
    const cardsQuery = `
      query GetCardsFromPipe($pipeId: ID!) {
        allCards(pipeId: $pipeId, first: 50) {
          edges {
            node {
              id
              title
              created_at
              due_date
              labels{
              name
              }
              current_phase {
                id
                name
                done
              }
            }
          }
        }
      }
    `;

    const pipeRequests = pipes.map(async (pipe) => {
      const response = await fetch('https://api.pipefy.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PIPEFY_TOKEN}`
        },
        body: JSON.stringify({
          query: cardsQuery,
          variables: { pipeId: pipe.id }
        })
      });

      const result = await response.json();
      
      if (result.data && result.data.allCards) {
        return {
          pipeName: pipe.name,
          edges: result.data.allCards.edges || []
        };
      }

      return { pipeName: pipe.name, edges: [] };
    });

    const pipeResults = await Promise.all(pipeRequests);

    // 3. Aplicação das Regras de Atraso
    const now = new Date();
    // Início do dia atual (00:00:00) para comparação limpa de data
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Data limite de criação: 1 mês atrás
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const allLateCards = [];

    for (const pipeData of pipeResults) {
      for (const edge of pipeData.edges) {
        const card = edge.node;
        const phaseName = card.current_phase ? card.current_phase.name.trim().toLowerCase() : '';
        const isDonePhase = card.current_phase ? card.current_phase.done : false;

        // FILTRO 1: Ignora colunas "feito", "arquivado" ou fases concluídas no Pipefy
        if (isDonePhase || phaseName === 'feito' || phaseName === 'arquivado') {
          continue;
        }

        let isLate = false;
        let reason = '';

        const createdAt = new Date(card.created_at);
        const dueDate = card.due_date ? new Date(card.due_date) : null;

        // REGRA A: Se tem prazo de conclusão e o prazo é anterior a hoje
        if (dueDate) {
          if (dueDate < startOfToday) {
            isLate = true;
            reason = 'Prazo vencido';
          }
        } 
        // REGRA B: Se NÃO tem prazo, mas foi criado há mais de 1 mês
        else {
          if (createdAt < oneMonthAgo) {
            isLate = true;
            reason = 'Criado há mais de 1 mês (sem prazo)';
          }
        }

        if (isLate) {
          allLateCards.push({
            id: card.id,
            title: card.title,
            createdAt: card.created_at,
            dueDate: card.due_date,
            pipeName: pipeData.pipeName,
            phaseName: card.current_phase ? card.current_phase.name : 'N/A',
            reason,
            // inclui labels (se disponíveis) para serem usadas no frontend
            labels: (card.labels || []).map((l) => (l && l.name) ? l.name : '').filter(Boolean)
          });
        }
      }
    }

    const totalLateCards = allLateCards.length;
    const totalPages = Math.max(1, Math.ceil(totalLateCards / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pagedCards = allLateCards.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    res.json({
      organization: orgName,
      totalLateCards,
      page: currentPage,
      pageSize,
      totalPages,
      cards: pagedCards,
      top10Cards: allLateCards.slice(0, 10)
    });

  } catch (error) {
    console.error('Erro backend:', error);
    res.status(500).json({ error: 'Erro ao calcular cards atrasados' });
  }
});
router.get('/form-responses', verifyJWT, async (req, res) => {
  try {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !rawPrivateKey || !spreadsheetId) {
      return res.status(500).json({ 
        error: 'Credenciais do Google incompletas no arquivo .env' 
      });
    }

    const formattedPrivateKey = rawPrivateKey
      .replace(/^"(.*)"$/, '$1')
      .replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: formattedPrivateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A1:Z1000',
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.json({ success: true, total: 0, responses: [] });
    }

    // 1. Define as referências de Mês/Ano Atual e Mês/Ano Anterior
    const now = new Date();
    
    // Mês Atual
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Mês Anterior (Garante a virada de ano correta, ex: Jan/2026 -> Dez/2025)
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = previousDate.getMonth();
    const previousYear = previousDate.getFullYear();

    const headers = rows[0];

    // 2. Filtra e mapeia os dados
    const data = rows
      .slice(1)
      .filter(row => row.length > 0 && row.some(cell => cell.trim() !== ''))
      .map(row => {
        let obj = {};
        headers.forEach((header, index) => {
          const cleanHeader = header ? header.trim() : `Coluna_${index + 1}`;
          obj[cleanHeader] = row[index] !== undefined ? row[index].trim() : '';
        });
        return obj;
      })
      .filter(item => {
        const dateStr = item['Carimbo de data/hora'] || item['Timestamp'] || item[headers[0]];
        if (!dateStr) return false;

        let itemDate;
        if (dateStr.includes('/')) {
          // Trata formato PT-BR: DD/MM/YYYY
          const parts = dateStr.split(' ')[0].split('/');
          itemDate = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
          itemDate = new Date(dateStr);
        }

        if (isNaN(itemDate.getTime())) return false;

        const itemMonth = itemDate.getMonth();
        const itemYear = itemDate.getFullYear();

        // 3. Valida se a data pertence ao Mês Atual OU ao Mês Anterior
        const isCurrentMonth = itemMonth === currentMonth && itemYear === currentYear;
        const isPreviousMonth = itemMonth === previousMonth && itemYear === previousYear;

        return isCurrentMonth || isPreviousMonth;
      });

    return res.json({ 
      success: true, 
      total: data.length, 
      responses: data 
    });

  } catch (error) {
    console.error('Erro ao ler planilha via API do Google:', error.message || error);
    res.status(500).json({ 
      error: 'Erro ao buscar respostas do formulário', 
      details: error.message 
    });
  }
});

module.exports = router;