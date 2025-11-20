# Prompt Completo: CRM para Clínicas Médicas

Você vai criar um **CRM completo para clínicas médicas** usando React + TypeScript + Tailwind CSS + Supabase, com foco em usabilidade, performance e escalabilidade. O sistema deve ser profissional, responsivo e pronto para produção.

## 🎯 **1. IDENTIFICAÇÃO E OBJETIVO**

### **Título:** CRM de Clínicas Médicas
### **Descrição:** Sistema completo de gestão clínica para centralizar pacientes, agendamentos, consultas, prontuários, faturamento e relatórios.
### **Objetivo:** 
- Centralizar todos os processos clínicos em uma plataforma única
- Aumentar eficiência operacional e reduzir erros manuais
- Garantir segurança e conformidade com LGPD
- Melhorar experiência do paciente e profissionais
- Fornecer insights através de relatórios e dashboards

---

## 🏗️ **2. FUNCIONALIDADES CORE (ESSENCIAIS)**

### **2.1 Gestão de Pacientes**
- ✅ Cadastro completo (dados pessoais, contato, documentos, endereço)
- ✅ Busca avançada e filtros (nome, telefone, email, data nascimento)
- ✅ Histórico completo de consultas e interações
- ✅ Status do paciente (ativo, inativo, inadimplente)
- ✅ Campos customizáveis por especialidade
- ✅ Upload de documentos e fotos
- ✅ Timeline de atividades

### **2.2 Agendamento Inteligente**
- ✅ Calendário visual (dia, semana, mês)
- ✅ **Drag & Drop** para reagendamento rápido
- ✅ Disponibilidade de profissionais e salas
- ✅ Tipos de consulta (primeira consulta, retorno, exame)
- ✅ Status (agendado, confirmado, realizado, cancelado, falta)
- ✅ Verificação automática de conflitos
- ✅ Tempo de duração configurável
- ✅ Lista de espera automática
- ✅ Reagendamento em lote

### **2.3 Prontuário Eletrônico**
- ✅ Histórico de atendimentos por paciente
- ✅ Campos estruturados (anamnese, exame físico, diagnóstico)
- ✅ Prescrições e receitas digitais
- ✅ Upload de laudos, exames e imagens
- ✅ Assinatura digital
- ✅ Modelos de prontuário por especialidade
- ✅ Busca por CID-10
- ✅ Evolução do quadro clínico

### **2.4 Gestão de Profissionais**
- ✅ Cadastro com especialidades e CRM
- ✅ Agenda individual configurável
- ✅ Horários de atendimento flexíveis
- ✅ Produtividade e estatísticas
- ✅ Comissões e repasses
- ✅ Bloqueios e férias
- ✅ Múltiplas especialidades

### **2.5 Faturamento & Cobrança**
- ✅ Controle de pagamentos (dinheiro, cartão, PIX, convênio)
- ✅ Geração automática de recibos
- ✅ Status financeiro do paciente
- ✅ Relatórios de faturamento
- ✅ Controle de inadimplência
- ✅ Integração com meios de pagamento
- ✅ Parcelamento e descontos

### **2.6 Notificações Automáticas**
- ✅ Lembretes de consulta (email, SMS, WhatsApp)
- ✅ Confirmação de agendamento
- ✅ Alertas de aniversário
- ✅ Notificações internas (equipe)
- ✅ Campanhas de marketing
- ✅ Follow-up pós-consulta

### **2.7 Relatórios & Dashboards**
- ✅ Dashboard executivo com KPIs
- ✅ Atendimentos por período
- ✅ Receita e faturamento
- ✅ Taxa de absenteísmo
- ✅ Produtividade por profissional
- ✅ Relatórios customizáveis
- ✅ Exportação (PDF, Excel)
- ✅ Gráficos interativos

