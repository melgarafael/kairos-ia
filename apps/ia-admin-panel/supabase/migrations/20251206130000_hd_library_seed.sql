-- Human Design Library Seed Content
-- Basic entries for the Kairos IA to use when explaining HD concepts

-- Tipos
INSERT INTO public.hd_library_entries (slug, title, content, tags) VALUES
('tipo-generator', 'Generator (Gerador)', 
'O Generator é o tipo mais comum (cerca de 70% da população). Sua essência é a energia vital sustentada, representada pelo Centro Sacral definido.

**Estratégia:** Responder
Os Generators não são feitos para iniciar ações. Sua estratégia é esperar que a vida traga coisas para reagir. Quando algo aparece - uma oportunidade, uma pergunta, um convite - o corpo dá uma resposta sacral (um som gutural como "uh-huh" ou "uh-uh").

**Assinatura:** Satisfação
Quando vivendo corretamente, o Generator sente profunda satisfação no que faz. Cada dia termina com sensação de realização.

**Tema Não-Self:** Frustração
Quando não honra sua estratégia, iniciando em vez de responder, o Generator sente frustração crônica.

**Dica prática:** Preste atenção no que te dá energia vs. o que te drena. Seu corpo sabe antes da mente.', 
ARRAY['tipo', 'generator', 'sacral', 'responder']),

('tipo-manifestor', 'Manifestor', 
'O Manifestor é o único tipo que pode verdadeiramente iniciar ação. Representa cerca de 9% da população.

**Estratégia:** Informar
Manifestors têm um campo de energia fechado e repelente, o que pode criar resistência quando agem sem aviso. A estratégia de informar não é pedir permissão - é simplesmente comunicar o que vai fazer antes de fazer.

**Assinatura:** Paz
Quando vivendo corretamente e informando, o Manifestor encontra paz. A resistência diminui.

**Tema Não-Self:** Raiva
Quando não informa e encontra resistência, o Manifestor sente raiva - como se o mundo estivesse sempre no caminho.

**Dica prática:** Antes de agir em algo que impacta outros, apenas avise. Não precisa pedir permissão, apenas informar.', 
ARRAY['tipo', 'manifestor', 'informar', 'iniciar']),

('tipo-manifesting-generator', 'Manifesting Generator (MG)', 
'O Manifesting Generator combina energia do Generator com capacidade de manifestar. Representa cerca de 32% da população.

**Estratégia:** Responder, depois Informar
MGs têm a energia sacral do Generator, mas também a capacidade de manifestar. Devem esperar responder (como Generators) e então informar (como Manifestors) antes de agir.

**Assinatura:** Satisfação e Paz
Combinam a satisfação do Generator com a paz do Manifestor.

**Tema Não-Self:** Frustração e Raiva
Podem sentir tanto frustração (por não responder) quanto raiva (por não informar).

**Dica prática:** MGs são naturalmente rápidos e multi-tarefas. Permita-se pular etapas e voltar atrás - faz parte do seu processo. Apenas lembre de responder antes de iniciar.', 
ARRAY['tipo', 'manifesting-generator', 'mg', 'sacral', 'responder', 'informar']),

('tipo-projector', 'Projector (Projetor)', 
'O Projector é o guia da humanidade. Sem energia sacral definida, não é feito para trabalho sustentado. Representa cerca de 20% da população.

**Estratégia:** Esperar pelo convite
Projectors têm uma aura focada e penetrante que vê profundamente os outros. Mas essa energia só é bem recebida quando há um convite formal para as grandes decisões (carreira, relacionamentos, onde morar).

**Assinatura:** Sucesso
Quando reconhecido e convidado, o Projector experimenta sucesso genuíno.

**Tema Não-Self:** Amargura
Sem reconhecimento e convites, o Projector sente amargura profunda.

**Dica prática:** Seu valor está na sua visão, não na sua capacidade de trabalho. Estude sistemas, pessoas, processos. Quando convidado, você guiará.', 
ARRAY['tipo', 'projector', 'projetor', 'convite', 'reconhecimento']),

