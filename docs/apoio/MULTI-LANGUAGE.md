# O que é “multi-idioma bem feito”

* **Projeto, não pós-processo**: i18n é decisão de arquitetura, não “passada de tradução” no fim. (W3C trata i18n como paradigma de design.) ([W3C][1])
* **Tags corretas**: use **BCP 47** para locais (ex.: `pt-BR`, `en-US`) e faça **negociação de idioma** (perfil do usuário > preferência da organização > `Accept-Language` > fallback). ([W3C][2])
* **Mensagens ricas**: plural, gênero/”select”, listas, datas e moedas com **ICU MessageFormat + CLDR** (Português tem regras de plural particulares). ([unicode-org.github.io][3])
* **Formatação nativa**: datas/números/moedas com **ECMAScript Intl** (DateTimeFormat/NumberFormat). ([MDN Web Docs][4])
* **Padrões e tooling**: bibliotecas maduras (i18next/React-i18next + namespaces ou FormatJS/Messageformat); práticas de organização, interpolação e plurais. ([i18next.com][5])

---

# Decisões técnicas (aplicáveis ao seu stack)

## 1) Catálogos e chaves

* **Nada de string hardcoded.** Sempre `t('namespace.key')`.
* **Namespaces por domínio** (ex.: `leads`, `funnel`, `billing`, `automation`, `common`). Isso mantém arquivos leves e localizáveis. ([Mensur Duraković][6])
* **Chaves semânticas**, não frases: `leads.convert`, `billing.invoice_paid`, etc. Evita “efeito dominó” ao ajustar cópia. (i18next recomenda chaves autocontidas; evite montar frases por concatenação.) ([i18next.com][5])
* **Fallback chain**: `pt-BR → pt → en`. Se faltar tradução, aparece inglês (ou pt). (BCP 47 + lookup.) ([W3C][2])

## 2) Mensagens com ICU (plural/gênero/select)

* Exemplo (plural + variável):
  `t('leads.items', { count })` →
  `pt-BR: "{count, plural, =0 {Sem leads} one {# lead} other {# leads}}"`
  `en-US: "{count, plural, =0 {No leads} one {# lead} other {# leads}}"`
* Exemplo (select/gênero + plural):
  `{gender, select, male {Ele} female {Ela} other {@}} contatou {count, plural, one {# cliente} other {# clientes}}`
* Isso é **ICU MessageFormat** (suporta plural/gênero com regras **CLDR**). ([unicode-org.github.io][3])

## 3) Datas, números, moedas e unidades

* Use **Intl**:

  * `Intl.DateTimeFormat(locale, { dateStyle:'medium', timeStyle:'short' })`
  * `Intl.NumberFormat(locale, { style:'currency', currency })`
  * Evite formatar “na mão” (pontos/vírgulas variam por locale). ([MDN Web Docs][4])

## 4) Detecção/seleção de idioma

* **Nível organização** (padrão da conta), **nível usuário** (preferência pessoal).
* **Negociação**: guardar `locale` no perfil; na primeira visita, considerar `Accept-Language`; sempre permitir troca manual. (BCP 47 + RFC 4647 “lookup/filtering”.) ([rfc-editor.org][7])

## 5) Processo e automação (para tudo novo já sair em 2 idiomas)

* **CI gate “no-untranslated”**: pipeline falha se detectar novas chaves sem `pt-BR` e `en-US`.
* **Extração automática**: script que varre o código procurando `t('…')` e atualiza catálogos. (i18next/FormatJS tooling/linters). ([i18next.com][5])
* **Pseudolocalização** em dev: expande strings (`[¡¡ Ĩńťéřƒáçé 200% !!]`) para revelar cortes/overflows e concatenções ruins. (Boa prática de i18n) ([Phrase][8])
* **TMS / fluxo de tradução**: conectar a um gerenciador (Phrase, Lokalise, Locize, Crowdin) para revisão/glossário, versões e captura de strings. (Guias das próprias ferramentas) ([Phrase][8])

## 6) Design e conteúdo

* **Text expansion**: reserve ~30–40% a mais de largura (EN costuma ser mais curto que PT; DE é mais longo). ([Phrase][8])
* **Evite concatenação** (ex.: `"Lead " + nome + " foi…"`) — isso quebra gramática. Use placeholders com ICU. ([i18next.com][5])
* **Ícones + rótulos**: evite ícone sem contexto; rótulo traduzível.
* **Acessibilidade**: `aria-label` e `title` também devem ser traduzidos (e testados em ambos idiomas). (W3C i18n) ([W3C][9])

## 7) Back-end, dados e comunicações

* **Templates** de e-mail/WhatsApp: armazenar **uma versão por locale**; IDs das mensagens (WhatsApp) podem mudar por idioma.
* **Seed/data fixtures**: nomes de estágios, categorias, motivos de perda — mantenha **tabela de labels por locale** (ou resolva no front via keys).
* **Logs/analytics**: guarde **keys** dos eventos, não textos (para não “travar” por idioma).
* **Timezone**: exibir horários no fuso do usuário; **texto relativo** (“há 5 min”) depende do locale.

