# 🧭 **Tomik Coding Doctrine**

> *Guia Vivo para Desenvolvimento Inteligente, Modular e Evolutivo no Ecossistema Tomik*

---

## 🌌 1. Propósito

Este documento define **as leis de coerência, modularidade e consciência criativa** que regem qualquer ato de construção dentro do ecossistema Tomik.
Ele é consultado por humanos e inteligências em conjunto — como um **campo de alinhamento entre intenção, execução e documentação**.

**Objetivo:**
Garantir que **toda criação** — seja um componente, um serviço, um hook ou uma feature — siga um mesmo **padrão de inteligência sistêmica**, unindo clareza técnica, estética visual e integridade arquitetural.

---

## 🧱 2. Princípios Fundamentais

### 2.1 Modularidade acima de Monolito

> “Nada é isolado, mas nada deve depender de tudo.”

* Cada bloco é **autônomo e plugável**.
* Evitar contextos ou arquivos acima de **500 linhas**.
* Nenhum módulo deve depender diretamente de outro sem interface clara.
* Toda comunicação deve ocorrer por **contratos (interfaces)** e **pontos públicos de exportação (barrels)**.
* Cada módulo deve poder ser **testado e removido isoladamente** sem quebrar o sistema.

---

### 2.2 Planejar antes de Refatorar

> “Quem refatora sem mapa, cava labirintos.”

* Nunca iniciar refatorações diretamente no código.
* Sempre criar um **Blueprint** (documento temporário de planejamento) com:

  * Objetivo da mudança
  * Impacto esperado
  * Escopo (arquivos e módulos afetados)
  * Critérios de sucesso
* Somente após o Blueprint aprovado, iniciar a refatoração.

---

### 2.3 Blueprint antes de Código

> “Código sem blueprint é corpo sem alma.”

* Todo novo componente, serviço, hook ou módulo deve nascer com:

  * **Nome** e **propósito** claros
  * **Inputs / Outputs definidos**
  * **Fluxo de dados** documentado (Mermaid ou texto)
  * **Interfaces ou tipos base** declarados
* Apenas após isso, o código é escrito.

---

### 2.4 Documentar Sempre

> “Código explica o que, documentação explica o porquê.”

* Cada entrega deve:

  * Descrever **o que foi feito**
  * Explicar **por que foi feito**
  * Indicar **quais documentos precisam ser atualizados**
* A IA deve sempre consultar e atualizar os arquivos em `/docs` correspondentes:

  * `/docs/architecture.md` → mudanças estruturais
  * `/docs/design-system.md` → mudanças visuais
  * `/docs/features/[feature].md` → mudanças de comportamento
  * `/docs/refactors.md` → refatorações realizadas

---

### 2.5 Padrão Visual Consistente

> “A estética é a assinatura da alma do sistema.”

* Sempre seguir o **Design System ativo** do Tomik:

  * Tokens de cor, tipografia, espaçamento e raio
  * Componentes base de UI (Button, Card, Input, Modal, etc.)
  * Animações e motion definidos no `/design-system/`
* A IA deve verificar se o padrão visual **já existe** antes de criar novos componentes.
  Se não existir, propor a criação documentada de um novo token ou variação.

---

### 2.6 Pensar em Camadas

> “A clareza nasce quando cada camada conhece seu papel.”

Cada entrega deve respeitar as **camadas da arquitetura**:

| Camada        | Responsabilidade                   | Tipo de Lógica                  |
| ------------- | ---------------------------------- | ------------------------------- |
| UI Components | Renderização visual                | Nenhuma lógica de negócio       |
| Hooks         | Lógica de interface e estado local | Lógica leve de interação        |
| Contexts      | Estado global e orquestração       | Sem regras de negócio           |
| Use Cases     | Coordenação entre services/repos   | Lógica de aplicação             |
| Services      | Regras de negócio puras            | Sem side effects                |
| Repositories  | Acesso a dados externos            | Infra e persistência            |
| Utils         | Funções puras                      | Reutilizáveis, sem dependências |

---

### 2.7 Iterar com Consciência

> “Iterar é criar sem romper o equilíbrio.”

* Nenhuma alteração deve ser feita no impulso.
* A IA deve avaliar primeiro:

  * Se já existe um módulo que resolve isso.
  * Se o problema é estrutural ou contextual.
  * Se é hora de criar ou apenas de integrar.