### **2.8 Sistema de Permissões**
- ✅ Níveis de acesso (Admin, Médico, Recepção, Financeiro)
- ✅ Permissões granulares por funcionalidade
- ✅ Auditoria de ações
- ✅ Sessões seguras
- ✅ Autenticação multifator (opcional)

---

## 🗄️ **3. BANCO DE DADOS (SUPABASE)**

### **3.1 Tabelas Principais**
```sql
-- Usuários do sistema
users (id, nome, email, role, ativo, created_at)

-- Clínicas (multi-tenant)
clinics (id, nome, endereco, telefone, cnpj, created_at)

-- Pacientes
patients (id, clinic_id, nome, email, telefone, nascimento, 
         documentos, endereco, status, created_at)

-- Profissionais
professionals (id, clinic_id, user_id, especialidade, crm, 
              horarios, comissao, created_at)

-- Agendamentos
appointments (id, clinic_id, patient_id, professional_id, 
             data_hora_inicio, data_hora_fim, tipo, status, 
             observacoes, created_at)

-- Consultas realizadas
consultations (id, appointment_id, patient_id, professional_id,
              anamnese, exame_fisico, diagnostico, prescricao,
              arquivos, created_at)

-- Pagamentos
payments (id, clinic_id, patient_id, consultation_id, valor,
         forma_pagamento, status, data_vencimento, created_at)

-- Notificações
notifications (id, user_id, tipo, mensagem, lida, created_at)
```

### **3.2 Relacionamentos**
- ✅ `patients` → `appointments` (1:N)
- ✅ `professionals` → `appointments` (1:N)
- ✅ `appointments` → `consultations` (1:1)
- ✅ `consultations` → `payments` (1:N)
- ✅ `users` → `notifications` (1:N)

### **3.3 Políticas RLS (Row Level Security)**
- ✅ Isolamento por clínica (multi-tenant)
- ✅ Permissões baseadas em roles
- ✅ Auditoria de acesso
- ✅ Proteção de dados sensíveis

---

## 🎨 **4. DESIGN E UX/UI**

### **4.1 Design System**
- ✅ **Cores:** Paleta médica (azul, verde, branco) + status colors
- ✅ **Tipografia:** Inter ou similar, hierarquia clara
- ✅ **Componentes:** Design system consistente
- ✅ **Ícones:** Lucide React (médicos e gerais)
- ✅ **Espaçamento:** Grid 8px, layouts harmoniosos

### **4.2 Layout Responsivo**
- ✅ **Mobile-first:** Otimizado para tablets e smartphones
- ✅ **Breakpoints:** sm, md, lg, xl
- ✅ **Navigation:** Sidebar desktop + bottom nav mobile
- ✅ **Modais:** Responsivos e acessíveis

### **4.3 Componentes Essenciais**
- ✅ **Calendário:** Visualização de agendamentos
- ✅ **Drag & Drop:** Reagendamento visual
- ✅ **Tabelas:** Paginação, filtros, ordenação
- ✅ **Formulários:** Validação em tempo real
- ✅ **Cards:** Informações resumidas
- ✅ **Dashboards:** Gráficos e métricas
- ✅ **Modais:** Criação/edição de registros

### **4.4 Estados da Interface**
- ✅ **Loading:** Skeleton loaders elegantes
- ✅ **Empty states:** Ilustrações e CTAs
- ✅ **Error states:** Mensagens claras e ações
- ✅ **Success:** Feedback positivo
- ✅ **Confirmações:** Ações destrutivas

---

## ⚙️ **5. ARQUITETURA TÉCNICA**

### **5.1 Stack Tecnológica**
- ✅ **Frontend:** React 18 + TypeScript + Vite
- ✅ **Styling:** Tailwind CSS + HeadlessUI
- ✅ **Backend:** Supabase (PostgreSQL + Auth + Storage)
- ✅ **State:** Context API + Custom Hooks
- ✅ **Forms:** React Hook Form + Zod validation
- ✅ **Drag & Drop:** @hello-pangea/dnd
- ✅ **Charts:** Recharts
- ✅ **Notifications:** React Hot Toast
- ✅ **Date:** date-fns

