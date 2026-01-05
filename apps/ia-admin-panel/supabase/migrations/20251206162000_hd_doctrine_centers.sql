-- Human Design Ra Uru Hu Doctrine: Centers and Not-Self (Part 3)
-- Source: Jovian Archive - https://jovianarchive.com/pages/the-nine-centers-of-the-bodygraph-in-human-design
-- Priority 80 = Essential content

-- CENTRO HEAD (CABEÇA)
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('centro-head-completo', 'Centro Head (Cabeça) - Doutrina de Ra Uru Hu',
'O Centro Head (Cabeça) é o centro de pressão mental, inspiração e questionamento. É um centro de pressão, não de consciência.

## Função do Centro Head

- Pressão para pensar, questionar, duvidar
- Inspiração e ideias
- Perguntas existenciais
- Conexão com o campo mental coletivo

## Head Definido

Quando você tem o Head definido:
- Pressão mental consistente e específica
- Inspira outros com suas questões
- Pode ter dificuldade em "desligar" a mente
- As perguntas que você faz são suas

## Head Aberto

Quando você tem o Head aberto:
- Amplifica a pressão mental dos outros
- Pode ficar sobrecarregado por perguntas que não são suas
- Sabedoria em reconhecer questões importantes vs. triviais
- Pode se perder tentando responder tudo

## Tema Não-Self do Head Aberto

"Estou tentando responder perguntas que não importam para mim"

**Sinais de Não-Self:**
- Obsessão com questões dos outros
- Pressão constante para entender tudo
- Não conseguir parar de pensar
- Ansiedade mental

**Sabedoria:** Saber quais perguntas valem a pena perseguir',
ARRAY['centro', 'head', 'cabeca', 'pressao', 'inspiracao', 'mente'],
'centro', 80, 'https://jovianarchive.com/pages/the-nine-centers-of-the-bodygraph-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- CENTRO AJNA
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('centro-ajna-completo', 'Centro Ajna - Doutrina de Ra Uru Hu',
'O Centro Ajna é o centro de consciência mental, conceituação e processamento de informação. É onde pensamos, analisamos e formamos opiniões.

## Função do Centro Ajna

- Processar informação
- Formar conceitos e opiniões
- Analisar e pesquisar
- Expressar pensamentos

## Ajna Definido

Quando você tem o Ajna definido:
- Forma consistente de processar informação
- Opiniões e conceitos relativamente fixos
- Pode parecer teimoso mentalmente
- Confiável na forma de pensar

## Ajna Aberto

Quando você tem o Ajna aberto:
- Flexibilidade mental
- Pode ver múltiplas perspectivas
- Pode ficar confuso com tantas visões
- Amplifica os pensamentos dos outros

## Tema Não-Self do Ajna Aberto

"Estou fingindo ter certeza sobre coisas que não tenho"

**Sinais de Não-Self:**
- Fingir certeza mental que não existe
- Mudar de opinião dependendo de quem está por perto
- Ansiedade por não ter respostas fixas
- Defender ideias que não são suas

**Sabedoria:** Reconhecer que flexibilidade mental é um dom, não uma falha',
ARRAY['centro', 'ajna', 'mente', 'conceitos', 'analise', 'opiniao'],
'centro', 80, 'https://jovianarchive.com/pages/the-nine-centers-of-the-bodygraph-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- CENTRO THROAT (GARGANTA)
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('centro-throat-completo', 'Centro Throat (Garganta) - Doutrina de Ra Uru Hu',
'O Centro Throat (Garganta) é o centro de manifestação, expressão e comunicação. É o único centro que pode transformar energia em ação ou palavra.

## Função do Centro Throat

- Manifestação (transformar em realidade)
- Comunicação e expressão
- Metabolismo físico
- Conexão entre pensar e fazer

## Throat Definido

Quando você tem o Throat definido:
- Forma consistente de comunicar
- Pode iniciar através da fala
- Voz e presença reconhecíveis
- Metabolismo mais estável

## Throat Aberto

Quando você tem o Throat aberto:
- Flexibilidade na comunicação
- Pode falar de muitas formas diferentes
- Pode atrair atenção tentando ser ouvido
- Vulnerável a falar demais ou de menos

## Tema Não-Self do Throat Aberto

"Estou tentando atrair atenção falando/agindo"

**Sinais de Não-Self:**
- Falar para ser notado
- Agir para chamar atenção
- Interromper para ser ouvido
- Forçar manifestação antes da hora

**Sabedoria:** Esperar o momento certo para falar e agir, não forçar expressão',
ARRAY['centro', 'throat', 'garganta', 'manifestacao', 'comunicacao', 'expressao'],
'centro', 80, 'https://jovianarchive.com/pages/the-nine-centers-of-the-bodygraph-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- CENTRO G
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('centro-g-completo', 'Centro G (Identidade) - Doutrina de Ra Uru Hu',
'O Centro G é o centro de identidade, direção e amor. É o "GPS interno" que determina quem você é e para onde está indo.

## Função do Centro G

- Identidade (quem você é)
- Direção na vida
- Amor e conexão
- Senso de propósito

## G Definido

Quando você tem o G definido:
- Senso fixo de identidade
- Direção relativamente clara
- Sabe quem é independente do ambiente
- Magnetismo de amor consistente

## G Aberto

Quando você tem o G aberto:
- Identidade fluida e adaptável
- Direção influenciada pelo ambiente
- Pode ser muitas "pessoas" diferentes
- Muito sensível a lugares e pessoas

## Tema Não-Self do G Aberto

"Estou buscando amor e direção nos lugares errados"

**Sinais de Não-Self:**
- Busca desesperada por identidade fixa
- Ficar em lugares/relacionamentos errados por medo
- Não saber quem você é
- Deixar outros definirem sua direção

**Sabedoria:** O ambiente é tudo para você - escolha bem. Sua identidade fluida é um dom, não um problema.

## Importância do Ambiente

Ra ensinou que para G aberto:
- O lugar onde você está determina quem você pode ser
- Relacionamentos te definem temporariamente
- Mudar de ambiente pode mudar tudo',
ARRAY['centro', 'g', 'identidade', 'direcao', 'amor', 'proposito'],
'centro', 80, 'https://jovianarchive.com/pages/the-nine-centers-of-the-bodygraph-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- CENTRO SACRAL - Expandido
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('centro-sacral-completo', 'Centro Sacral - Doutrina de Ra Uru Hu',
'O Centro Sacral é o centro da energia vital, sexualidade, criatividade e força de trabalho. É o motor mais poderoso do bodygraph.

## Função do Centro Sacral

- Energia vital sustentada
- Força de trabalho
- Sexualidade e criatividade
- Resposta à vida

## Sacral Definido (Generators e MGs)

Quando você tem o Sacral definido:
- Energia sustentada para trabalho
- Resposta sacral (uh-huh/uh-uh)
- Capacidade de "fazer" consistentemente
- Precisa gastar energia antes de dormir

**O Som Sacral:** Ra ensinou que o som sacral é a voz do corpo. É primitivo, instantâneo, e não mente.

## Sacral Aberto (Manifestors, Projectors, Reflectors)

Quando você tem o Sacral aberto:
- NÃO tem energia sustentada própria
- Amplifica a energia dos outros
- Pode se sentir "super energizado" perto de Generators
- Precisa descansar ANTES de estar esgotado

## Tema Não-Self do Sacral Aberto

"Não sei quando parar"

**Sinais de Não-Self:**
- Trabalhar até colapsar
- Tentar acompanhar ritmo de Generators
- Ignorar sinais de cansaço
- Usar energia emprestada como se fosse sua

**Sabedoria:** Reconhecer que você não tem bateria infinita. Descansar é essencial, não luxo.',
ARRAY['centro', 'sacral', 'energia', 'trabalho', 'sexualidade', 'generator'],
'centro', 80, 'https://jovianarchive.com/pages/the-nine-centers-of-the-bodygraph-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- CENTRO EMOCIONAL - Expandido
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('centro-emocional-completo', 'Centro Emocional (Solar Plexus) - Doutrina de Ra Uru Hu',
'O Centro Emocional (Solar Plexus) é o centro das emoções, sentimentos e sistema nervoso. É um motor E um centro de consciência.

## Função do Centro Emocional

- Emoções e sentimentos
- Onda emocional
- Paixão e desejo
- Sistema nervoso

## Emocional Definido

Quando você tem o Emocional definido:
- Você TEM uma onda emocional própria
- Seus humores são seus, não de outros
- Precisa de tempo para clareza (não decida no calor)
- Sua onda afeta outros ao redor

**A Onda:** Sobe (esperança) → Desce (desespero) → Clareza está no MEIO

## Emocional Aberto

Quando você tem o Emocional aberto:
- NÃO tem onda emocional própria
- Amplifica as emoções dos outros
- Pode confundir emoções alheias com suas
- Muito sensível ao clima emocional

## Tema Não-Self do Emocional Aberto

"Estou evitando confronto e verdade para manter a paz"

**Sinais de Não-Self:**
- Evitar conflito a qualquer custo
- Absorver e carregar emoções dos outros
- Não saber se a emoção é sua ou de outro
- Buscar ambientes "felizes" compulsivamente

**Sabedoria:** Você é um "empath natural". Aprenda a distinguir o que é seu do que é dos outros.',
ARRAY['centro', 'emocional', 'solar-plexus', 'onda', 'sentimentos', 'paixao'],
'centro', 80, 'https://jovianarchive.com/pages/the-nine-centers-of-the-bodygraph-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- CENTRO BAÇO (SPLEEN)
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('centro-baco-completo', 'Centro Baço (Spleen) - Doutrina de Ra Uru Hu',
'O Centro do Baço (Spleen) é o centro de consciência mais antigo - intuição, sobrevivência, sistema imunológico e bem-estar no momento presente.

## Função do Centro Baço

- Intuição instantânea
- Sobrevivência e medo saudável
- Sistema imunológico
- Bem-estar momento a momento
- Tempo (presente)

## Baço Definido

Quando você tem o Baço definido:
- Intuição consistente e confiável
- Sistema imunológico mais forte
- Sabe quando algo é seguro ou não
- Opera no AGORA - a voz não se repete

**Característica especial:** O Baço fala uma vez só, sutilmente. Se você "pensar" demais, perde.

## Baço Aberto

Quando você tem o Baço aberto:
- Amplifica medos e intuições dos outros
- Sistema imunológico mais sensível
- Pode ignorar sinais de perigo ou exagerá-los
- Aprende sobre medos através da experiência

## Tema Não-Self do Baço Aberto

"Estou segurando coisas/pessoas/situações que não são saudáveis para mim"

**Sinais de Não-Self:**
- Ficar em situações ruins por medo da mudança
- Ignorar sinais de que algo não é bom para você
- Deixar medos dos outros controlarem você
- Não confiar nos próprios instintos

**Sabedoria:** Aprender a distinguir medo real de medo amplificado. Soltar o que não serve.',
ARRAY['centro', 'baco', 'spleen', 'intuicao', 'sobrevivencia', 'imunidade', 'medo'],
'centro', 80, 'https://jovianarchive.com/pages/the-nine-centers-of-the-bodygraph-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- CENTRO EGO (CORAÇÃO)
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('centro-ego-completo', 'Centro Ego/Coração - Doutrina de Ra Uru Hu',
'O Centro Ego (também chamado de Coração ou Will) é o centro da força de vontade, valor próprio, compromissos e materialidade.

## Função do Centro Ego

- Força de vontade
- Valor próprio
- Compromissos e promessas
- Recursos materiais
- Competição saudável

## Ego Definido

Quando você tem o Ego definido:
- Força de vontade consistente
- Sabe fazer promessas que pode cumprir
- Senso de valor próprio mais estável
- Trabalha bem em ciclos (esforço → descanso)

**Importante:** O Ego definido ainda precisa de descanso. Força de vontade não é infinita.

## Ego Aberto

Quando você tem o Ego aberto:
- Força de vontade inconsistente (e tudo bem)
- Pode sentir que precisa provar seu valor
- Vulnerável a promessas excessivas
- Amplifica a vontade dos outros

## Tema Não-Self do Ego Aberto

"Estou sempre tentando provar meu valor"

**Sinais de Não-Self:**
- Promessas que não pode cumprir
- Trabalho excessivo para provar valor
- Competição obsessiva
- Nunca se sentir "suficiente"

**Sabedoria:** Seu valor não precisa ser provado. Você não precisa ter força de vontade constante. Descanso não é fraqueza.',
ARRAY['centro', 'ego', 'coracao', 'will', 'vontade', 'valor', 'compromisso'],
'centro', 80, 'https://jovianarchive.com/pages/the-nine-centers-of-the-bodygraph-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- CENTRO ROOT (RAIZ)
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('centro-root-completo', 'Centro Root (Raiz) - Doutrina de Ra Uru Hu',
'O Centro Root (Raiz) é um centro de pressão e motor. É a pressão adrenal que nos move para a ação e nos mantém em movimento.

## Função do Centro Root

- Pressão para agir/fazer
- Sistema adrenal e estresse
- Impulso de movimento
- Transformação de pressão em ação

## Root Definido

Quando você tem o Root definido:
- Pressão consistente e manejável
- Ritmo próprio de ação
- Menos afetado pela pressa dos outros
- Pode lidar bem com estresse (dentro do seu ritmo)

## Root Aberto

Quando você tem o Root aberto:
- Amplifica a pressão dos outros
- Pode se sentir sempre "atrasado" ou "apressado"
- Corre para terminar coisas para aliviar pressão
- Muito sensível a prazos e urgência

## Tema Não-Self do Root Aberto

"Estou sempre correndo para me livrar da pressão"

**Sinais de Não-Self:**
- Fazer coisas rápido demais só para terminar
- Sentir-se constantemente pressionado
- Não conseguir relaxar
- Criar urgência artificial

**Sabedoria:** A pressão que você sente muitas vezes não é sua. Você pode escolher seu próprio ritmo.',
ARRAY['centro', 'root', 'raiz', 'pressao', 'adrenal', 'estresse', 'acao'],
'centro', 80, 'https://jovianarchive.com/pages/the-nine-centers-of-the-bodygraph-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- NOT-SELF THEMES SUMMARY
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('not-self-summary', 'Temas Não-Self - Resumo da Doutrina de Ra Uru Hu',
'O Não-Self é o conjunto de estratégias mentais condicionadas que nos afastam de quem realmente somos. Ra Uru Hu ensinou que reconhecer o Não-Self é o primeiro passo para viver corretamente.

## Temas Não-Self por Tipo

### Generator: FRUSTRAÇÃO
Quando o Generator inicia da mente em vez de responder, sente frustração crônica - a vida é uma luta constante.

### Manifesting Generator: FRUSTRAÇÃO e RAIVA
Pode sentir frustração (não respondendo) e raiva (não informando) - às vezes alternadamente.

### Manifestor: RAIVA
Quando o Manifestor não informa e encontra resistência constante, sente raiva - o mundo parece sempre no caminho.

### Projector: AMARGURA
Quando o Projector não é reconhecido e não espera convites, sente amargura profunda - ninguém vê seu valor.

### Reflector: DECEPÇÃO
Quando o Reflector decide rápido demais ou está no ambiente errado, sente decepção - a vida não entrega o que prometeu.

## Não-Self nos Centros Abertos

Cada centro aberto tem uma pergunta Não-Self que a mente usa para controlar:

- **Head aberto:** "Estou tentando responder perguntas que não importam"
- **Ajna aberto:** "Estou fingindo certeza"
- **Throat aberto:** "Estou tentando atrair atenção"
- **G aberto:** "Estou buscando amor/direção no lugar errado"
- **Ego aberto:** "Estou tentando provar meu valor"
- **Sacral aberto:** "Não sei quando parar"
- **Emocional aberto:** "Estou evitando confronto para manter paz"
- **Baço aberto:** "Estou segurando o que não é bom para mim"
- **Root aberto:** "Estou correndo para me livrar da pressão"

## O Caminho de Volta

Ra ensinou que o caminho é:
1. **Reconhecer** o Não-Self quando aparece
2. **Não agir** a partir dele
3. **Voltar** para Estratégia e Autoridade
4. **Observar** o que acontece quando você segue seu Design

O experimento é de aproximadamente 7 anos - o tempo do ciclo de células do corpo.',
ARRAY['not-self', 'nao-self', 'tema', 'frustracao', 'raiva', 'amargura', 'decepcao', 'condicionamento', 'core'],
'not-self', 100, 'https://jovianarchive.com/pages/understanding-the-not-self-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