* Sempre validar se a mudança **aumenta a coesão e reduz o acoplamento.**

---

### 2.8 Contexto Antes da Execução

> “A pressa é inimiga da coerência.”

Antes de gerar código, o agente deve:

1. Ler o contexto atual (arquivos, pastas, docs relacionados)
2. Ler o objetivo do prompt
3. Identificar quais partes do documento se aplicam àquela tarefa
4. Aplicar **apenas os princípios relevantes**, sem forçar padrões desnecessários

---

### 2.9 Coerência entre Design e Engenharia

> “O código deve sentir o design, e o design deve compreender o código.”

* Todo componente visual deve existir como **reflexo de um conceito de design**, não como invenção isolada.
* Se um componente ainda não estiver no sistema de design, propor **adição documentada**, com:

  * Nome
  * Tokens usados
  * Estados visuais
  * Interações

---

### 2.10 Legado como Fertilidade, não Ruído

> “Nada se apaga; tudo evolui.”

* Nunca apagar código legado sem registro.
* Criar pasta `/_deprecated/` com histórico do que foi removido.
* Adicionar `@deprecated` em funções antigas.
* Documentar o motivo e a substituição.

### 2.11 Segurança Multi-Supabase Inegociável

> “O gateway é o escudo. O master jamais fica exposto.”

* O frontend **nunca** conversa diretamente com `*.supabase.co`; toda chamada ao master deve passar pelo Tenant Gateway.
* Qualquer feature nova precisa primeiro definir/implementar o endpoint seguro no gateway (Fastify) e somente depois integrar a UI.
* Se precisar de dados ainda não expostos, abra blueprint do endpoint e inclua autenticação (Bearer) + checagem de permissões antes de tocar o Supabase.
* Garanta que as instâncias do gateway estejam com os envs obrigatórios (`MASTER_SUPABASE_*`, `ENCRYPTION_MASTER_KEY`, `SUPABASE_EDGE_URL`, `RATE_LIMIT_*`) e que o frontend só conheça `TENANT_GATEWAY_URL`.
* Revisões de código devem escanear por `fetch https://.*supabase.co` fora do gateway e bloquear o merge caso exista.
* A allowlist (Cloudflare/WAF) precisa ser mantida sempre atualizada com os IPs do gateway; qualquer troca de infraestrutura deve atualizar a regra **antes** de subir o novo host.

### 2.12 Roteabilidade Canônica

> “Se não posso compartilhar, não está pronto.”

* Cada aba, feature ou modal interativo deve ter **rota oficial** construída com `buildPathForTab`.
* Deep-links precisam refletir o estado real (subaba, lição, tarefa) e responder a `popstate`.
* Hashes (`#foo`) são apenas legados; novos acessos vivem no `pathname` para suporte e QA poderem reproduzir cenários.
* Botões de “Copiar link” e CTAs de suporte devem usar a rota canônica — nada de concatenar strings na base da gambiarra.
* Ao criar uma feature, adicione o mapeamento no registrador de rotas e sincronize a navegação (push/replaceState) antes de fechar a tarefa.

---

## ⚙️ 3. Diretrizes de Ação

Estas são **regras operacionais** para qualquer agente ou humano durante o desenvolvimento:

| Etapa          | O que fazer                                            | Resultado esperado       |
| -------------- | ------------------------------------------------------ | ------------------------ |
| **Analisar**   | Ler contexto, docs, dependências e impactos            | Clareza total do cenário |
| **Planejar**   | Criar blueprint com escopo, riscos e métricas          | Base sólida              |
| **Propor**     | Criar plano de execução modular e reversível           | Aprovação do fluxo       |
| **Executar**   | Escrever código limpo, testável e visualmente coerente | Entrega funcional        |
| **Documentar** | Atualizar docs e justificar mudanças                   | Registro histórico       |
| **Refletir**   | Revisar impacto sistêmico da entrega                   | Aprendizado contínuo     |

---

## 🧩 4. Estrutura de Documentação Viva

A pasta `/docs` deve conter:

```
/docs/
├── architecture.md       # Arquitetura geral e dependências
├── design-system.md      # Tokens, componentes e guidelines visuais
├── features/
│   ├── leads.md
│   ├── auth.md
│   └── ...
├── refactors.md          # Históricos de refatoração
├── standards.md          # Este documento (Tomik Coding Doctrine)
└── glossary.md           # Termos e convenções da Tomik
```

