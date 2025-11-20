# 🎯 Wireframes Estruturais - Tomik CRM

**Agente UXWire** - Análise de engenharia reversa de layouts  
**Data:** 2025  
**Escopo:** Todas as páginas principais do sistema

---

## 📐 Estrutura Global da Aplicação

```
App
├── Header (Fixed Top)
│   ├── Logo + Title
│   ├── GlobalSearch
│   ├── CommandPalette (⌘K)
│   ├── AssistantButton
│   ├── TrailsButton
│   ├── ThemeToggle
│   ├── NotificationDropdown
│   ├── InvitationsDropdown
│   ├── OrganizationsDropdown
│   ├── PlanBadge
│   └── UserMenu
│       ├── UserInfo
│       ├── AvatarButton
│       └── DropdownMenu
│           ├── ManageOrganizations
│           ├── SubscribeOptions
│           ├── EditAccount
│           ├── ManageSupabases
│           ├── UpdateSupabase
│           ├── LanguageSwitcher
│           ├── StartTour
│           └── SignOut
│
├── Sidebar (Desktop, Expandable)
│   ├── NavItem[james]
│   ├── NavItem[whatsapp-repository]
│   ├── NavItem[automation]
│   ├── NavItem[rag]
│   ├── NavItem[qna]
│   ├── NavItem[kanban]
│   ├── NavItem[leads]
│   ├── NavItem[agenda]
│   ├── NavItem[clients]
│   ├── NavItem[collaborators]
│   ├── NavItem[consultations]
│   ├── NavItem[financial]
│   ├── NavItem[products]
│   ├── NavItem[reports]
│   ├── NavItem[faq]
│   ├── NavItem[notifications]
│   ├── SupportLink
│   └── ToggleButton
│
├── MobileSidebar (Bottom Navigation)
│   └── NavItem[] (Horizontal Scroll)
│
├── MainContent
│   └── [PageComponent] (Dynamic based on activeTab)
│
├── FloatingAssistant (Modal Overlay)
│   └── AssistantHome
│
├── ElevenLabsCallDock (Fixed Bottom)
│
├── CommandPalette (Modal Overlay)
│
├── VersionWarning (Fixed Bottom Left)
│
└── Toaster (Toast Notifications)
```

---

## 📄 Páginas Principais

### 1. **James Panel** (Dashboard/Home)

```
Page: JamesPanel
├── Background
│   ├── RadialGradient
│   ├── GridPattern
│   └── Atom3D (Canvas 3D)
│
├── Header
│   ├── Title
│   ├── CurrentDate
│   ├── TutorialButton
│   ├── ConnectionStatus
│   ├── CurrentTime
│   ├── UpdatePromptsLink
│   └── ImportN8nButton
│
├── MainContent (Grid 12 cols)
│   ├── LeftPanel (col-span-3)
│   │   ├── StatusPanel[System]
│   │   │   └── SystemMetric[]
│   │   ├── StatusPanel[Security]
│   │   │   └── SystemMetric[]
│   │   └── ElevenLabsConnection
│   │       ├── InputField
│   │       └── ActionButtons
│   │
│   ├── CenterPanel (col-span-6)
│   │   ├── VoiceCoreContainer
│   │   │   └── Atom3D
│   │   └── LabelBelow
│   │
│   └── RightPanel (col-span-3)
│       ├── StatusPanel[Connectivity]
│       │   └── SystemMetric[]
│       └── StatusPanel[Database]
│           └── SystemMetric[]
│
├── Footer (Fixed Bottom)
│   └── SystemMetric[]
│       ├── Activity
│       ├── Processing
│       └── Connections
│
└── Modals
    ├── JamesPromptsDrawer
    ├── JamesTutorialModal
    └── N8nIntegrationModal
```

---

### 2. **Kanban** (CRM Pipeline)

```
Page: Kanban
└── KanbanBoard
    ├── Header
    │   ├── Title
    │   ├── StatsCards[]
    │   ├── Filters
    │   └── Actions[]
    │
    ├── KanbanColumns[] (Horizontal Scroll)
    │   └── KanbanColumn
    │       ├── ColumnHeader
    │       │   ├── StageName
    │       │   ├── LeadCount
    │       │   └── StageActions
    │       └── KanbanCards[]
    │           └── KanbanCard
    │               ├── LeadName
    │               ├── ContactInfo
    │               ├── PriorityBadge
    │               ├── ValueBadge
    │               └── QuickActions
    │
    └── Modals
        ├── KanbanAddLeadModal
        ├── KanbanEditModal
        ├── KanbanNewLeadModal
        ├── StageManagementModal
        ├── PaymentModal
        ├── LeadTimeline
        └── ImportLeadsWizard
```

