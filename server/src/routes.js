const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const validateLogin = require('./middleware/validateLogin');

const PIPEFY_TOKEN = process.env.PIPEFYKEY;
const ORG_ID = process.env.PIPEFY_ORG_ID;

// Inicialização segura com diagnóstico de erro
let prisma;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
} catch (e) {
  console.error('🔥 ERRO AO INICIALIZAR O PRISMA:', e.message);
}

// ==========================================
// ROTA DE LOGIN (Com Suporte a Plaintext & Auto-Hash)
// ==========================================
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
        console.log(`🔄 Migrando senha do usuário "${username}" para hash BCrypt...`);
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
      console.error('🔥 ERRO CRÍTICO: JWT_SECRET não definida no ambiente (.env)');
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
    console.error('🔥 Erro ao executar login no servidor:', error);
    return res.status(500).json({ error: 'Erro interno ao processar login' });
  }
});

// ==========================================
// ROTA: /pipes
// ==========================================
router.get('/pipes', async (req, res) => {
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
router.get('/latecards', async (req, res) => {
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
            reason
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

module.exports = router;