('tipo-reflector', 'Reflector', 
'O Reflector é o tipo mais raro, cerca de 1% da população. Não tem centros definidos - é completamente aberto, um espelho da comunidade.

**Estratégia:** Esperar um ciclo lunar (28 dias)
Para decisões importantes, o Reflector precisa de um ciclo lunar completo para processar. Cada dia traz uma perspectiva diferente.

**Assinatura:** Surpresa
Quando vivendo corretamente, o Reflector é surpreendido pela vida de formas mágicas.

**Tema Não-Self:** Decepção
Quando toma decisões rápidas ou está no ambiente errado, sente decepção.

**Dica prática:** O ambiente é TUDO para você. Encontre lugares e pessoas que reflitam quem você quer ser. Sua saúde depende disso.', 
ARRAY['tipo', 'reflector', 'lunar', 'espelho', 'ambiente'])
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags;

-- Centros
INSERT INTO public.hd_library_entries (slug, title, content, tags) VALUES
('centro-sacral', 'Centro Sacral', 
'O Centro Sacral é o centro da energia vital, sexualidade, criatividade e força de trabalho. Quando definido (colorido), você tem acesso consistente a energia sustentada.

**Definido:** Você é Generator ou MG. Tem energia para trabalhar de forma sustentada. O som sacral ("uh-huh"/"uh-uh") é sua bússola interna.

**Aberto:** Você é Manifestor, Projector ou Reflector. Não tem energia própria sustentada - amplifica a energia dos outros. Precisa de descanso antes de estar cansado.

**Dica:** Se você tem o Sacral definido, honre o que lhe dá energia. Se aberto, não tente acompanhar o ritmo dos Sacrais definidos.', 
ARRAY['centro', 'sacral', 'energia', 'generator']),

('centro-emocional', 'Centro do Plexo Solar (Emocional)', 
'O Centro Emocional é o centro das emoções, sentimentos, sensibilidade e paixão. Quem tem definido tem uma onda emocional própria.

**Definido:** Sua autoridade emocional significa que você precisa de tempo para decisões. Nunca decida no pico ou no vale da onda - espere a clareza vir.

**Aberto:** Você amplifica as emoções dos outros. Pode ser difícil saber o que é seu vs. dos outros. "Estou sentindo isso ou captando de alguém?"

**Dica:** Com centro emocional definido, durma sobre decisões importantes. Com aberto, aprenda a reconhecer emoções que não são suas.', 
ARRAY['centro', 'emocional', 'plexo-solar', 'autoridade', 'onda']),

('centro-g', 'Centro G (Identidade/Direção)', 
'O Centro G é o centro da identidade, direção na vida e amor. Localizado no centro do peito, governa quem você é e para onde está indo.

**Definido:** Você tem senso fixo de identidade e direção. Sabe quem é independente do ambiente.

**Aberto:** Sua identidade é fluida e dependente do ambiente. Isso não é fraqueza - é sabedoria. Você pode ser muitas coisas dependendo de onde está.

**Dica:** Com G aberto, escolha bem seus ambientes e companhias. Eles moldam quem você se torna.', 
ARRAY['centro', 'g', 'identidade', 'direcao', 'amor'])
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags;

-- Autoridades
INSERT INTO public.hd_library_entries (slug, title, content, tags) VALUES
('autoridade-emocional', 'Autoridade Emocional (Solar Plexus)', 
'Se você tem o Centro Emocional definido, sua autoridade é Emocional - a mais comum.

**Como funciona:** Você tem uma onda emocional que sobe e desce. No pico, tudo parece maravilhoso. No vale, tudo parece terrível. A verdade está no meio.

**Decisões:** NUNCA decida no calor do momento. Espere a onda passar, durma sobre a decisão, e veja se ainda faz sentido quando estiver neutro.

**Frase-chave:** "Não há verdade no agora" - para você, a clareza vem com o tempo.', 
ARRAY['autoridade', 'emocional', 'solar-plexus', 'onda', 'tempo']),