### **5.2 Estrutura de Pastas**
```
src/
├── components/
│   ├── ui/           # Componentes base
│   ├── layout/       # Header, Sidebar, etc
│   └── features/     # Módulos específicos
├── hooks/            # Custom hooks
├── context/          # Context providers
├── lib/              # Utilities e configs
├── types/            # TypeScript types
└── pages/            # Páginas principais
```

### **5.3 Custom Hooks**
- ✅ `usePatients()` - CRUD de pacientes
- ✅ `useAppointments()` - Gestão de agendamentos
- ✅ `useProfessionals()` - Gestão de profissionais
- ✅ `useConsultations()` - Prontuários
- ✅ `usePayments()` - Faturamento
- ✅ `useNotifications()` - Sistema de notificações
- ✅ `useAuth()` - Autenticação e permissões

---

## 🔧 **6. FUNCIONALIDADES AVANÇADAS**

### **6.1 Agenda Visual (Drag & Drop)**
- ✅ **Board Kanban:** Colunas por profissional
- ✅ **Drag between columns:** Trocar profissional
- ✅ **Drag within column:** Reordenar horários
- ✅ **Visual feedback:** Highlight, ghost, animations
- ✅ **Conflict detection:** Prevenir sobreposições
- ✅ **Real-time sync:** Supabase ↔ Frontend

### **6.2 Busca Inteligente**
- ✅ **Global search:** Busca em todas as entidades
- ✅ **Filtros avançados:** Múltiplos critérios
- ✅ **Autocomplete:** Sugestões em tempo real
- ✅ **Search history:** Buscas recentes
- ✅ **Saved filters:** Filtros salvos

### **6.3 Automações**
- ✅ **Lembretes automáticos:** Email/SMS
- ✅ **Follow-up:** Pós-consulta
- ✅ **Campanhas:** Marketing segmentado
- ✅ **Workflows:** Processos automatizados
- ✅ **Triggers:** Ações baseadas em eventos

### **6.4 Integrações**
- ✅ **WhatsApp Business API:** Mensagens
- ✅ **Email providers:** SendGrid, Mailgun
- ✅ **Payment gateways:** Stripe, PagSeguro
- ✅ **SMS providers:** Twilio, Zenvia
- ✅ **Calendar sync:** Google Calendar

---

## 📊 **7. MÓDULOS ESPECÍFICOS**

### **7.1 Dashboard Executivo**
```typescript
// KPIs principais
- Total de pacientes ativos
- Consultas do dia/semana/mês
- Receita atual vs meta
- Taxa de ocupação da agenda
- Novos pacientes no período
- Taxa de absenteísmo
- Produtividade por profissional
- Satisfação do paciente (NPS)
```

### **7.2 Módulo Financeiro**
- ✅ **Contas a receber:** Controle de inadimplência
- ✅ **Fluxo de caixa:** Entradas e saídas
- ✅ **Comissões:** Cálculo automático
- ✅ **Relatórios fiscais:** DRE, balancete
- ✅ **Conciliação:** Cartões e convênios

### **7.3 Módulo de Relatórios**
- ✅ **Relatórios pré-definidos:** Templates prontos
- ✅ **Report builder:** Criação customizada
- ✅ **Agendamento:** Envio automático
- ✅ **Exportação:** PDF, Excel, CSV
- ✅ **Dashboards personalizados:** Por usuário

---

## 🔒 **8. SEGURANÇA E CONFORMIDADE**

### **8.1 Segurança de Dados**
- ✅ **Criptografia:** Dados sensíveis
- ✅ **Backup automático:** Supabase
- ✅ **Auditoria:** Log de todas as ações
- ✅ **Sessões seguras:** JWT + refresh tokens
- ✅ **Rate limiting:** Proteção contra ataques