---

### 3. **Agenda** (Calendar/Appointments)

```
Page: Agenda
├── Header
│   ├── Title + Description
│   └── StatsCards[]
│       ├── Total
│       ├── Events
│       ├── AIInteractions
│       └── Agendados
│
├── Controls
│   ├── SpecialistSelect
│   └── SearchAndFilters
│       ├── SearchInput
│       ├── SavedViewsDropdown
│       ├── SaveViewButton
│       ├── AdvancedFiltersToggle
│       ├── CreateButton
│       └── ViewModeToggle (Day/Week)
│
├── ActiveFiltersDisplay
│   └── FilterChips[]
│
├── CalendarSection
│   ├── CalendarHeader
│   │   ├── NavigationButtons
│   │   ├── DateRangeDisplay
│   │   ├── AppointmentCount
│   │   ├── ViewModeToggle
│   │   └── CreateButton
│   │
│   ├── StatusLegend
│   │
│   └── AgendaCalendar
│       └── CalendarGrid
│           └── AppointmentSlot[]
│
└── Modals
    ├── NewAppointmentModal
    └── AppointmentDetails
```

---

### 4. **Financial** (Financial Dashboard)

```
Page: Financial
└── FinancialDashboardNew
    ├── Header
    │   ├── Title
    │   └── PeriodSelector
    │
    ├── KPICards[]
    │   ├── Revenue
    │   ├── Expenses
    │   ├── Profit
    │   └── Cashflow
    │
    ├── ChartsSection
    │   ├── CashflowChart
    │   ├── RevenueChart
    │   └── ExpensesChart
    │
    ├── TransactionsTable
    │   ├── Filters
    │   ├── TableHeader
    │   └── TransactionRow[]
    │
    └── Modals
        └── FinancialTransactionModal
```

---

### 5. **Automation Dashboard**

```
Page: AutomationDashboard
├── SideNavigation (Desktop)
│   ├── Header
│   │   ├── Icon
│   │   └── Title + Subtitle
│   │
│   └── NavItems[]
│       ├── Apresentação
│       ├── Aprenda a Construir
│       ├── Agentes de IA
│       ├── Webhooks
│       ├── Templates
│       ├── Prompts
│       ├── Correção de erros
│       ├── Manual Supabase
│       └── Instale o n8n na VPS
│
└── MainContent
    ├── TabContent (Dynamic)
    │   ├── AutomationOverview (apresentação)
    │   ├── AutomationLearn (aprenda)
    │   ├── AIAgentsStore (ai_agents)
    │   ├── WebhookConfigurationPanel (webhooks)
    │   ├── AutomationTemplates (templates)
    │   ├── AutomationPrompts (prompts)
    │   ├── AutomationTroubleshooting (correcao_erros)
    │   ├── SupabaseManual (supabase_manual)
    │   └── N8nVPSInstall (n8n_vps)
    │
    └── Modals
        └── DiscoveryModal (n8n Auto-Discovery)
```

---

### 6. **Reports** (Metrics & Funnel)

```
Page: Reports
├── TabsNavigation
│   ├── Pipeline
│   ├── Financeiro
│   ├── Atividades
│   └── Evolução
│
├── Toolbar
│   ├── PeriodPresets[]
│   ├── DensityToggle
│   ├── PeriodChip
│   └── PersonalizeButton
│
├── FiltersPanel
│   ├── DateRangePicker
│   └── FilterBar
│
└── TabContent (Dynamic)
    ├── Pipeline Tab
    │   └── ReportsDashboard
    │       ├── KPICards[]
    │       ├── FunnelChart
    │       ├── DonutChartWidget
    │       ├── StageBarsWidget
    │       └── LineChartWidget
    │
    ├── Financeiro Tab
    │   ├── CashflowChart
    │   ├── TopServicesWidget
    │   └── LineChartWidget
    │
    ├── Atividades Tab
    │   └── HeatmapWidget
    │
    └── Evolução Tab
        ├── LineChartWidget
        └── DonutChartWidget
```

---

### 7. **Leads** (Leads List)

