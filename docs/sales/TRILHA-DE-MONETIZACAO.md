## Trilha de Monetização — Tomik CRM

### O que é
A Trilha de Monetização é uma experiência guiada, prática e gamificada dentro do Tomik CRM para levar você do zero ao seu primeiro cliente pago oferecendo soluções com Agentes de IA humanizados. Ela combina três peças fundamentais:
- **Canal oficial**: WhatsApp (recomendado Manychat) para conversar com leads e clientes.
- **Orquestração**: **n8n** para executar e versionar fluxos (o “cérebro” dos seus agentes).
- **Kit de humanização**: **Tomik CRM** para memória operacional, UI e integração segura com a IA.

Ao avançar pelas fases com tarefas e aulas, você aprende a montar o primeiro agente, listar oportunidades, entregar valor rápido e fechar um contrato com recorrência.

### Para quem
- **Freelancers e agências** que desejam vender atendimento, vendas e agendamentos automatizados com IA.
- **Empreendedores** que querem validar rápido e profissionalizar a oferta usando ferramentas confiáveis.

### Como funciona
- **Fases**: cada fase possui uma introdução breve e desbloqueia um conjunto de tarefas e aulas.
- **Progresso**: você marca tarefas/aulas concluídas. Uma **barra de progresso** mostra o avanço e, ao atingir 100%, você é direcionado à tela de parabéns.
- **Gating por fase**: toda fase começa com uma breve introdução. Ao concluir, a fase é desbloqueada para suas tarefas/aulas.
- **Experiência gamificada**: animações, CTAs contextuais e lembretes tornam o avanço fluido e motivador.

No app, a trilha é renderizada pelo componente `src/components/features/Monetization/MonetizationTrail.tsx` e, ao concluir, exibe `src/components/features/Monetization/MonetizationCongrats.tsx`.

### Estrutura (Fases)
- **1) Entender as Ferramentas Necessárias**
  - **WhatsApp (Manychat)**: por ser oficial, estável e em conformidade.
  - **n8n**: orquestra seus processos e fluxos de agentes.
  - **Tomik CRM**: memória e operação dos agentes, com UI pronta para trabalhar.
- **2) Entender a Aplicabilidade**
  - Onde a IA gera resultado: **Atendimento**, **Vendas** e **Agendamentos/Follow-ups**.
  - Como os módulos do Tomik (CRM, Agenda, Financeiro, Produtos/Serviços, Funil de Métricas, Análise de Mensagens) suportam esses resultados.
- **3) Construir sua primeira solução humanizada**
  - Criar conta em uma API oficial de WhatsApp (recomendado Manychat) e conectar o canal.
  - Criar conta no **n8n** e no **Tomik CRM (BYO Supabase)**.
  - Entender o diagrama do agente (WhatsApp ⇄ n8n ⇄ Tomik/Supabase).
  - Criar o primeiro agente com acesso ao Tomik via nodes do Supabase.
  - Aprender a diagnosticar e corrigir erros de automação.
  - Aulas extras (opcionais) de VPS: subir VPS, configurar domínio e instalar n8n.
  - Observação: as aulas de VPS aparecem quando a tarefa "Criar conta no n8n" está ativa.
- **4) Listar oportunidades ao seu redor**
  - Liste pessoas/empresas que precisam de atendimento, vendas ou agendamentos.
  - Entenda problemas e proponha soluções simples.
- **5) Início alavancado**
  - Ofereça uma entrega simples gratuitamente (com clareza de que haverá cobrança futura).
  - Monte o agente com CRM e treine com base no negócio.
- **6) Reunião de feedbacks e fechamento**
  - Após 7–15 dias, colete feedbacks baseados em métricas.
  - Ofereça **recorrência** com melhoria contínua.
- **7) Hora de se profissionalizar**
  - Domine fluxo de trabalho, sistema de treinamento e orquestração de times de agentes.

### Integrações e recursos chaves
- **Manychat (WhatsApp oficial)**: vídeos e CTAs contextuais ajudam na configuração do canal.
- **n8n**: conexão guiada, criação de credencial do Supabase e instalação de fluxos a partir de templates (seeds) direto do app.
- **Supabase (BYO)**: o Tomik CRM utiliza seu próprio projeto Supabase para dados; os agentes acessam o CRM com segurança via credenciais controladas.

### Persistência do progresso
- O progresso é salvo por **organização** na tabela `public.monetization_trail_progress` (RLS por organização), e há cache em **localStorage** para resposta imediata.
- Você pode marcar/desmarcar itens individualmente ou concluir uma fase inteira de uma vez.

### Como acessar no app
- Abra o Tomik CRM e vá até a área de **Monetization Trail**. No código, a rota/aba correspondente carrega o componente `MonetizationTrail` a partir do `src/App.tsx`.

### Benefícios práticos
- **Clareza do caminho**: do entendimento à oferta paga com recorrência.
- **Material multimídia**: vídeos (Vimeo/YouTube), slides e imagens dentro do app.
- **CTAs guiadas**: atalhos para criar contas e instalar recursos no momento certo.
- **Métricas e profissionalização**: fechamento com foco em resultados e evolução contínua.

### Perguntas frequentes
- **Posso usar outra API de WhatsApp que não seja Manychat?**
  - Recomendamos **API oficial** pela estabilidade e conformidade. Manychat é a opção sugerida na trilha, mas é possível adaptar desde que seja oficial.
- **Preciso de VPS para o n8n?**
  - Não é obrigatório. A trilha oferece aulas para quem quiser uma infraestrutura própria com mais controle e estabilidade.
- **A trilha altera meu banco de dados?** 
  - Apenas registra seu progresso por organização em `monetization_trail_progress` e, opcionalmente, usa cache local. Seus dados operacionais continuam nos módulos do Tomik.

### Links úteis
- **Manychat**: [Abrir site](https://manychat.com/)
- **n8n**: [Abrir site](https://n8n.io/)
- **Hostinger (VPS)**: [Criar conta](https://www.hostinger.com/)

Se precisar, abra a trilha no app e siga os passos. Em caso de dúvidas, volte a esta página para relembrar o objetivo de cada fase e como elas se conectam.