('autoridade-sacral', 'Autoridade Sacral', 
'Se você é Generator ou MG sem Centro Emocional definido, sua autoridade é Sacral.

**Como funciona:** Seu corpo responde com sons guturais. "Uh-huh" (sim), "uh-uh" (não). Esses sons vêm do ventre, não da mente.

**Decisões:** Alguém precisa fazer perguntas sim/não para você. Sua mente não sabe - seu corpo sabe.

**Dica:** Pratique responder com sons em vez de palavras. "Você quer fazer isso?" - deixe o corpo responder antes da mente racionalizar.', 
ARRAY['autoridade', 'sacral', 'generator', 'resposta', 'corpo']),

('autoridade-esplenica', 'Autoridade Esplênica', 
'Se você tem o Centro do Baço definido sem Sacral ou Emocional definidos, sua autoridade é Esplênica.

**Como funciona:** O Baço fala UMA VEZ, no momento presente. É uma intuição instantânea - um saber imediato.

**Decisões:** Confie no primeiro instinto. Se você começar a pensar, perde. A voz esplênica é sutil e não se repete.

**Dica:** A autoridade esplênica é sobre sobrevivência e bem-estar. Ela sempre sabe o que é seguro ou não para você.', 
ARRAY['autoridade', 'esplenica', 'baco', 'intuicao', 'instinto'])
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags;

-- Estratégias
INSERT INTO public.hd_library_entries (slug, title, content, tags) VALUES
('estrategia-responder', 'Estratégia: Responder (Generators)', 
'A estratégia de Responder é para Generators e Manifesting Generators.

**O que significa:** Você não é feito para iniciar. Espere que a vida traga coisas para você reagir. Pode ser uma oportunidade, uma pergunta, um convite, algo que você vê ou ouve.

**Como praticar:**
1. Observe o que aparece na sua vida
2. Note sua resposta sacral (energia/sem energia)
3. Siga a resposta, não a mente

**O que NÃO é:** Não significa ser passivo. Você pode estar ativo no mundo - apenas respondendo ao que aparece em vez de forçando coisas do nada.

**Exemplo:** Em vez de pensar "preciso de um novo emprego e vou buscar", espere uma oportunidade aparecer (conversa, anúncio, indicação) e veja se seu corpo responde.', 
ARRAY['estrategia', 'responder', 'generator', 'mg', 'sacral']),

('estrategia-informar', 'Estratégia: Informar (Manifestors)', 
'A estratégia de Informar é exclusiva dos Manifestors.

**O que significa:** Antes de agir em algo que impacta outros, comunique sua intenção. Não é pedir permissão - é informar.

**Como praticar:**
1. Identifique quem será impactado pela sua ação
2. Avise: "Vou fazer X" ou "Estou pensando em Y"
3. Então aja

**Por que funciona:** Manifestors têm uma aura fechada que pode parecer ameaçadora. Informar abre a energia e reduz resistência.

**Exemplo:** Em vez de simplesmente mudar um processo no trabalho, primeiro diga à equipe: "Vou implementar uma nova forma de fazer X."', 
ARRAY['estrategia', 'informar', 'manifestor', 'comunicar']),

('estrategia-convite', 'Estratégia: Esperar pelo Convite (Projectors)', 
'A estratégia de Esperar pelo Convite é para Projectors.

**O que significa:** Para as grandes áreas da vida (carreira, relacionamentos, onde morar), espere ser formalmente reconhecido e convidado.

**O que é um convite:** Um reconhecimento genuíno do seu valor. Não é só alguém pedindo algo - é alguém vendo VOCÊ.

**Para coisas pequenas:** Você não precisa de convite para cada coisa. A estratégia é principalmente para decisões importantes que mudam sua vida.

**Dica:** Enquanto espera convites, desenvolva suas habilidades. Estude o que te interessa. Quando o convite vier, você estará pronto.', 
ARRAY['estrategia', 'convite', 'projector', 'reconhecimento', 'esperar'])
ON CONFLICT (slug) DO UPDATE SET 
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags;