```
Page: Leads
├── Toolbar (Sticky)
│   ├── Title + Description
│   ├── SearchInput
│   ├── PeriodMenu
│   ├── SavedViewsMenu
│   ├── DisplayMenu
│   ├── CreateButton
│   └── MoreMenu
│
├── FiltersCard
│   ├── QuickFilters[]
│   │   ├── PriorityBadges[]
│   │   └── ClearAllButton
│   │
│   └── AdvancedFilters (Popover)
│       ├── StageSelect
│       ├── SourceSelect
│       ├── ChannelSelect
│       ├── PrioritySelect
│       └── DateRangeInputs[]
│
├── TableSection
│   ├── TableToolbar
│   │   ├── SelectAllButton
│   │   ├── SelectedCount
│   │   ├── DensityToggle
│   │   ├── BulkEditButton
│   │   └── BulkDeleteButton
│   │
│   ├── DesktopTable
│   │   ├── TableHeader
│   │   │   └── ColumnHeaders[]
│   │   └── TableBody
│   │       └── TableRow[]
│   │           ├── Checkbox
│   │           ├── Name
│   │           ├── Contact
│   │           ├── Stage
│   │           ├── Priority
│   │           ├── Channel
│   │           ├── Value
│   │           ├── Paid
│   │           └── CreatedAt
│   │
│   └── MobileCards[]
│       └── LeadCard
│
└── Modals
    ├── LeadEditorModal
    ├── NewAppointmentModal
    └── BulkEditModal
```

---

### 8. **Patients** (Clients)

```
Page: Patients
├── PatientsTable
│   ├── Header
│   │   ├── Title
│   │   ├── SearchInput
│   │   └── AddButton
│   │
│   ├── Table
│   │   ├── TableHeader
│   │   └── TableBody
│   │       └── PatientRow[]
│   │           ├── Name
│   │           ├── Contact
│   │           ├── LastAppointment
│   │           └── Actions
│   │
│   └── EmptyState
│
└── Modals
    ├── PatientFormModal
    ├── PatientDetailsModal
    └── ConvertToLeadModal
```

---

### 9. **Consultations** (Completed Appointments)

```
Page: Consultations
├── Header
│   ├── Title
│   ├── DateRangeDisplay
│   └── CreateButton
│
├── Toolbar
│   ├── SearchInput
│   ├── DateRangeInputs[]
│   ├── MetricsDisplay
│   └── SortToggle
│
├── Content
│   ├── DesktopView
│   │   └── GroupedByDay[]
│   │       └── DayGroup
│   │           ├── DayHeader
│   │           └── Table
│   │               ├── TableHeader
│   │               └── TableBody
│   │                   └── ConsultationRow[]
│   │
│   └── MobileView
│       └── ConsultationCards[]
│           └── ConsultationCard
│
└── Modals
    ├── ConsultationFormModal
    ├── NewAppointmentModal
    └── AppointmentDetails
```

---

### 10. **Notifications**

```
Page: Notifications
└── NotificationCenter
    ├── Header
    │   ├── Title
    │   └── MarkAllReadButton
    │
    ├── NotificationTabs
    │   ├── All
    │   ├── Unread
    │   └── Archived
    │
    └── NotificationList
        └── NotificationItem[]
            ├── Icon
            ├── Content
            ├── Timestamp
            └── Actions
```

---

### 11. **QnA** (Training System)

```
Page: QnATab
├── Header
│   ├── Icon + Title
│   ├── ImportButton
│   ├── TabToggle (Q&A | Gestão de prompt)
│   └── CreateButton
│
├── Content (Dynamic by Tab)
│   ├── QnA Tab
│   │   ├── SubTabToggle (Catalog | Import)
│   │   │
│   │   ├── Catalog SubTab
│   │   │   ├── SearchInput
│   │   │   ├── QnAGrid[]
│   │   │   │   └── QnACard
│   │   │   │       ├── Category
│   │   │   │       ├── Question
│   │   │   │       ├── AnswerPreview
│   │   │   │       └── Actions
│   │   │   │
│   │   │   └── Pagination
│   │   │
│   │   └── Import SubTab
│   │       └── ImportQnAWizard
│   │
│   └── Prompts Tab
│       ├── SearchInput
│       ├── PromptsGrid[]
│       │   └── PromptCard
│       │       ├── AgentName
│       │       ├── MetadataBadges[]
│       │       ├── PromptPreview
│       │       └── Actions
│       │
│       └── PromptFormModal
│           ├── Tabs[]
│           │   ├── Identidade
│           │   ├── Raciocínio
│           │   ├── Feedbacks
│           │   ├── Exemplos
│           │   ├── Output Format
│           │   └── Prompt final
│           │
│           └── SaveButtons
│
└── Modals
    ├── QnAFormModal
    └── AgentPromptFormModal
```

---

### 12. **RAG** (Retrieval Augmented Generation)

