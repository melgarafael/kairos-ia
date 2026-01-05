-- Human Design Ra Uru Hu Doctrine: Profiles, Definitions, Signatures (Part 4)
-- Source: Jovian Archive
-- Priority 60-80 = Important/Essential content

-- PROFILES OVERVIEW
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-overview', 'Perfis no Human Design - Visão Geral de Ra Uru Hu',
'O Perfil no Human Design descreve o papel que você desempenha na vida - como você aprende, interage e se desenvolve. É formado por duas linhas (1-6).

## As 6 Linhas

### Linhas de Base Pessoal (1, 2, 3)
- **Linha 1 - Investigador:** Precisa de base sólida, pesquisa, fundamentos
- **Linha 2 - Ermitão:** Naturalmente talentoso, precisa de chamado
- **Linha 3 - Mártir:** Aprende por tentativa e erro, experimentador

### Linhas de Base Transpessoal (4, 5, 6)
- **Linha 4 - Oportunista:** Rede de relacionamentos, influência pessoal
- **Linha 5 - Herege:** Projetado para ser prático, resolve problemas dos outros
- **Linha 6 - Modelo:** Três fases de vida, eventualmente se torna exemplo

## Os 12 Perfis

1/3, 1/4, 2/4, 2/5, 3/5, 3/6, 4/1, 4/6, 5/1, 5/2, 6/2, 6/3

O primeiro número é consciente (Personalidade), o segundo é inconsciente (Design).

## Como Usar o Perfil

