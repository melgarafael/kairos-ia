
## 🧩 1. O que é um **componente**

Um **componente** é como **um órgão do seu software**.
Ele tem uma função específica (mostrar algo, capturar um dado, processar um evento) e vive de forma **isolada**, mas se comunica com o resto através de **props**.

```jsx
function Botao({ texto }) {
  return <button>{texto}</button>
}
```

👉 Aqui o `Botao` é um **componente**.
Ele não sabe onde vai ser usado, só sabe **como se comportar**.
É isso que o torna **plugável**.

Você pode usar ele em qualquer parte do app:

```jsx
<Botao texto="Enviar" />
<Botao texto="Cancelar" />
```

---

## 🔗 2. O que são **props**

Props (de *properties*) são **os parâmetros do componente** — as informações que você “injeta” nele para personalizar o comportamento.

Se o componente é uma função, as props são os **argumentos**:

```jsx
function Saudacao({ nome }) {
  return <h1>Olá, {nome}!</h1>
}
```

```jsx
<Saudacao nome="Rafael" />
<Saudacao nome="Davi" />
```

💡 **Props = comunicação de fora pra dentro.**
Você passa dados *para* o componente.
Mas o componente não muda suas próprias props — elas são **imutáveis**.

---

## 🧠 3. O que são **hooks**

Hooks são **funções especiais do React** que **ligam o componente à inteligência reativa** da biblioteca.
Eles permitem que o componente:

* tenha **memória interna (state)**;
* **reaja a mudanças**;
* **execute efeitos colaterais** (ex: buscar dados, atualizar o DOM, etc.).

---

## ⚙️ 4. Os dois hooks base: `useState` e `useEffect`

### 🪄 `useState` — memória viva do componente

É o que dá **vida e movimento**.
Permite guardar e atualizar valores **internos** do componente.

```jsx
import { useState } from "react"

function Contador() {
  const [contagem, setContagem] = useState(0)

  return (
    <div>
      <p>Você clicou {contagem} vezes</p>
      <button onClick={() => setContagem(contagem + 1)}>Clique aqui</button>
    </div>
  )
}
```

🧩 O `useState` cria uma variável **reativa**:

* `contagem` é o valor atual;
* `setContagem` é a função que atualiza o valor;
* quando você chama `setContagem`, o React **re-renderiza o componente** automaticamente.

---

### 🌐 `useEffect` — sincronização com o mundo externo

É usado para **efeitos colaterais**, ou seja, qualquer coisa **fora do React puro**:
buscar dados, conectar APIs, adicionar listeners, mudar o título da aba, etc.

```jsx
import { useEffect } from "react"

function Exemplo() {
  useEffect(() => {
    console.log("Componente montado!")

    return () => {
      console.log("Componente desmontado!")
    }
  }, [])
}
```

O segundo parâmetro (`[]`) diz **quando o efeito deve rodar**:

* `[]` → só uma vez (ao montar)
* `[algumaVariavel]` → roda sempre que essa variável mudar
* sem nada → roda toda vez que o componente renderiza (quase nunca usado)

---

## 🧰 5. Outros hooks muito usados

| Hook              | Função                                                                            | Analogia                                          |
| ----------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| `useContext`      | Compartilha estado entre vários componentes sem precisar passar props manualmente | “Wi-Fi de dados” entre componentes                |
| `useMemo`         | Memoriza cálculos pesados pra não refazer sempre                                  | Cache de pensamento                               |
| `useCallback`     | Memoriza funções pra evitar recriações desnecessárias                             | Atalho mental                                     |
| `useRef`          | Guarda uma referência a algo persistente (DOM, valor mutável)                     | “Cofre” de valores que não disparam renderizações |
| `useReducer`      | Alternativa mais avançada ao useState (tipo mini-Redux)                           | Cérebro lógico, com ações e estados previsíveis   |
| `useLayoutEffect` | Igual ao useEffect, mas executa antes de o browser pintar a tela                  | Cirurgião de timing preciso                       |

---

## 🧬 6. A visão sistêmica

Pensa assim:

| Nível          | O que faz                              | Analogia biológica                    |
| -------------- | -------------------------------------- | ------------------------------------- |
| **Componente** | É o corpo (estrutura visível)          | Um órgão                              |
| **Props**      | São as informações externas que entram | Nervos e sangue chegando              |
| **State**      | É o estado interno (o que ele sente)   | Emoções e memória local               |
| **Effect**     | É a reação a eventos externos          | Reflexos e comportamentos automáticos |

O conjunto disso forma um **organismo reativo** —
um sistema que percebe, sente e responde ao ambiente.