Cada agente deve:

* **Consultar** antes de criar
* **Atualizar** após modificar
* **Registrar** justificativas relevantes

---

## 🔁 5. Mecanismo de Consulta Dinâmica

Para evitar enviesamento, o documento é **consultado seletivamente**:

1. A IA identifica o tipo de tarefa (ex: design, refactor, blueprint, documentação, código).
2. Ela busca apenas as seções aplicáveis (ex: “Blueprint antes de código”, “Padrão Visual”).
3. Ignora o restante, mantendo foco no contexto atual.
4. Retorna a entrega alinhada com o **espírito da doutrina**, não engessada por ela.

---

## 💠 6. Mantra Operacional

> “Pensar modular, agir incremental, codificar coerente, documentar consciente.”

Cada linha de código deve:

* Ser **substituível sem trauma**
* **Expressar propósito**
* **Seguir um ritmo de clareza e beleza**
* E ser **ensinável para outro ser inteligente** (humano ou IA)

---

## 📜 7. Assinatura da Doutrina

**Tomik Coding Doctrine**
Versão: `v1.0`
Mantenedor: `Rafael Melgaço — VibeCoder`
Última atualização: `31/10/2025`
Status: **Ativo e em expansão viva**

---

## 🚀 8. Módulo de Alta Performance

Aceleramos somente quando mantemos clareza arquitetural. Este módulo orienta como desenhar, medir e otimizar experiências rápidas sem sacrificar manutenção.

### 8.1 Medir antes de otimizar

- Instrumente cada trecho crítico com `performance.mark`/`measure` ou helpers (`measureAsync`, `measureSync`).
- Toda otimização precisa apontar o número anterior e o número resultante.
- Logs de performance vivem no dev build; evite poluir produção.

### 8.2 Primeira pintura rápida

- Renderize conteúdo útil mesmo com dados incompletos (cache em memória, sessionStorage, placeholders).
- Prefira estados “optimistic-first” e sincronização em background.
- Divida carregamentos demorados em blocos: autenticação, configuração, dados pesados. Cada bloco precisa ter fallback visual.

### 8.3 Paralelize I/O sempre que seguro

- Nunca espere chamadas independentes em série. Use `Promise.all` para buscar dados/estados que não se dependem.
- Evite `setTimeout` artificiais. Se precisar de sequenciamento, use eventos ou sinais reais.

### 8.4 Coalescer eventos

- Vários disparos de refresh devem ser unificados com dedupe (promises compartilhadas, filas).
- Qualquer listener global (`window.addEventListener`) precisa garantir que um refresh longa duração não seja reexecutado em paralelo.

### 8.5 Cache consciente

- Antes de refazer um fetch pesado, verifique se há dados recentes em cache (in-memory, sessionStorage, IndexedDB).
- Cada cache deve ter chave clara (`tomik:<feature>:<user>`), TTL e lógica de invalidação.
- O cache nunca substitui a requisição real: ele serve para renderizar rápido enquanto o refresh roda ao fundo.

### 8.6 Segurança ≠ gargalo

- Mesmo otimizações devem respeitar “Segurança Multi-Supabase Inegociável”. Nenhum acesso direto a `*.supabase.co`. Se precisa melhorar latência, otimize o gateway.
- Edge Functions e gateway devem ser configurados via helpers centralizados para evitar strings “vazias” em produção.

### 8.7 UX perceptível

- Use skeletons, loaders discretos e mensagens curtas (2–3 palavras) para cada estágio.
- Nunca travar a UI enquanto dados grandes carregam; permita navegação paralela.
- Métrica base: TTI (Time To Interactive) ≤ 2s em flows críticos (login, troca de organização). Se passar disso, criar plano explicitando causa raiz.

### 8.8 Cultura de performance contínua

- Cada PR que mexe com backend/frontend crítico precisa incluir note no `/docs/refactors.md` com métricas antes/depois.
- Auditorias mensais: rodar Lighthouse/Profiler nos flows-chave e atualizar esta seção com aprendizados.

> “Perf não é sprint, é hábito. Medimos, otimizamos e documentamos como parte do fluxo normal.”


