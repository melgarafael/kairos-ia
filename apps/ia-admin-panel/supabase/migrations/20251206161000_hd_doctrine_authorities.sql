-- Human Design Ra Uru Hu Doctrine: Authorities (Part 2)
-- Source: Jovian Archive - https://jovianarchive.com/pages/what-is-inner-authority-in-human-design
-- Priority 100 = Core content (80/20 rule)

-- AUTORIDADE EMOCIONAL
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('autoridade-emocional-completa', 'Autoridade Emocional - Doutrina Completa de Ra Uru Hu',
'A Autoridade Emocional (Solar Plexus) é a autoridade mais comum, presente em aproximadamente 50% da população. Se você tem o Centro Emocional definido, esta é sua autoridade, independente do seu Tipo.

## Mecânica da Autoridade Emocional

O Centro Emocional (Solar Plexus) opera através de ondas. Ra Uru Hu ensinou que:

**A Onda Emocional:**
- Sobe (esperança, otimismo, entusiasmo)
- Desce (desespero, pessimismo, desânimo)
- Não é controlável pela mente

## O Princípio Fundamental: "Não Há Verdade no Agora"

Para quem tem Autoridade Emocional, Ra ensinou que **não existe verdade no agora**.

**O que isso significa:**
- No pico da onda, tudo parece maravilhoso
- No vale da onda, tudo parece terrível
- A verdade está no MEIO, com o tempo

## Como Tomar Decisões

1. **Nunca decida no calor do momento** - Nem na euforia, nem no desespero
2. **Espere a onda passar** - Durma sobre a decisão, espere dias se necessário
3. **Observe padrões** - A mesma questão parece diferente em diferentes pontos da onda?
4. **Busque clareza progressiva** - Com o tempo, a resposta se torna mais clara

**O teste:** Se após experimentar diferentes pontos da onda você ainda quer aquilo, provavelmente é correto.

## Clareza vs. Certeza

Ra ensinou que para Autoridade Emocional:
- **Nunca haverá 100% de certeza** - É da natureza da onda
- **Busque clareza suficiente** - Não certeza absoluta
- **70-80% de clareza é o suficiente** - Mais que isso não virá

## A Onda como Guia

**Tipos de ondas:**
1. **Onda tribal (21-45, 37-40, 19-49):** Sobe e desce gradualmente
2. **Onda individual (55-39, 22-12):** Explosiva, com platôs
3. **Onda abstrata (36-35, 41-30):** Expectativa → experiência → decepção/surpresa

## Dicas Práticas

1. **Crie espaço para decisões:** Não se comprometa no momento
2. **Diga "preciso de tempo":** É legítimo e necessário
3. **Observe sua onda:** Aprenda seus padrões próprios
4. **Não confie na euforia:** Nem no desespero
5. **Grandes decisões = mais tempo:** Trabalho, relacionamento, moradia',
ARRAY['autoridade', 'emocional', 'solar-plexus', 'onda', 'tempo', 'clareza', 'core'],
'autoridade', 100, 'https://jovianarchive.com/pages/what-is-inner-authority-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- AUTORIDADE SACRAL
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('autoridade-sacral-completa', 'Autoridade Sacral - Doutrina Completa de Ra Uru Hu',
'A Autoridade Sacral é exclusiva de Generators e Manifesting Generators que NÃO têm o Centro Emocional definido. É uma autoridade do AGORA - rápida, corporal, inconfundível.

## Mecânica da Autoridade Sacral

O Centro Sacral é um motor de energia vital que responde através de sons guturais:
- **"Uh-huh"** = Sim, há energia para isso
- **"Uh-uh"** = Não, não há energia para isso
- **Silêncio** = Ainda não há resposta, não force

## O Som Sacral

Ra Uru Hu ensinou que o som sacral:
- **Vem do ventre**, não da garganta
- **É primitivo e instantâneo** - antes do pensamento
- **Não pode ser fabricado pela mente**
- **É uma resposta ao que é apresentado** - não funciona no vácuo

## Como Funciona na Prática

1. **Algo é apresentado** - Uma pergunta, situação, oportunidade
2. **O corpo responde** - Som gutural ou sensação visceral
3. **Siga a resposta** - Não racionalize para mudar

**Importante:** A mente vai tentar convencer você do contrário. "Mas faz sentido..." "Mas eu deveria..." - Ignore. O sacral sabe.

## Perguntas Sim/Não

Para acessar a autoridade sacral:
- **Use perguntas de sim ou não**
- **Peça para alguém perguntar** - É mais fácil responder aos outros
- **Reformule questões complexas** em múltiplas perguntas simples

**Exemplos:**
- "Você quer fazer isso?" (Não: "O que você quer fazer?")
- "Isso te dá energia?" (Não: "Como você se sente sobre isso?")

## Diferença do Emocional

Com Autoridade Sacral:
- **A decisão é no momento** - Não precisa esperar
- **Clareza é instantânea** - Se respondeu, está respondido
- **Pode mudar** - Se o sacral mudar depois, a decisão muda

## Dicas Práticas

1. **Pratique com perguntas triviais:** "Você quer café?" - Sinta a resposta
2. **Não pense antes de responder:** Deixe o corpo ir primeiro
3. **O sacral não mente:** Se disse não, é não - mesmo que a mente discorde
4. **Espere ser perguntado:** O sacral responde ao que vem, não ao que você busca
5. **Gaste energia sacral antes de dormir:** Generators precisam se esgotar saudavelmente',
ARRAY['autoridade', 'sacral', 'generator', 'resposta', 'corpo', 'agora', 'core'],
'autoridade', 100, 'https://jovianarchive.com/pages/what-is-inner-authority-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- AUTORIDADE ESPLÊNICA
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('autoridade-esplenica-completa', 'Autoridade Esplênica - Doutrina Completa de Ra Uru Hu',
'A Autoridade Esplênica (do Baço) é para quem tem o Centro do Baço definido SEM Centro Emocional ou Sacral definidos. É a autoridade mais antiga, ligada à sobrevivência e intuição instantânea.

## Mecânica da Autoridade Esplênica

O Centro do Baço (Spleen) é o centro da:
- Intuição
- Sobrevivência
- Sistema imunológico
- Bem-estar momento a momento

## O Princípio Fundamental: "Fala Uma Vez"

Ra Uru Hu ensinou que o Baço **fala apenas uma vez**, no momento presente.

**Características:**
- A voz é **sutil** - não grita
- É **instantânea** - acontece no agora
- **Não se repete** - se você perdeu, perdeu
- Opera através de **sensação**, não palavras

## Como Reconhecer a Voz Esplênica

A intuição esplênica pode se manifestar como:
- Um "saber" instantâneo sem explicação
- Arrepios ou sensação física sutil
- Um "não" silencioso que vem antes do pensamento
- Atração ou repulsão instantânea

**O desafio:** Por ser sutil e não se repetir, a mente facilmente a sobrepõe com racionalização.

## Sobrevivência e Bem-estar

O Baço está sempre avaliando:
- "Isso é seguro para mim?"
- "Isso é saudável para mim?"
- "Isso apoia minha sobrevivência?"

É uma autoridade **do corpo**, não da mente.

## Diferença do Sacral

- **Sacral:** Energia para fazer algo (resposta)
- **Esplênica:** Isso é bom para mim? (intuição de sobrevivência)

## Confiando no Instinto

Ra ensinou que para Autoridade Esplênica:
1. **O primeiro instinto é o correto**
2. **Pensar demais é perder a janela**
3. **A mente vai questionar - ignore**
4. **Com prática, fica mais claro**

## Dicas Práticas

1. **Aja no momento:** A intuição não espera
2. **Não justifique:** Você pode não saber explicar por quê
3. **Confie mesmo sem provas:** O Baço sabe antes de você entender
4. **Observe padrões:** Quando você ignorou o Baço, o que aconteceu?
5. **Saúde é indicador:** Se sua saúde sofre, você pode estar ignorando o Baço',
ARRAY['autoridade', 'esplenica', 'baco', 'spleen', 'intuicao', 'instinto', 'sobrevivencia', 'core'],
'autoridade', 100, 'https://jovianarchive.com/pages/what-is-inner-authority-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- AUTORIDADE EGO
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('autoridade-ego-completa', 'Autoridade Ego/Coração - Doutrina Completa de Ra Uru Hu',
'A Autoridade Ego (também chamada de Autoridade do Coração) é para quem tem o Centro do Ego/Coração definido sem Emocional, Sacral ou Baço definidos. É uma autoridade rara e poderosa.

## Mecânica da Autoridade Ego

O Centro do Ego/Coração é o centro de:
- Força de vontade
- Compromissos e promessas
- Valor próprio
- Materialidade e recursos

## O Princípio Fundamental: "Eu Quero"

Ra Uru Hu ensinou que a Autoridade Ego opera através da força de vontade genuína.

**A pergunta central:** "O que EU quero?"
- Não o que você deveria querer
- Não o que os outros querem que você queira
- O que você GENUINAMENTE deseja

## Manifestada vs. Projetada

A Autoridade Ego se expressa de duas formas:

**Ego Manifestado (conexão direta com Garganta):**
- Expressa diretamente: "Eu quero isso"
- Pode ouvir sua própria voz declarando
- Confia no que sai da boca espontaneamente

**Ego Projetado (não conectado diretamente à Garganta):**
- Mais sutil
- Sente a força de vontade internamente
- Precisa de tempo para reconhecer o "querer"

## A Natureza do Ego

O Ego saudável:
- Faz promessas que PODE cumprir
- Reconhece seus limites de vontade
- Trabalha em ciclos (esforço → descanso)
- Sabe seu valor

O Ego não-self:
- Promete demais
- Não descansa
- Busca provar valor constantemente

## Dicas Práticas

1. **Pergunte: "Eu quero isso?"** - Honestamente
2. **Não prometa o que não pode cumprir:** O Ego esgotado é perigoso
3. **Descanse:** O Ego precisa de recuperação entre esforços
4. **Seu valor não precisa ser provado:** Apenas reconhecido
5. **Fale em voz alta:** Ouça o que você DIZ que quer',
ARRAY['autoridade', 'ego', 'coracao', 'vontade', 'querer', 'valor', 'core'],
'autoridade', 100, 'https://jovianarchive.com/pages/what-is-inner-authority-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- AUTORIDADE SELF
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('autoridade-self-completa', 'Autoridade Self/G - Doutrina Completa de Ra Uru Hu',
'A Autoridade Self (ou G Center Authority) é para quem tem o Centro G definido sem Emocional, Sacral, Baço ou Ego definidos. É sobre identidade, direção e o magnetismo do amor.

## Mecânica da Autoridade Self

O Centro G é o centro de:
- Identidade ("Quem eu sou")
- Direção ("Para onde estou indo")
- Amor (não romântico, mas o magnetismo vital)

## O Princípio Fundamental: Direção e Identidade

Ra Uru Hu ensinou que a Autoridade Self opera através de um senso interno de:
- "Isso é o meu caminho"
- "Isso é quem eu sou"
- "Isso me leva na direção certa"

## Como Funciona

A Autoridade Self se expressa através de:

**Expressão espontânea:**
- O que você DIZ sobre si mesmo
- O que sai da sua boca sobre direção
- Declarações de identidade não planejadas

**Sensação de alinhamento:**
- Sentir-se "em casa" com algo
- Sentir que algo "é você"
- Sensação de estar no caminho certo

## Não é Pensamento

**Importante:** A Autoridade Self NÃO é:
- Pensar sobre quem você deveria ser
- Analisar opções logicamente
- Seguir o que faz sentido para outros

É uma **expressão espontânea** do seu ser.

## Dicas Práticas

1. **Fale sobre suas opções:** Ouça o que você diz espontaneamente
2. **"Isso sou eu?":** É a pergunta central
3. **Ambiente importa:** O G é sensível a onde você está
4. **Não force identidade:** Deixe emergir
5. **Atenção ao que te atrai:** O G funciona por magnetismo',
ARRAY['autoridade', 'self', 'g-center', 'identidade', 'direcao', 'amor', 'core'],
'autoridade', 100, 'https://jovianarchive.com/pages/what-is-inner-authority-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- AUTORIDADE MENTAL/AMBIENTAL
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('autoridade-mental-completa', 'Autoridade Mental/Ambiental - Doutrina Completa de Ra Uru Hu',
'A Autoridade Mental (também chamada de Ambiental ou "Sounding Board") é exclusiva de alguns Projectors mentais. Quando não há autoridade interna abaixo da garganta, a clareza vem de fora.

## Mecânica da Autoridade Mental

Quando os únicos centros definidos estão acima da Garganta (Cabeça e/ou Ajna):
- Não há autoridade interna corporal
- A clareza vem do ambiente e do diálogo
- Outras pessoas funcionam como "espelhos sonoros"

## O Princípio Fundamental: Clareza pelo Diálogo

Ra Uru Hu ensinou que para Autoridade Mental:
- **Você não pode descobrir sozinho**
- **Precisa de pessoas corretas para dialogar**
- **A clareza emerge ao falar em voz alta**
- **O ambiente precisa ser correto**

## Como Funciona na Prática

1. **Encontre pessoas de confiança** (não qualquer um)
2. **Fale sobre a questão em voz alta**
3. **NÃO peça conselhos** - Apenas use-os como espelho
4. **Ouça o que VOCÊ diz** - A clareza está na sua própria fala
5. **Observe como se sente no ambiente**

## Pessoas Corretas vs. Qualquer Um

**Pessoas corretas:**
- Você confia nelas
- Elas não tentam decidir por você
- Apenas ouvem e refletem
- O ambiente com elas é confortável

**Não serve:**
- Pessoas que querem controlar
- Pessoas com agenda própria
- Ambientes estressantes

## O Ambiente como Autoridade

O ambiente também fala:
- Você se sente claro em certos lugares?
- Sua mente funciona melhor onde?
- Que ambientes te confundem?

## Dicas Práticas

1. **Cultive "sounding boards":** Pessoas que ouvem sem julgar
2. **Fale, não pense:** A clareza vem da expressão
3. **Não decida sozinho:** É contraproducente
4. **Ambiente importa:** Mude de lugar se necessário
5. **Ouça suas próprias palavras:** A verdade está no que você diz, não no que pensou',
ARRAY['autoridade', 'mental', 'ambiental', 'sounding-board', 'projector', 'dialogo', 'core'],
'autoridade', 100, 'https://jovianarchive.com/pages/what-is-inner-authority-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- AUTORIDADE LUNAR
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('autoridade-lunar-completa', 'Autoridade Lunar - Doutrina Completa de Ra Uru Hu',
'A Autoridade Lunar é exclusiva dos Reflectors. Com todos os centros abertos, não há autoridade interna fixa. O processo decisório é essencialmente lunar.

## Mecânica da Autoridade Lunar

O Reflector não tem centros definidos, então:
- Não há "voz interna" consistente
- Tudo é condicionamento ou trânsito
- A Lua é o único corpo celeste que move rápido o suficiente para ser guia prático

## O Princípio Fundamental: Ciclo de 28 Dias

Ra Uru Hu ensinou que para decisões importantes, o Reflector deve **viver um ciclo lunar completo** com a questão.

**Por que 28 dias?**
- A Lua percorre todo o zodíaco/bodygraph em 28 dias
- Cada dia ativa diferentes portas no Reflector
- Em 28 dias, você experimenta todas as "versões" de si mesmo
- A clareza emerge da totalidade do ciclo

## Como Funciona na Prática

1. **Traga a questão para consciência**
2. **Viva normalmente por 28 dias** com a questão em mente
3. **Observe como se sente em diferentes dias**
4. **Dialogue com pessoas corretas** (como Autoridade Mental)
5. **Após o ciclo, note a clareza que emergiu**

## Não É Paralisia

**28 dias não significa:**
- Não fazer nada por um mês
- Paralisia decisória constante
- Pedir permissão para tudo

**Significa:**
- Para GRANDES decisões, dar-se tempo
- Para pequenas decisões do dia-a-dia, seguir o fluxo
- Reconhecer que você muda literalmente a cada dia

## O Ambiente como Autoridade Secundária

Para o Reflector:
- O ambiente é tudo
- Se o ambiente está errado, nenhuma decisão será boa
- A primeira "decisão" é estar no ambiente correto

## Dicas Práticas

1. **Não se apresse:** Especialmente em grandes decisões
2. **Acompanhe o ciclo lunar:** Comece a notar padrões
3. **Encontre pessoas para dialogar:** Como Autoridade Mental
4. **Priorize o ambiente:** Se o lugar está errado, saia
5. **Seja gentil consigo:** Você é literalmente diferente a cada dia',
ARRAY['autoridade', 'lunar', 'reflector', 'ciclo', '28-dias', 'lua', 'core'],
'autoridade', 100, 'https://jovianarchive.com/pages/what-is-inner-authority-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

