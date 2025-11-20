# Guia de Execução de Testes Playwright via MCP (Chat + Terminal)

Este documento orienta os agentes do Tomik a rodar o teste automatizado do `AIAgentManychatTutorialModal` diretamente da janela de conversa (Cursor) e pelo terminal integrado, mantendo o processo em background e com rastreabilidade.

---

## 1. Visão geral

1. **Quando rodar**: sempre que fizer alterações em `src/components/features/Automation/AIAgentManychatTutorialModal.tsx` ou em hooks/utilidades usadas por esse componente. Isso garante que o tutorial Manychat continue navegando corretamente entre etapas.
2. **O que será testado**: o teste de component testing Playwright que valida se o botão `Começar` leva o usuário do passo introdutório para o passo “Primeiro: conecte seu n8n”.
3. **Como rodar**: usando o servidor MCP do Playwright + comandos `npm run test:ct` (component testing) dentro do chat.

---

## 2. Pré-requisitos (checar apenas uma vez)

| Item | Comando / Ação | Observações |
| --- | --- | --- |
| Dependências | `npm i -D @playwright/test @playwright/experimental-ct-react` | Executado na raiz do repo. |
| Browsers Playwright | `npx playwright install` | Baixa Chromium/WebKit/Firefox. |
| Script MCP | `bash /Users/rafaelmelgaco/Downloads/tomikcrm/scripts/playwright-mcp.sh` | Mantém o servidor Playwright MCP ativo enquanto testa. |
| Config CT | `playwright-ct.config.ts` + `tests/ct/` | Já versionados; não alterar sem alinhamento. |

Se algum passo ainda não existir na máquina do agente, execute-o antes de prosseguir.

---

## 3. Checklist rápido antes de rodar o teste

1. **Salvar alterações** no arquivo que está editando.
2. **Confirmar** que o terminal do chat está posicionado na raiz do repositório:  
   ```bash
   cd /Users/rafaelmelgaco/Downloads/tomikcrm
   ```
3. **Verificar MCP Playwright em execução** (painel MCP do Cursor deve mostrar o servidor “Playwright” conectado). Caso não esteja, execute:
   ```bash
   bash scripts/playwright-mcp.sh
   ```
   Deixe esta aba aberta rodando.
4. **Preparar Trace Viewer opcional**: se precisar revisar UI, mantenha `npm run dev` em outra aba; não é obrigatório para o teste CT.

---

## 4. Rodando o teste dentro da janela da tarefa

### 4.1 Execução normal (foreground)

Quando quiser rodar e esperar pelo resultado diretamente:
```bash
npm run test:ct -- AIAgentManychatTutorialModal.spec.tsx
```

### 4.2 Execução em background (recomendado enquanto continua codando)

1. Inicie o teste com `nohup` para manter logs:
   ```bash
   nohup npm run test:ct -- AIAgentManychatTutorialModal.spec.tsx > /tmp/playwright-manychat.log 2>&1 &
   ```
2. O terminal retorna o PID. Continue trabalhando normalmente.
3. Para acompanhar:
   ```bash
   tail -f /tmp/playwright-manychat.log
   ```
4. Para encerrar (se preciso), encontre o processo:
   ```bash
   ps aux | grep AIAgentManychatTutorialModal.spec
   kill <PID>
   ```

### 4.3 Execução via comando MCP

No painel MCP → Playwright → `run`, use:
```
npm run test:ct -- AIAgentManychatTutorialModal.spec.tsx
```
O Cursor exibirá stdout/stderr no painel lateral e, ao final, um link para o reporter HTML.

---

## 5. Passo a passo contextual (ex.: alterando o tutorial Manychat)

1. **Durante a tarefa** (ex.: ajuste em `AIAgentManychatTutorialModal.tsx`):
   - Edite o componente.
   - Salve o arquivo.
2. **Dentro da mesma janela de chat/tarefa**:
   - Abra o terminal integrado (`⌘J`).
   - Garanta o `cd` correto (ver seção 3).
3. **Rodar teste** usando uma das opções da seção 4.
4. **Interpretar resultados**:
   - Verde ✅: prossiga para testes manuais ou revisão.
   - Falhou ❌:
     - Abra o log `/tmp/playwright-manychat.log` (se background).
     - Caso precise visualizar, rode novamente com `PWDEBUG=1 npm run test:ct -- ...` para abrir o inspector.
5. **Comunicar na tarefa**:
   - Cole o resumo do resultado no comentário/commit (ex.: “✅ `npm run test:ct -- AIAgentManychatTutorialModal.spec.tsx`”).
   - Se falhar, detalhe a causa e próximos passos.

---

## 6. Boas práticas

- Sempre rode o teste **antes** de pedir review ou marcar a tarefa como concluída.
- Prefira a execução em background quando o teste estiver configurado para levar mais tempo ou quando você precisar continuar codando.
- Use `PWDEBUG=1` ou `npx playwright show-trace trace.zip` somente após falha para evitar ruído.
- Mantenha o `scripts/playwright-mcp.sh` atualizado. Caso o MCP seja desconectado, reexecute o script.
- Em caso de dúvidas, registre no comentário da tarefa: descrição do problema + trecho do log (não cole o log inteiro).

---

## 7. Troubleshooting rápido

| Sintoma | Possível causa | Solução |
| --- | --- | --- |
| `command not found: playwright` | Dependências não instaladas | Rodar `npm i`, depois `npx playwright install`. |
| Teste não inicia via MCP | Servidor MCP parado | Reexecutar `bash scripts/playwright-mcp.sh` e reconectar no Cursor. |
| Falha “port already in use” | Execução anterior não finalizada | `ps aux | grep playwright` e finalize o processo conflitando. |
| Componente trava em hooks | Algum mock faltando | Conferir `tests/ct/setup.ts` e adicionar mock para novo hook/serviço. |

---

Com este fluxo os agentes conseguem rodar testes automatizados diretamente no chat/terminal, mantendo histórico na mesma janela da tarefa e garantindo que o tutorial Manychat continue íntegro após qualquer mudança. Bons testes! 🎯

