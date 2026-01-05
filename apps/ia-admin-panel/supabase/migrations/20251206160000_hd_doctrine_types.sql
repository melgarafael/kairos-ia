-- Human Design Ra Uru Hu Doctrine: Types (Part 1)
-- Source: Jovian Archive - https://jovianarchive.com/pages/type-and-strategy-in-human-design
-- Priority 100 = Core content (80/20 rule)

-- Update existing type entries with new columns
UPDATE public.hd_library_entries SET category = 'tipo', priority = 100, source_url = 'https://jovianarchive.com/pages/type-and-strategy-in-human-design' WHERE slug LIKE 'tipo-%';

-- GENERATOR - Complete Ra Uru Hu Doctrine
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('tipo-generator-completo', 'Generator - Doutrina Completa de Ra Uru Hu',
'O Generator é o Tipo mais comum, representando cerca de 70% da população mundial. A essência do Generator está no Centro Sacral definido - o centro da energia vital, sexualidade, criatividade e força de trabalho.

## Mecânica do Generator

O Generator possui uma aura envolvente e acolhedora que atrai a vida para si. Diferente do Manifestor, o Generator não é projetado para iniciar ações do nada. Sua mecânica é responder ao que a vida apresenta.

## Estratégia: RESPONDER

Ra Uru Hu ensinou que a estratégia do Generator é **esperar para responder**. Isso não significa passividade - significa não iniciar da mente.

**Como funciona:**
1. A vida traz algo para o seu campo (uma oportunidade, pergunta, situação)
2. O Centro Sacral responde com um som gutural ("uh-huh" para sim, "uh-uh" para não)
3. Você segue a resposta sacral, não a racionalização mental

**O som sacral:** É um som que vem do ventre, não da garganta. É primitivo, corporal, instantâneo. A mente não pode fabricá-lo.

## Assinatura: SATISFAÇÃO

Quando o Generator vive corretamente - respondendo em vez de iniciar - ele experimenta profunda **satisfação**. Cada dia termina com sensação de realização, de ter usado sua energia no que realmente importa.

## Tema Não-Self: FRUSTRAÇÃO

Quando o Generator não honra sua estratégia:
- Inicia projetos da mente em vez de responder
- Diz "sim" por educação quando o corpo disse "não"
- Trabalha no que não ama

O resultado é **frustração crônica** - a sensação de que a vida é uma luta constante, de estar sempre empurrando contra resistência.

## Autoridade do Generator

A maioria dos Generators tem Autoridade Emocional (se o Centro Emocional é definido) ou Autoridade Sacral (se não é). A estratégia de Responder funciona em conjunto com a Autoridade:

- **Autoridade Emocional:** Responda e depois espere clareza emocional
- **Autoridade Sacral:** A resposta sacral É a decisão, no momento

## Dicas Práticas

1. **Pratique perguntas sim/não:** Peça para alguém fazer perguntas de sim ou não para você sentir a resposta sacral
2. **Observe o que te dá energia:** O que faz você se sentir vivo e o que te drena?
3. **Não force:** Se não há resposta sacral, não há nada para responder ainda
4. **Durma quando estiver esgotado:** Generators precisam gastar energia sacral antes de dormir',
ARRAY['tipo', 'generator', 'sacral', 'responder', 'estrategia', 'satisfacao', 'frustracao', 'core'],
'tipo', 100, 'https://jovianarchive.com/pages/type-and-strategy-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- MANIFESTING GENERATOR
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('tipo-mg-completo', 'Manifesting Generator - Doutrina Completa de Ra Uru Hu',
'O Manifesting Generator (MG) é uma variação híbrida do Generator, representando cerca de 32% da população. Possui tanto o Centro Sacral definido quanto uma conexão motor-garganta que permite manifestar.

## Mecânica do MG

O MG combina a energia sustentada do Generator com a capacidade de iniciar do Manifestor. Mas - e isso é crucial - **a ordem importa**: primeiro responder, depois manifestar.

## Estratégia: RESPONDER, DEPOIS INFORMAR

Ra Uru Hu ensinou que o MG tem uma estratégia em duas partes:

1. **Primeiro: Responder** - Como Generator, espere algo chegar ao seu campo e observe a resposta sacral
2. **Depois: Informar** - Como Manifestor, antes de agir, informe quem será impactado

**O erro comum:** MGs frequentemente pulam direto para a ação (manifestando) sem esperar responder. Isso gera frustração E raiva.

## Característica Especial: VELOCIDADE

MGs são naturalmente rápidos e multi-tarefas. Eles:
- Pulam etapas
- Fazem várias coisas ao mesmo tempo
- Voltam atrás para pegar o que perderam

**Isso não é defeito - é design.** Ra ensinou que MGs não funcionam de forma linear. Eles funcionam em espiral.

## Assinatura: SATISFAÇÃO E PAZ

O MG alinhado sente tanto a satisfação do Generator (por usar energia no que ama) quanto a paz do Manifestor (por informar e reduzir resistência).

## Tema Não-Self: FRUSTRAÇÃO E RAIVA

O MG desalinhado pode sentir:
- **Frustração** (de não responder)
- **Raiva** (de não informar e encontrar resistência)
- Ou ambos alternadamente

## Autoridade

Como Generators, MGs geralmente têm Autoridade Emocional ou Sacral. A estratégia de duas partes funciona com qualquer autoridade.

## Dicas Práticas

1. **Permita-se ser rápido:** Não force linearidade
2. **Voltar atrás é OK:** Pular etapas e retornar faz parte do seu processo
3. **Responda ANTES de iniciar:** O impulso de manifestar é forte, mas espere a resposta sacral
4. **Informe sem pedir permissão:** Informar não é pedir licença, é comunicar',
ARRAY['tipo', 'manifesting-generator', 'mg', 'sacral', 'responder', 'informar', 'estrategia', 'core'],
'tipo', 100, 'https://jovianarchive.com/pages/type-and-strategy-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- MANIFESTOR
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('tipo-manifestor-completo', 'Manifestor - Doutrina Completa de Ra Uru Hu',
'O Manifestor é o único Tipo que pode verdadeiramente iniciar ação. Representa apenas cerca de 9% da população. Historicamente, foram os reis, líderes e iniciadores da humanidade.

## Mecânica do Manifestor

O Manifestor tem uma conexão motor-garganta SEM Centro Sacral definido. Isso significa:
- Energia para iniciar em explosões, não sustentada
- Aura fechada e repelente
- Capacidade de impactar sem ser impactado

## Estratégia: INFORMAR

Ra Uru Hu ensinou que a estratégia do Manifestor é **informar antes de agir**.

**Por que informar?**
A aura do Manifestor é fechada - os outros não conseguem "ler" o que ele vai fazer. Quando um Manifestor age sem aviso, cria-se resistência, surpresa, e frequentemente, conflito.

**Informar NÃO é:**
- Pedir permissão
- Buscar aprovação
- Explicar ou justificar

**Informar É:**
- Comunicar a intenção: "Vou fazer X"
- Dar contexto para quem será impactado
- Abrir a aura temporariamente

## Assinatura: PAZ

O Manifestor que informa experimenta **paz**. A resistência diminui, os caminhos se abrem, as pessoas cooperam naturalmente.

## Tema Não-Self: RAIVA

O Manifestor que não informa encontra resistência constante. O mundo parece estar sempre no caminho. A resposta emocional é **raiva** - raiva de ser controlado, limitado, impedido.

**A raiva do Manifestor:** É diferente de outras formas de raiva. É a raiva de ter sua natureza iniciadora bloqueada. É a raiva de ser tratado como criança quando se é um iniciador nato.

## Autoridade

Manifestors podem ter várias autoridades:
- Emocional (mais comum)
- Esplênica
- Ego/Coração
- Self

A estratégia de Informar funciona com qualquer autoridade.

## Energia do Manifestor

**Importante:** Manifestors NÃO têm energia sustentada. Eles trabalham em ciclos:
1. Impulso para iniciar (explosão de energia)
2. Ação intensa
3. Necessidade de descanso

Tentar manter energia constante leva ao esgotamento.

## Dicas Práticas

1. **Informe antes de agir:** Mesmo coisas pequenas, especialmente no início
2. **Não espere aprovação:** Informar não requer resposta
3. **Respeite seus ciclos:** Descanse quando precisar
4. **Crianças Manifestoras:** Precisam de liberdade para iniciar, com a responsabilidade de informar',
ARRAY['tipo', 'manifestor', 'informar', 'estrategia', 'paz', 'raiva', 'iniciar', 'core'],
'tipo', 100, 'https://jovianarchive.com/pages/type-and-strategy-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PROJECTOR
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('tipo-projector-completo', 'Projector - Doutrina Completa de Ra Uru Hu',
'O Projector é o guia da nova humanidade. Sem Centro Sacral definido e sem conexão motor-garganta consistente, representa cerca de 20% da população.

## Mecânica do Projector

O Projector tem uma aura focada e penetrante que:
- Entra profundamente no outro
- Vê o que outros não veem
- Reconhece e guia a energia alheia

**Importante:** O Projector não tem energia sustentada própria. Ele trabalha COM a energia dos outros, especialmente Generators.

## Estratégia: ESPERAR PELO CONVITE

Ra Uru Hu ensinou que a estratégia do Projector é **esperar pelo convite** para as grandes áreas da vida.

**Áreas que requerem convite:**
- Carreira/trabalho
- Relacionamentos amorosos
- Onde morar
- Direção de vida

**O que é um convite verdadeiro:**
- Reconhecimento genuíno de quem você é
- Não apenas "preciso de ajuda" mas "reconheço SEU valor"
- Formal e claro

**O que NÃO requer convite:**
- Coisas do dia-a-dia
- Interações casuais
- Pequenas decisões

## Assinatura: SUCESSO

O Projector que é reconhecido e convidado experimenta **sucesso** genuíno. Não sucesso definido pela sociedade, mas a experiência de usar seus dons onde são valorizados.

## Tema Não-Self: AMARGURA

O Projector que:
- Não espera convites
- Oferece guiança não solicitada
- Força reconhecimento

Experimenta **amargura profunda**. A sensação de que ninguém vê seu valor, de que está sempre dando e nunca recebendo.

## O Paradoxo do Convite

**Como ser convidado se precisa esperar?**

Ra ensinou que Projectors devem usar o tempo de espera para:
1. **Estudar sistemas** - Entender profundamente algo
2. **Desenvolver maestria** - Tornar-se excelente em sua área
3. **Cuidar de si** - Descansar, pois não têm energia sacral

Quando o Projector tem conhecimento genuíno, os convites vêm.

## Autoridade

Projectors podem ter:
- Emocional
- Esplênica
- Ego/Coração
- Self
- Mental/Ambiental (exclusiva de alguns Projectors)

## Energia do Projector

**Crucial:** Projectors NÃO são feitos para trabalho sustentado de 8 horas. Eles:
- Amplificam energia dos outros
- Precisam de muito descanso
- Trabalham melhor em concentração do que em quantidade

## Dicas Práticas

1. **Não ofereça guiança não solicitada:** Mesmo que você veja claramente o problema
2. **Use o tempo de espera:** Estude, aprenda, desenvolva-se
3. **Descanse ANTES de estar cansado:** Você não tem reservas sacrais
4. **Reconheça convites genuínos:** Nem todo pedido de ajuda é um convite',
ARRAY['tipo', 'projector', 'projetor', 'convite', 'reconhecimento', 'estrategia', 'sucesso', 'amargura', 'core'],
'tipo', 100, 'https://jovianarchive.com/pages/type-and-strategy-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- REFLECTOR
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('tipo-reflector-completo', 'Reflector - Doutrina Completa de Ra Uru Hu',
'O Reflector é o Tipo mais raro, representando apenas cerca de 1% da população. Não possui nenhum centro definido - é completamente aberto, um espelho perfeito da comunidade e do cosmos.

## Mecânica do Reflector

O Reflector tem todos os nove centros abertos/indefinidos. Isso significa:
- Amplifica tudo ao seu redor
- É profundamente condicionado pelo ambiente
- Muda constantemente com os trânsitos planetários

**O Reflector e a Lua:** Ao longo de 28 dias (um ciclo lunar), a Lua ativa diferentes portas no mapa do Reflector. Por isso, cada dia é literalmente diferente para um Reflector.

## Estratégia: ESPERAR UM CICLO LUNAR

Ra Uru Hu ensinou que para decisões importantes, o Reflector deve **esperar um ciclo lunar completo** (aproximadamente 28 dias).

**Por que 28 dias?**
- O Reflector processa através do ciclo lunar
- Cada dia traz uma perspectiva diferente
- A clareza emerge ao experimentar todas as "versões" de si mesmo

**Isso não significa:**
- Esperar 28 dias para tudo
- Paralisia decisória
- Não poder fazer nada

**Significa:**
- Para GRANDES decisões, dar-se tempo
- Observar como se sente ao longo do ciclo
- Não decidir em um único dia

## Assinatura: SURPRESA

O Reflector alinhado vive em estado de **surpresa** e maravilhamento. A vida continua revelando novas facetas, novos aspectos de si mesmo e do mundo.

## Tema Não-Self: DECEPÇÃO

O Reflector desalinhado sente **decepção profunda**:
- Quando toma decisões rápidas demais
- Quando está no ambiente errado
- Quando se identifica com o que não é seu

## O Ambiente é TUDO

**Para o Reflector, o ambiente não é importante - é TUDO.**

Ra ensinou que:
- O Reflector é o "canário na mina de carvão"
- Reflete a saúde ou doença da comunidade
- Seu bem-estar depende totalmente de onde e com quem está

**Escolher ambiente:** Um Reflector saudável em ambiente tóxico ficará doente. Um Reflector doente em ambiente saudável pode curar-se.

## Autoridade: LUNAR

O Reflector tem uma autoridade única: **Lunar/Nenhuma**.

Não há um centro interno consistente para tomar decisões. A clareza vem:
- Do tempo (ciclo lunar)
- Do diálogo com pessoas corretas
- Da observação de si mesmo em diferentes ambientes

## O Reflector como Espelho

O dom especial do Reflector é **refletir** para os outros o que eles não conseguem ver em si mesmos. Quando reconhecido por isso, o Reflector se torna um avaliador valioso de pessoas, comunidades e ambientes.

## Dicas Práticas

1. **Escolha seu ambiente com cuidado máximo:** Mude se necessário
2. **Não se identifique com nada:** O que você sente hoje pode ser dos outros ou do trânsito
3. **Dê-se tempo:** Especialmente para decisões importantes
4. **Encontre pessoas para dialogar:** Sua clareza vem do diálogo
5. **Observe padrões lunares:** Comece a notar como você muda ao longo do mês',
ARRAY['tipo', 'reflector', 'lunar', 'espelho', 'ambiente', 'estrategia', 'surpresa', 'decepcao', 'core'],
'tipo', 100, 'https://jovianarchive.com/pages/type-and-strategy-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