### **8.2 LGPD Compliance**
- ✅ **Consentimento:** Termos de uso
- ✅ **Portabilidade:** Exportação de dados
- ✅ **Exclusão:** Direito ao esquecimento
- ✅ **Anonimização:** Dados históricos
- ✅ **Relatórios:** Compliance dashboard

### **8.3 Backup e Recuperação**
- ✅ **Backup diário:** Automático
- ✅ **Point-in-time recovery:** Supabase
- ✅ **Disaster recovery:** Plano de contingência
- ✅ **Testes regulares:** Validação de backups

---

## 📱 **9. RESPONSIVIDADE E PERFORMANCE**

### **9.1 Mobile-First Design**
- ✅ **Touch-friendly:** Botões e áreas de toque adequadas
- ✅ **Swipe gestures:** Navegação intuitiva
- ✅ **Offline support:** Cache local (opcional)
- ✅ **PWA ready:** Instalação como app

### **9.2 Performance**
- ✅ **Lazy loading:** Componentes e rotas
- ✅ **Virtual scrolling:** Listas grandes
- ✅ **Image optimization:** Compressão automática
- ✅ **Bundle splitting:** Code splitting
- ✅ **Caching:** React Query ou SWR

### **9.3 Acessibilidade**
- ✅ **WCAG 2.1:** Conformidade AA
- ✅ **Keyboard navigation:** Navegação completa
- ✅ **Screen readers:** ARIA labels
- ✅ **Color contrast:** Ratios adequados
- ✅ **Focus management:** Estados visuais

---

## 🚀 **10. IMPLEMENTAÇÃO E DEPLOYMENT**

### **10.1 Estrutura de Desenvolvimento**
- ✅ **Environment setup:** .env files
- ✅ **TypeScript strict:** Tipagem rigorosa
- ✅ **ESLint + Prettier:** Code quality
- ✅ **Husky:** Pre-commit hooks
- ✅ **Testing:** Jest + Testing Library (opcional)

### **10.2 Deployment**
- ✅ **Vercel/Netlify:** Frontend hosting
- ✅ **Supabase:** Backend as a Service
- ✅ **CDN:** Assets optimization
- ✅ **SSL:** Certificados automáticos
- ✅ **Monitoring:** Error tracking

### **10.3 Migrations e Seeds**
```sql
-- Migrations estruturadas
-- Seeds com dados de exemplo
-- Políticas RLS configuradas
-- Indexes para performance
-- Triggers para automações
```

---

## 📋 **11. CHECKLIST DE QUALIDADE**

### **11.1 Funcionalidades Core**
- [ ] Cadastro e gestão de pacientes completa
- [ ] Sistema de agendamentos com drag & drop
- [ ] Prontuário eletrônico funcional
- [ ] Gestão de profissionais e especialidades
- [ ] Módulo financeiro básico
- [ ] Sistema de notificações
- [ ] Relatórios e dashboard
- [ ] Controle de permissões

### **11.2 UX/UI**
- [ ] Design responsivo (mobile, tablet, desktop)
- [ ] Loading states e skeleton loaders
- [ ] Error handling e mensagens claras
- [ ] Navegação intuitiva
- [ ] Feedback visual adequado
- [ ] Acessibilidade básica

### **11.3 Técnico**
- [ ] Integração Supabase funcionando
- [ ] Autenticação e autorização
- [ ] Validação de formulários
- [ ] Performance otimizada
- [ ] Código TypeScript tipado
- [ ] Estrutura modular e escalável

### **11.4 Segurança**
- [ ] RLS policies configuradas
- [ ] Dados sensíveis protegidos
- [ ] Auditoria de ações
- [ ] Backup automático
- [ ] Conformidade LGPD básica

---

## 📚 **12. DOCUMENTAÇÃO E MANUTENÇÃO**