Ra ensinou que o Perfil:
- É secundário a Tipo/Estratégia/Autoridade
- Descreve o "como" você navega, não o "se"
- Se expressa naturalmente quando você vive corretamente',
ARRAY['perfil', 'profile', 'linhas', 'overview', 'papel'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PERFIL 1/3
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-1-3', 'Perfil 1/3 - Investigador/Mártir',
'O Perfil 1/3 combina a necessidade de base sólida (Linha 1) com o aprendizado por experiência (Linha 3).

## Características
- Precisa entender profundamente antes de agir
- Aprende através de tentativa e erro
- Vida de descobertas através de "erros" valiosos
- Autodidata e experimentador

## Jornada de Vida
- Investiga, testa, descobre o que não funciona
- Cada "fracasso" é informação valiosa
- Constrói base sólida através da experiência
- Resiliente e adaptável

## Dica Prática
Não tenha medo de errar - é assim que você aprende. Mas pesquise antes de experimentar.',
ARRAY['perfil', '1/3', 'investigador', 'martir', 'pesquisa', 'experiencia'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PERFIL 1/4
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-1-4', 'Perfil 1/4 - Investigador/Oportunista',
'O Perfil 1/4 combina a necessidade de base sólida (Linha 1) com a rede de relacionamentos (Linha 4).

## Características
- Precisa de fundamentos sólidos
- Oportunidades vêm através de pessoas conhecidas
- Influencia através de relacionamentos estabelecidos
- Compartilha conhecimento com sua rede

## Jornada de Vida
- Investiga e se torna especialista
- Compartilha conhecimento através de sua rede
- Sucesso vem de quem conhece
- Confiável e fundamentado

## Dica Prática
Construa sua base de conhecimento E sua rede. As oportunidades virão das pessoas que você conhece.',
ARRAY['perfil', '1/4', 'investigador', 'oportunista', 'rede', 'conhecimento'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PERFIL 2/4
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-2-4', 'Perfil 2/4 - Ermitão/Oportunista',
'O Perfil 2/4 combina talentos naturais (Linha 2) com rede de relacionamentos (Linha 4).

## Características
- Talentoso naturalmente em certas áreas
- Precisa de tempo sozinho para desenvolver dons
- Oportunidades vêm através de pessoas
- Pode não ver seus próprios talentos

## Jornada de Vida
- Outros reconhecem seus talentos antes de você
- Precisa ser "chamado" para compartilhar
- Rede social traz oportunidades
- Oscila entre reclusão e socialização

## Dica Prática
Honre sua necessidade de tempo sozinho, mas mantenha suas conexões. Os outros veem em você o que você não vê.',
ARRAY['perfil', '2/4', 'ermitao', 'oportunista', 'talento', 'natural'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PERFIL 2/5
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-2-5', 'Perfil 2/5 - Ermitão/Herege',
'O Perfil 2/5 combina talentos naturais (Linha 2) com projeções práticas (Linha 5).

## Características
- Talentoso naturalmente
- Outros projetam expectativas em você
- Chamado para resolver problemas práticos
- Precisa de tempo sozinho para se recarregar

## Jornada de Vida
- Pessoas esperam soluções de você
- Pode se sentir incompreendido pelas projeções
- Quando chamado, oferece soluções práticas
- Oscila entre exposição e reclusão

## Dica Prática
Gerencie as expectativas dos outros. Você não é o que eles projetam, mas pode ajudar de forma prática.',
ARRAY['perfil', '2/5', 'ermitao', 'herege', 'projecao', 'pratico'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PERFIL 3/5
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-3-5', 'Perfil 3/5 - Mártir/Herege',
'O Perfil 3/5 combina aprendizado por experiência (Linha 3) com projeções práticas (Linha 5).

## Características
- Aprende o que NÃO funciona através da experiência
- Outros projetam expectativas de solução
- Oferece soluções práticas baseadas em experiência
- Vida de descobertas e impacto

## Jornada de Vida
- Experimenta, "fracassa", aprende
- As experiências se tornam sabedoria prática
- Pode ajudar outros a evitar seus erros
- Projeções podem ser desconfortáveis

## Dica Prática
Seus "erros" são seu maior recurso. Use-os para oferecer soluções práticas aos outros.',
ARRAY['perfil', '3/5', 'martir', 'herege', 'experiencia', 'solucao'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PERFIL 3/6
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-3-6', 'Perfil 3/6 - Mártir/Modelo',
'O Perfil 3/6 combina aprendizado por experiência (Linha 3) com a jornada do modelo (Linha 6).

## Características
- Primeira fase (0-30): Experimentação intensa
- Segunda fase (30-50): Observação do "telhado"
- Terceira fase (50+): Torna-se exemplo vivo
- Aprende por tentativa e erro

## Jornada de Vida
- Juventude de muitas experiências e "erros"
- Maturidade de observação e integração
- Sabedoria que vem de ter vivido intensamente
- Eventualmente se torna modelo para outros

## Dica Prática
Honre cada fase. Os erros da juventude são a base da sabedoria futura.',
ARRAY['perfil', '3/6', 'martir', 'modelo', 'fases', 'sabedoria'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PERFIL 4/6
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-4-6', 'Perfil 4/6 - Oportunista/Modelo',
'O Perfil 4/6 combina rede de relacionamentos (Linha 4) com a jornada do modelo (Linha 6).

## Características
- Influência através de rede pessoal
- Três fases de vida (0-30, 30-50, 50+)
- Oportunidades vêm de quem conhece
- Eventualmente se torna exemplo para sua comunidade

## Jornada de Vida
- Constrói rede através das fases
- Observa e integra experiências
- Torna-se modelo dentro de sua comunidade
- Influência cresce com a idade

## Dica Prática
Cultive seus relacionamentos em todas as fases. Você se tornará um exemplo vivo para as pessoas que conhece.',
ARRAY['perfil', '4/6', 'oportunista', 'modelo', 'rede', 'comunidade'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PERFIL 4/1
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-4-1', 'Perfil 4/1 - Oportunista/Investigador',
'O Perfil 4/1 combina rede de relacionamentos (Linha 4) com necessidade de base sólida (Linha 1).

## Características
- Oportunidades através de pessoas conhecidas
- Precisa de fundamento sólido
- Fixo em suas fundações
- Influencia através do conhecimento compartilhado

## Jornada de Vida
- Constrói conhecimento profundo
- Compartilha através de sua rede
- Base sólida + relacionamentos = sucesso
- Pode ser visto como inflexível (é fundamentado)

## Dica Prática
Sua força está na combinação de conhecimento sólido e rede de pessoas. Compartilhe o que sabe com quem conhece.',
ARRAY['perfil', '4/1', 'oportunista', 'investigador', 'fundamento', 'rede'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PERFIL 5/1
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-5-1', 'Perfil 5/1 - Herege/Investigador',
'O Perfil 5/1 combina projeções práticas (Linha 5) com necessidade de base sólida (Linha 1).

## Características
- Outros projetam expectativas de solução
- Precisa de fundamento sólido para entregar
- Resolve problemas de forma prática
- Pode ser elevado ou derrubado pelas projeções

## Jornada de Vida
- Pesquisa profundamente
- É chamado para resolver problemas
- A base sólida sustenta a projeção
- Impacto prático quando bem fundamentado

## Dica Prática
As projeções são intensas. Fundamente-se bem antes de se expor. Quando você sabe do que fala, as projeções funcionam a seu favor.',
ARRAY['perfil', '5/1', 'herege', 'investigador', 'projecao', 'fundamento'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PERFIL 5/2
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-5-2', 'Perfil 5/2 - Herege/Ermitão',
'O Perfil 5/2 combina projeções práticas (Linha 5) com talentos naturais (Linha 2).

## Características
- Projeções de solução sobre você
- Talentos naturais que outros veem
- Precisa de tempo sozinho
- Pode ser chamado para resolver e desaparecer

## Jornada de Vida
- Outros esperam soluções práticas
- Tem dons que não reconhece
- Oscila entre exposição e reclusão
- Impacto através de talentos naturais

## Dica Prática
Gerencie as projeções honrando sua necessidade de reclusão. Você não precisa estar sempre disponível.',
ARRAY['perfil', '5/2', 'herege', 'ermitao', 'projecao', 'talento'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PERFIL 6/2
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-6-2', 'Perfil 6/2 - Modelo/Ermitão',
'O Perfil 6/2 combina a jornada do modelo (Linha 6) com talentos naturais (Linha 2).

## Características
- Três fases de vida (0-30, 30-50, 50+)
- Talentos naturais
- Precisa de tempo sozinho
- Eventualmente se torna exemplo vivo

## Jornada de Vida
- Primeira fase: Experimentação e descoberta de dons
- Segunda fase: Observação e integração
- Terceira fase: Modelo autêntico de seus talentos
- Equilibra reclusão com modelar para outros

## Dica Prática
Honre suas fases e sua necessidade de reclusão. Você não precisa se apressar para ser modelo.',
ARRAY['perfil', '6/2', 'modelo', 'ermitao', 'fases', 'talento'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- PERFIL 6/3
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('perfil-6-3', 'Perfil 6/3 - Modelo/Mártir',
'O Perfil 6/3 combina a jornada do modelo (Linha 6) com aprendizado por experiência (Linha 3).

## Características
- Três fases de vida intensificadas
- Aprende por tentativa e erro
- Muita experimentação, especialmente na primeira fase
- Torna-se modelo de resiliência e sabedoria

## Jornada de Vida
- Primeira fase: Experimentação intensa, muitos "erros"
- Segunda fase: Observação e processamento das experiências
- Terceira fase: Modelo de sabedoria vivida
- As experiências se tornam a base do exemplo

## Dica Prática
Sua vida é um laboratório. Os erros da primeira fase são o combustível da sabedoria futura.',
ARRAY['perfil', '6/3', 'modelo', 'martir', 'experiencia', 'fases'],
'perfil', 60, 'https://jovianarchive.com/pages/understanding-profile-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- DEFINITIONS
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('definicao-overview', 'Definição no Human Design - Doutrina de Ra Uru Hu',
'A Definição descreve como os centros definidos se conectam entre si. Afeta como você processa informação e interage com outros.

## Tipos de Definição

### Definição Única (Single)
- Todos os centros definidos conectados
- Processamento interno fluido
- Não precisa de outros para "completar" circuitos
- Pode parecer autossuficiente

### Definição Dividida (Split)
- Dois grupos de centros não conectados diretamente
- Busca "bridges" (pontes) em outros
- Pode se sentir "incompleto" sozinho
- Atraído por quem conecta as partes

### Definição Tripla (Triple Split)
- Três grupos separados de centros
- Processamento mais complexo
- Precisa de múltiplas "pontes"
- Pode precisar de tempo/pessoas para integrar

### Definição Quádrupla (Quadruple Split)
- Quatro grupos separados (raro)
- Processamento muito complexo
- Aura fixa e poderosa
- Precisa de tempo para integrar

### Sem Definição (None)
- Apenas Reflectors
- Completamente aberto
- Totalmente dependente do ambiente
- Processamento lunar

## Importância da Definição

Ra ensinou que a Definição:
- Afeta relacionamentos (buscamos pontes)
- Influencia processamento de decisões
- É secundária a Tipo/Estratégia/Autoridade',
ARRAY['definicao', 'definition', 'split', 'single', 'triple', 'processamento'],
'definicao', 80, 'https://jovianarchive.com/pages/understanding-definition-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

-- SIGNATURES
INSERT INTO public.hd_library_entries (slug, title, content, tags, category, priority, source_url) VALUES
('assinaturas-overview', 'Assinaturas no Human Design - Doutrina de Ra Uru Hu',
'A Assinatura é o sinal de que você está vivendo corretamente, seguindo sua Estratégia e Autoridade. É a experiência emocional do alinhamento.

## Assinaturas por Tipo

### Generator: SATISFAÇÃO
- Sensação de realização ao final do dia
- Ter usado energia no que importa
- Sentir que a vida responde a você
- Contentamento com o processo

### Manifesting Generator: SATISFAÇÃO e PAZ
- Combinação das duas assinaturas
- Satisfação por responder corretamente
- Paz por informar antes de agir
- Sensação de fluidez na velocidade

### Manifestor: PAZ
- Ausência de resistência
- Caminhos se abrem
- Não precisar lutar para fazer
- Aceitação e cooperação dos outros

### Projector: SUCESSO
- Ser reconhecido pelo seu valor
- Guiar onde é convidado
- Ver seus dons serem utilizados
- Impacto através da orientação

### Reflector: SURPRESA
- Maravilhamento com a vida
- Ser surpreendido positivamente
- Descobertas inesperadas
- A vida revelando novos aspectos

## Como Usar as Assinaturas

Ra ensinou que as assinaturas:
- São RESULTADO de viver corretamente, não objetivo
- Não podem ser forçadas pela mente
- Vêm naturalmente quando seguimos Estratégia e Autoridade
- São o oposto do tema Não-Self

**Se você sente sua assinatura regularmente, está no caminho certo.**
**Se sente o tema Não-Self, algo precisa ajustar na forma de decidir.**',
ARRAY['assinatura', 'signature', 'satisfacao', 'paz', 'sucesso', 'surpresa', 'alinhamento', 'core'],
'assinatura', 100, 'https://jovianarchive.com/pages/type-and-strategy-in-human-design')
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title, content = EXCLUDED.content, tags = EXCLUDED.tags,
  category = EXCLUDED.category, priority = EXCLUDED.priority, source_url = EXCLUDED.source_url;

