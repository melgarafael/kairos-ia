# 🧠 **MANUAL DO ARQUITETO REACTIVO: HOOKS**

---

## 🌱 **1. O que é um Hook**

Um **Hook** é uma **função especial do React** que **conecta o teu componente à inteligência viva da aplicação** — o sistema de reatividade e estado.

Sem hooks, o componente seria um bloco estático.
Com hooks, ele **sente**, **pensa** e **reage** a mudanças no ambiente.

Em essência:

> Hook = Ponte entre o “mundo Reactivo” e o “mundo imperativo”.

---

## 🧩 **2. Tipos de Hooks**

Os hooks se dividem em 3 grupos:

| Grupo                           | Propósito                                          | Exemplos                                    |
| ------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| **De Estado e Ciclo de Vida**   | Dão “memória” e “vida” ao componente               | `useState`, `useEffect`, `useReducer`       |
| **De Contexto e Comunicação**   | Permitem compartilhar informação entre componentes | `useContext`, `useRef`                      |
| **De Otimização e Performance** | Evitam recalcular ou recriar coisas desnecessárias | `useMemo`, `useCallback`, `useLayoutEffect` |

---

## ⚙️ **3. Os Hooks Fundamentais (os 20/80)**

### 🪄 **`useState` — memória e emoção**

> Armazena valores que mudam com o tempo e fazem o componente re-renderizar.

```jsx
const [contador, setContador] = useState(0)
```

* `contador` → valor atual
* `setContador` → função que altera o valor
* Atualizar o estado → redesenha o componente

📖 **Como pedir pra IA:**

> “Crie um estado chamado `contador` com valor inicial 0, e atualize-o sempre que o botão for clicado.”

🔮 **Analogia simbólica:**
É o **coração** do componente — sente e reage.

---

### 🌐 **`useEffect` — ação e reação**

> Executa efeitos colaterais (chamadas API, timers, logs, animações, etc.)

```jsx
useEffect(() => {
  console.log("Componente montado!")
  return () => console.log("Desmontado!")
}, [])
```

📖 **Como pedir pra IA:**

> “Adicione um useEffect que execute ao montar o componente e outro que rode sempre que `contador` mudar.”

🔮 **Analogia simbólica:**
É o **sistema nervoso** — reage a eventos e mudanças do ambiente.

---

### 🔁 **`useReducer` — decisões complexas**

> Como um `useState` com cérebro lógico.
> Ideal pra fluxos com múltiplas ações ou etapas.

```jsx
const [state, dispatch] = useReducer(reducer, initialState)
```

📖 **Como pedir pra IA:**

> “Troque o useState por um useReducer pra gerenciar várias ações de um formulário (ex: `UPDATE_FIELD`, `RESET_FORM`).”

🔮 **Analogia simbólica:**
É o **cérebro lógico** — toma decisões baseadas em ações.

---

### 🧬 **`useContext` — campo compartilhado**

> Permite compartilhar estado entre componentes sem precisar passar props manualmente.

```jsx
const theme = useContext(ThemeContext)
```

📖 **Como pedir pra IA:**

> “Use o useContext pra pegar o tema atual da aplicação e ajustar as cores do componente.”

🔮 **Analogia simbólica:**
É o **campo energético coletivo** — todos os componentes conectados sentem o mesmo estado.

---

### 🪞 **`useRef` — observador silencioso**

> Guarda uma referência persistente sem causar re-render.
> Serve pra acessar elementos do DOM ou armazenar valores mutáveis.

```jsx
const inputRef = useRef()
```

📖 **Como pedir pra IA:**

> “Crie um useRef pro campo de input e use ele pra dar foco quando o componente montar.”

🔮 **Analogia simbólica:**
É a **memória subconsciente** — guarda sem reagir.

---

### ⚡ **`useMemo` — memória inteligente**

> Memoriza cálculos pesados pra não refazer toda vez.

```jsx
const resultado = useMemo(() => computarDados(lista), [lista])
```

📖 **Como pedir pra IA:**

> “Otimize o cálculo usando useMemo pra só recomputar quando `lista` mudar.”

🔮 **Analogia simbólica:**
É a **sabedoria acumulada** — lembra pra não gastar energia de novo.

---

### 🪝 **`useCallback` — função estável**