### **12.1 Documentação Técnica**
- ✅ **README:** Setup e instalação
- ✅ **API docs:** Endpoints e schemas
- ✅ **Component docs:** Storybook (opcional)
- ✅ **Database schema:** ERD e relacionamentos
- ✅ **Deployment guide:** Processo de deploy

### **12.2 Guias de Uso**
- ✅ **User manual:** Guia do usuário
- ✅ **Admin guide:** Configurações
- ✅ **Troubleshooting:** Problemas comuns
- ✅ **FAQ:** Perguntas frequentes
- ✅ **Video tutorials:** Screencast (opcional)

### **12.3 Manutenção**
- ✅ **Update schedule:** Cronograma de atualizações
- ✅ **Bug tracking:** Sistema de issues
- ✅ **Feature requests:** Roadmap público
- ✅ **Performance monitoring:** Métricas
- ✅ **User feedback:** Sistema de feedback

---

## 🎯 **13. OBJETIVOS DE ENTREGA**

### **13.1 MVP (Minimum Viable Product)**
1. ✅ Autenticação e controle de acesso
2. ✅ Cadastro de pacientes e profissionais
3. ✅ Sistema de agendamentos básico
4. ✅ Prontuário eletrônico simples
5. ✅ Dashboard com KPIs essenciais
6. ✅ Relatórios básicos

### **13.2 Versão Completa**
1. ✅ Todas as funcionalidades listadas
2. ✅ Drag & drop avançado
3. ✅ Sistema financeiro completo
4. ✅ Automações e integrações
5. ✅ Mobile app (PWA)
6. ✅ Conformidade total LGPD

### **13.3 Roadmap Futuro**
- ✅ **Telemedicina:** Consultas online
- ✅ **IA/ML:** Predições e insights
- ✅ **API pública:** Integrações terceiros
- ✅ **Multi-idioma:** Internacionalização
- ✅ **White-label:** Customização por clínica

---

## 💡 **14. DICAS DE IMPLEMENTAÇÃO**

### **14.1 Priorização**
1. **Comece pelo core:** Auth → Pacientes → Agendamentos
2. **UX primeiro:** Interface antes de funcionalidades avançadas
3. **Dados reais:** Use dados de exemplo realistas
4. **Feedback rápido:** Implemente notificações cedo
5. **Mobile cedo:** Teste responsividade desde o início

### **14.2 Boas Práticas**
- ✅ **Componentes pequenos:** Single responsibility
- ✅ **Hooks customizados:** Lógica reutilizável
- ✅ **Error boundaries:** Captura de erros
- ✅ **Loading states:** Sempre mostrar progresso
- ✅ **Optimistic updates:** UX mais fluida

### **14.3 Armadilhas Comuns**
- ❌ **Over-engineering:** Não complique desnecessariamente
- ❌ **Premature optimization:** Foque na funcionalidade primeiro
- ❌ **Inconsistent UX:** Mantenha padrões visuais
- ❌ **Poor error handling:** Sempre trate erros
- ❌ **No loading states:** Usuário precisa de feedback

---

## 🏁 **RESULTADO ESPERADO**

Ao final, você deve ter um **CRM completo e profissional** para clínicas médicas, com:

✅ **Interface moderna e intuitiva**
✅ **Funcionalidades completas de gestão clínica**
✅ **Sistema de agendamentos com drag & drop**
✅ **Integração robusta com Supabase**
✅ **Design responsivo e acessível**
✅ **Código TypeScript bem estruturado**
✅ **Performance otimizada**
✅ **Segurança e conformidade LGPD**
✅ **Documentação completa**
✅ **Pronto para produção**

**O sistema deve ser capaz de gerenciar uma clínica real com múltiplos profissionais, centenas de pacientes e milhares de agendamentos, mantendo performance e usabilidade excepcionais.**

---

*Este prompt foi estruturado para garantir um resultado profissional, escalável e pronto para uso real em clínicas médicas. Siga cada seção metodicamente para obter o melhor resultado possível.*