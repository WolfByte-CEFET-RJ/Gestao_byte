const express = require('express');
const router = express.Router();

const PIPEFY_TOKEN = process.env.PIPEFYKEY;
const ORG_ID = process.env.PIPEFY_ORG_ID;

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
            cards_count
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

    res.json({
      organization: result.data.organization.name,
      pipes: result.data.organization.pipes
    });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar pipes do Pipefy' });
  }
});

// GET /api/cards/late -> Lista os cards atrasados da organização
router.get('/latecards', async (req, res) => {
  console.log("aqui quebrou")
  try {
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
    // Inicio do dia atual (00:00:00) para comparação limpa de data
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

    res.json({
      organization: orgName,
      totalLateCards: allLateCards.length,
      top10Cards: allLateCards.slice(0, 10)
    });

  } catch (error) {
    console.error('Erro backend:', error);
    res.status(500).json({ error: 'Erro ao calcular cards atrasados' });
  }
});

module.exports = router;