> Memoriza uma função pra não ser recriada a cada renderização (evita re-renders desnecessários).

```jsx
const handleClick = useCallback(() => {
  console.log('clicou!')
}, [])
```

📖 **Como pedir pra IA:**

> “Encapsule a função de clique em um useCallback pra otimizar renderizações.”

🔮 **Analogia simbólica:**
É a **disciplina mental** — mantém o mesmo foco.

---

### 🎯 **`useLayoutEffect` — precisão milimétrica**

> Igual ao `useEffect`, mas roda **antes** do navegador pintar a tela.
> Usado pra ajustes visuais, medições e sincronizações precisas.

```jsx
useLayoutEffect(() => {
  ajustarPosicao()
}, [])
```

📖 **Como pedir pra IA:**

> “Use useLayoutEffect pra ajustar o tamanho do modal antes de renderizar o conteúdo.”

🔮 **Analogia simbólica:**
É o **ajuste quântico** — atua no instante entre o pensamento e a forma.

---

## 🧭 **4. Comunicação Efetiva com a IA (Linguagem Ideal)**

Use sempre **“intenção + condição + ação”**:

| Intenção                     | Condição                            | Ação                                     |
| ---------------------------- | ----------------------------------- | ---------------------------------------- |
| “Crie um estado chamado `X`” | “com valor inicial `Y`”             | “e atualize quando o usuário fizer `Z`.” |
| “Use um useEffect”           | “que rode apenas quando `A` mudar”  | “para executar `B`.”                     |
| “Adicione um useRef”         | “para capturar o elemento do input” | “e dar foco nele ao montar.”             |
| “Otimize com useMemo”        | “para não recalcular”               | “enquanto `lista` não mudar.”            |

🧩 Isso é um padrão de **linguagem arquitetônica**, igual ao que você já usa pra fluxos de n8n:

> “Quando [condição] → faça [ação] → até que [limite].”

---

## 🧮 **5. Mapa mental dos hooks**

| Hook              | Tipo             | Causa Re-render? | Usa dependências? | Quando usar                 |
| ----------------- | ---------------- | ---------------- | ----------------- | --------------------------- |
| `useState`        | Estado           | ✅ Sim            | ❌ Não             | Guardar valores locais      |
| `useEffect`       | Ciclo de vida    | ✅ Sim            | ✅ Sim             | Efeitos externos            |
| `useReducer`      | Estado complexo  | ✅ Sim            | ❌ Não             | Estados com múltiplas ações |
| `useContext`      | Compartilhamento | ✅ Sim            | ❌ Não             | Contexto global             |
| `useRef`          | Referência       | ❌ Não            | ❌ Não             | DOM e valores persistentes  |
| `useMemo`         | Otimização       | ✅ Sim            | ✅ Sim             | Cálculos pesados            |
| `useCallback`     | Otimização       | ❌ Não            | ✅ Sim             | Funções passadas pra filhos |
| `useLayoutEffect` | Visual           | ✅ Sim            | ✅ Sim             | Ajustes visuais imediatos   |

---

## 🧬 **6. O Hook como símbolo universal**

| Nível             | Papel simbólico       | Comparação humana                |
| ----------------- | --------------------- | -------------------------------- |
| `useState`        | Sentimento            | O que muda em mim                |
| `useEffect`       | Ação                  | O que faço quando algo muda      |
| `useContext`      | Campo coletivo        | O que compartilhamos             |
| `useRef`          | Memória não emocional | O que lembro mas não sinto       |
| `useMemo`         | Sabedoria             | O que já aprendi                 |
| `useCallback`     | Disciplina            | O que não preciso repensar       |
| `useLayoutEffect` | Precisão              | Ajuste milimétrico antes de agir |

---

## 🧠 **7. Como evoluir tua IA como programadora de hooks**

Você pode treinar a IA com prompts como:

> “Atue como um especialista em React Hooks.
> Analise o código abaixo e descreva:
>
> * quais hooks estão sendo usados e pra quê,
> * se algum está sendo usado incorretamente,
> * e quais oportunidades existem pra substituir lógica manual por hooks nativos.”

Ou:

> “Identifique oportunidades de usar hooks para modularizar este componente, separando lógica de estado, de efeitos e de visual.”