```
Page: RAGHome
├── SideNavigation (Desktop)
│   ├── Header
│   │   ├── Icon
│   │   └── Title + Subtitle
│   │
│   ├── NavItems[]
│   │   ├── Datasets
│   │   └── Busca
│   │
│   └── NewImportButton
│
└── MainContent
    ├── DatasetsPanel (if tab === 'datasets')
    │   ├── Header
    │   │   ├── Title
    │   │   └── ImportButton
    │   │
    │   └── DatasetsList[]
    │       └── DatasetCard
    │           ├── Name
    │           ├── Status + RowCount
    │           └── CreatedAt
    │
    ├── SearchPanel (if tab === 'search')
    │   ├── SearchForm
    │   │   ├── QueryInput
    │   │   ├── SourceSelect
    │   │   └── SearchButton
    │   │
    │   └── ResultsList[]
    │       └── ResultCard
    │           ├── SimilarityScore
    │           ├── Category
    │           └── Content
    │
    └── Modals
        └── RAGImporter
```

---

### 13. **Products & Services**

```
Page: ProductsServices
├── Header
│   ├── Title
│   └── CreateButton
│
├── Tabs
│   ├── Products
│   └── Services
│
├── ProductsTab
│   ├── Filters
│   ├── ProductsGrid[]
│   │   └── ProductCard
│   │       ├── Image
│   │       ├── Name
│   │       ├── Price
│   │       ├── Stock
│   │       └── Actions
│   │
│   └── EmptyState
│
└── Modals
    ├── ProductFormModal
    └── ImportProductsWizard
```

---

### 14. **Professionals** (Collaborators)

```
Page: Professionals
├── Header
│   ├── Title
│   └── AddButton
│
├── ProfessionalsList
│   └── ProfessionalCard[]
│       ├── Avatar
│       ├── Name
│       ├── Position
│       ├── Contact
│       └── Actions
│
└── Modals
    └── ProfessionalFormModal
```

---

## 🎨 Componentes de Layout Comuns

### Header
```
Header
├── LeftSection
│   ├── LogoButton
│   ├── GlobalSearch
│   ├── CommandPaletteButton
│   ├── AssistantButton
│   └── TrailsButton
│
└── RightSection
    ├── ThemeToggle
    ├── NotificationDropdown
    ├── InvitationsDropdown
    ├── OrganizationsDropdown
    ├── PlanBadge
    ├── UserInfo
    └── UserMenuDropdown
```

### Sidebar
```
Sidebar
├── NavSection
│   └── NavItem[]
│       ├── Icon
│       ├── Label (when expanded)
│       └── Tooltip (when collapsed)
│
├── SupportSection
│   └── SupportLink
│
└── ToggleSection
    └── ToggleButton
```

### MobileSidebar
```
MobileSidebar
└── HorizontalScrollContainer
    └── NavItem[]
        ├── Icon
        └── Label
```

---

## 🔧 Componentes UI Reutilizáveis

### Modals
- `Modal` (Base)
- `AccountSettingsModal`
- `SwitchSupabaseModal`
- `NewAppointmentModal`
- `AppointmentDetails`
- `LeadEditorModal`
- `PatientFormModal`
- `ProductFormModal`
- `ConsultationFormModal`

### Forms
- `Input`
- `Button`
- `Select`
- `DateRangePicker`
- `FilterBar`
- `ExpandableTextarea`

### Data Display
- `Table` (Desktop/Mobile)
- `Card`
- `StatsCard`
- `KPIWidget`
- `ChartWidget[]`

### Navigation
- `Tabs`
- `Breadcrumbs`
- `Pagination`

---

## 📱 Responsividade

- **Desktop**: Sidebar lateral + MainContent expandido
- **Tablet**: Sidebar colapsável + MainContent adaptativo
- **Mobile**: MobileSidebar inferior + MainContent full-width

---

## 🎯 Padrões de Navegação

1. **Tab-based**: Navegação principal via tabs no Sidebar
2. **Hash-based**: Deep-links via `#tab=...` e `#feature:subfeature`
3. **Event-based**: Comunicação entre componentes via eventos customizados
4. **Modal-based**: Ações secundárias em modais overlay

---

## 📊 Notas de Implementação

- Todos os layouts usam CSS Grid e Flexbox
- Glassmorphism aplicado em cards e modais
- Animações suaves com `transition-apple`
- Sistema de cores baseado em CSS variables (`hsl(var(--...))`)
- Dark mode nativo via ThemeProvider
- Internacionalização (i18n) via react-i18next

---

**Fim do Documento**