---

# Padrão de projeto (como organizar no repo)

```
/locales
  /pt-BR
    common.json
    leads.json
    funnel.json
    billing.json
    automation.json
  /en-US
    common.json
    leads.json
    ...
```

* **Lint** (rule): impedir strings literais em componentes (exceto place-holders técnicos).
* **Teste de snapshot**: alternar `locale=pt-BR/en-US` e garantir que telas críticas rendem sem quebra.
* **Storybook**: knob para trocar `locale` e ver expand/RTL (prepare-se para futuro RTL, mesmo que não implemente agora). (W3C i18n) ([W3C][9])

---

# Exemplos rápidos (React + i18next + ICU)

**Config (com ICU + namespaces):**

```ts
import i18n from 'i18next'
import ICU from 'i18next-icu'
import { initReactI18next } from 'react-i18next'
import ptBR from 'i18next-icu/locale-data/pt'
import en from 'i18next-icu/locale-data/en'

i18n
  .use(ICU) // suporta plural/gênero CLDR
  .use(initReactI18next)
  .init({
    lng: 'pt-BR',
    fallbackLng: ['pt', 'en-US'],
    ns: ['common','leads','funnel','billing','automation'],
    defaultNS: 'common',
    returnEmptyString: false
  })
```

([i18next.com][5])

**Uso (plural):**

```tsx
const { t } = useTranslation('leads')
t('items', { count }) 
// pt-BR: "{count, plural, =0 {Sem leads} one {# lead} other {# leads}}"
```

([i18next.com][10])

**Datas/Moedas:**

```ts
new Intl.DateTimeFormat(locale, { dateStyle:'medium', timeStyle:'short' }).format(date)
new Intl.NumberFormat(locale, { style:'currency', currency }).format(value)
```

([MDN Web Docs][11])

---

# Pipeline sugerido (garante 2 idiomas sempre)

1. **Crie/edite feature** → dev usa `t('…')` (sem strings literais).
2. **Extractor** varre o código e atualiza catálogos (`pt-BR`, `en-US`).
3. **CI verifica**: falha se tiver chave nova sem as 2 línguas.
4. **Pseudolocalization** ativa em ambiente de QA. ([Phrase][8])
5. **TMS** notifica tradutores; glossário/estilo mantém consistência. ([Phrase][8])
6. **Screenshots automáticos** (ambos idiomas) para revisão visual (overflow/quebras).
7. **Release** com bundle de línguas versionado.

---

# Checklist rápido (coloque no seu Confluence/README)

* [ ] Sem strings hardcoded na UI.
* [ ] Chaves semânticas, namespaces por domínio. ([Mensur Duraković][6])
* [ ] ICU para plural/gênero/select. ([unicode-org.github.io][3])
* [ ] Intl para data/número/moeda. ([MDN Web Docs][4])
* [ ] BCP 47 e fallback chain. ([W3C][2])
* [ ] Negociação de idioma (org > user > Accept-Language). ([datatracker.ietf.org][12])
* [ ] Pseudolocalização no QA. ([Phrase][8])
* [ ] CI bloqueia chaves sem tradução pt-BR/en-US.
* [ ] TMS integrado (workflow de tradução + glossário). ([Phrase][8])
* [ ] ARIA/labels/alt também traduzidos. ([W3C][9])


[1]: https://www.w3.org/blog/2024/internationalization-i18n-enabling-access-to-a-web-for-all/?utm_source=chatgpt.com "Internationalization (I18N): enabling access to a Web for All"
[2]: https://www.w3.org/TR/ltli/?utm_source=chatgpt.com "Language Tags and Locale Identifiers for the World Wide ..."
[3]: https://unicode-org.github.io/icu/userguide/format_parse/messages/?utm_source=chatgpt.com "Formatting Messages | ICU Documentation"
[4]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl?utm_source=chatgpt.com "Intl - JavaScript | MDN - Mozilla"
[5]: https://www.i18next.com/principles/best-practices?utm_source=chatgpt.com "Best Practices"
[6]: https://www.mensurdurakovic.com/react-i18next-tips-and-tricks/?utm_source=chatgpt.com "React i18next tips and tricks"
[7]: https://www.rfc-editor.org/rfc/bcp/bcp47.txt?utm_source=chatgpt.com "\"Tags for Identifying Languages\", BCP 47"
[8]: https://phrase.com/blog/posts/localizing-react-apps-with-i18next/?utm_source=chatgpt.com "A Guide to React Localization with i18next"
[9]: https://www.w3.org/International/i18n-drafts/nav/about?utm_source=chatgpt.com "About W3C Internationalization (i18n)"
[10]: https://www.i18next.com/translation-function/plurals?utm_source=chatgpt.com "Plurals | i18next documentation"
[11]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat?utm_source=chatgpt.com "Intl.DateTimeFormat - JavaScript - MDN"
[12]: https://datatracker.ietf.org/doc/html/rfc4647?utm_source=chatgpt.com "RFC 4647 - Matching of Language Tags"
