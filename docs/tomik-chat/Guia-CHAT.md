Table of Contents
Project Overview
Project Structure & Routes
Authentication & Route Protection
Component Architecture & Patterns
API Endpoints & Data Flow
State Management
Testing Structure
Responsibilities & Development Guidelines
Technology Stack
Environment & Configuration

Project Overview

TomikAI GPTs is a Next.js 13.5.1 application with App Router that provides a multi-LLM chat platform with assistant management, template library, and workflow automation capabilities. The platform supports various AI providers (OpenAI, Anthropic, Google) and features real-time chat, file attachments, subscription management, and N8N integration.

Key Features
Multi-LLM Chat: Support for multiple AI providers with model switching
Assistant Management: Create, configure, and manage AI assistants with custom prompts
Template Library: Pre-built assistant templates and workflows
Real-time Communication: Live conversation updates via Supabase realtime
File Attachments: Support for various file types in conversations
Subscription Management: Tiered pricing with usage tracking
N8N Integration: Workflow automation capabilities
Project Organization: Group conversations into projects

Project Structure & Routes

Directory Structure
tomikai-gpts/
├── app/                          # Next.js App Router pages and layouts
│   ├── dashboard/               # Protected dashboard routes
│   │   ├── assistants/         # Assistant management pages
│   │   │   ├── [id]/           # Individual assistant page
│   │   │   └── page.tsx        # Assistants listing page
│   │   ├── chat/               # Chat interface pages
│   │   │   ├── [id]/           # Individual chat page
│   │   │   └── new/            # New chat page
│   │   ├── flows/              # N8N workflow pages
│   │   │   ├── [id]/           # Individual flow page
│   │   │   └── new/            # New flow page
│   │   ├── templates/          # Template pages
│   │   │   ├── [id]/           # Individual template page
│   │   │   └── page.tsx        # Templates listing page
│   │   ├── settings/           # User settings page
│   │   ├── success/            # Success page (payment)
│   │   ├── layout.tsx          # Dashboard layout wrapper
│   │   └── page.tsx            # Dashboard home page
│   ├── auth routes/            # Public authentication pages
│   │   ├── login/              # Login page
│   │   ├── register/           # Registration page
│   │   └── reset-password/     # Password reset page
│   ├── onboarding/             # User onboarding page
│   ├── compra-aprovada/        # Payment success page (Portuguese)
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Landing page
├── components/                  # Reusable React components
│   ├── ui/                     # Shadcn/ui base components
│   ├── auth/                   # Authentication forms and components
│   ├── chat/                   # Chat interface components
│   ├── dashboard/              # Dashboard-specific components
│   ├── assistants/             # Assistant management components
│   ├── templates/              # Template-related components
│   ├── settings/               # Settings page components
│   └── shared/                 # Shared components across features
├── hooks/                      # Custom React hooks for business logic
├── lib/                        # Utilities, types, and configurations
│   ├── supabase/              # Supabase client configuration
│   ├── types/                 # TypeScript type definitions
│   ├── utils/                 # Helper functions
│   ├── constants/             # Application constants
│   ├── schemas/               # Validation schemas
│   └── llm/                   # LLM provider integrations
├── supabase/                  # Database migrations and configuration
├── __tests__/                 # Test files
│   ├── setup/                 # Test setup and configuration
│   ├── unit/                  # Unit tests
│   └── e2e/                   # End-to-end tests
└── middleware.ts              # Next.js middleware for route protection

Route Structure

Public Routes
/ - Landing page
/login - User authentication
/register - User registration
/reset-password - Password reset
/onboarding - User onboarding flow
/compra-aprovada - Payment success page

Protected Routes (require authentication)
All routes under /dashboard are protected:

/dashboard - Main dashboard/home
/dashboard/assistants - Assistant management
/dashboard/assistants/[id] - Individual assistant details
/dashboard/chat - Chat interface
/dashboard/chat/new - Create new chat
/dashboard/chat/[id] - Individual chat conversation
/dashboard/templates - Template library
/dashboard/templates/[id] - Individual template details
/dashboard/flows - N8N workflow management
/dashboard/flows/new - Create new flow
/dashboard/flows/[id] - Individual flow details
/dashboard/settings - User settings and preferences
/dashboard/success - Success page for various operations

Authentication & Route Protection

Authentication System
The application uses Supabase Auth with Server-Side Rendering (SSR) support for authentication.

Authentication Flow
Session Management: Handled via lib/supabase/middleware.ts:updateSession
Token Refresh: Automatic token renewal with deduplication via lib/utils/token-manager.ts
Route Protection: Middleware-based protection in middleware.ts:5-45

Route Protection Configuration
// middleware.ts
const protectedRoutes = ['/dashboard', '/profile', '/templates'];
const authRoutes = ['/login'];

Authentication Components
LoginForm (components/auth/login-form.tsx) - Login interface
SignupForm (components/auth/signup-form.tsx) - Registration interface
ResetPasswordForm (components/auth/reset-password-form.tsx) - Password reset
AuthLayoutWrapper (components/auth/auth-layout-wrapper.tsx) - Auth page wrapper

Token Management Features
Automatic token refresh with 5-minute buffer
Deduplication to prevent multiple simultaneous refresh requests
Retry mechanism for failed API requests (401 responses)
Development logging for token refresh activities

Component Architecture & Patterns

Architectural Patterns

1. Compound Component Pattern
Complex UI components use the compound pattern for better composition:

// Dashboard Layout Structure
<SidebarProvider>
  <DashboardContent>
    <AppSidebar />
    <SidebarInset>
      <DashboardHeader />
      <main>{children}</main>
    </SidebarInset>
  </DashboardContent>
</SidebarProvider>

2. Custom Hooks Pattern
Business logic is abstracted into custom hooks:
use-chat-store.ts - Chat state management
use-assistants.ts - Assistant management
use-auth.ts - Authentication logic
use-sidebar-navigation.ts - Sidebar navigation logic

3. Provider Pattern
Global state and context management:
PostHogProvider - Analytics
SidebarProvider - Sidebar state
Authentication context via Supabase

Component Categories

Base UI Components (components/ui/)
Shadcn/ui components providing the design system foundation:
Form controls (Button, Input, Textarea)
Layout components (Sidebar, Dialog, Card)
Navigation components (Tooltip, Dropdown)
Feedback components (Toast, Badge, Alert)

Feature Components
Domain-specific components organized by feature:

Chat Components (components/chat/)
ChatClient - Main chat orchestrator
ChatInput - Message input interface
ChatMessages - Message display
MessageContent - Individual message rendering

Assistant Components (components/assistants/)
AssistantsList - Assistant grid/list view
AssistantCard - Individual assistant display
AssistantDetailsDialog - Assistant configuration
CreateAssistantCard - Assistant creation interface

Dashboard Components (components/dashboard/)
DashboardHeader - Top navigation
AppSidebar - Left sidebar with navigation and conversations
SidebarConversations - Conversation list management

Layout Components
AuthLayoutWrapper - Authentication page layout
DashboardLayout - Main application layout with sidebar
NewChatLayout - Chat page specific layout

State Management Architecture

Global State (Zustand)
Chat Store (hooks/use-chat-store.ts) - Conversations, messages, streaming
Assistant Store (hooks/use-assistants.ts) - Assistant data and operations
Projects Store (hooks/use-projects.ts) - Project organization
Favorites Store (hooks/use-favorites.ts) - User favorites

Local State
React hooks (useState, useReducer) for component-specific state
Form state managed via React Hook Form
UI state (modals, dropdowns) with local state

Server State
React Query patterns via custom hooks
Real-time subscriptions via Supabase realtime
Optimistic updates for better UX

API Endpoints & Data Flow

API Communication Architecture

Fetch Client (lib/fetch-client.ts)
Centralized HTTP client with automatic authentication:
Automatic token refresh and retry logic
Error handling with custom FetchError class
Support for FormData and JSON payloads
Authorization header injection

Main API Endpoints
Based on usage patterns in the codebase:

Conversation Management
GET /conversations - List user conversations with pagination
GET /conversations/{id} - Get specific conversation
POST /conversations - Create new conversation
DELETE /conversations/{id} - Delete conversation
POST /conversations/{id}/fix - Pin/unpin conversation

Message Management
GET /messages/{conversationId} - Get conversation messages (legacy)
GET /v2/messages/{conversationId} - Get conversation messages (v2 API)
Server-Sent Events (SSE) for streaming responses

Assistant Management
GET /assistants - List assistants
POST /assistants - Create assistant
PUT /assistants/{id} - Update assistant
DELETE /assistants/{id} - Delete assistant

Template Management
GET /templates - List templates
GET /templates/{id} - Get specific template

File Management
File upload handling via FormData
Supabase Storage integration for file attachments

Data Flow Patterns

1. Real-time Updates
// Real-time conversation updates via Supabase
subscribeToConversations(userId) -> RealtimeChannel
  - onConversationInsert
  - onConversationUpdate
  - onConversationDelete

2. Streaming Responses
// Server-Sent Events for LLM responses
processMessageWithStream(message, callbacks, options)
  - createSSERequest()
  - processStreamResponse()
  - Error handling with AbortController

3. Optimistic Updates
Immediate UI updates before API confirmation
Rollback mechanisms for failed operations
Loading states during async operations

4. Pagination
Server-side pagination for conversations and messages
Infinite scroll implementation
Page-based loading with hasMore flags

State Management

Zustand Stores

Chat Store (hooks/use-chat-store.ts)
Purpose: Manages conversations, messages, and chat streaming
Key State:
{
  groupedConversations: ConversationWithProject[];
  ungroupedConversations: ConversationWithProject[];
  selectedConversation: ConversationWithProject;
  messages: Message[];
  isGenerating: boolean;
  isSubmitting: boolean;
  // Pagination and loading states
}

Key Actions:
fetchConversations() - Load user conversations
processMessageWithStream() - Handle streaming LLM responses
subscribeToConversations() - Real-time updates
createConversation() - Create new chat

Assistant Store (hooks/use-assistants.ts)
Purpose: Manages assistant data and operations
Key Features:
Assistant CRUD operations
Category-based filtering
Search functionality
Template integration

Project Store (hooks/use-projects.ts)
Purpose: Handles project organization for conversations
Features:
Project creation and management
Conversation grouping
Project-based navigation

Real-time Integration

Supabase Realtime
Conversations: Live updates for new/updated/deleted conversations
Messages: Real-time message delivery (if implemented)
User presence: Online/offline status tracking

WebSocket Management
Automatic reconnection handling
Subscription cleanup on component unmount
Error handling and retry logic

Testing Structure

Testing Architecture

Framework Configuration
Unit Testing: Vitest with @testing-library/react
E2E Testing: Playwright with TypeScript
Mocking: MSW (Mock Service Worker) for API mocking
Coverage: V8 provider with 80% threshold targets

Test Organization
__tests__/
├── setup/
│   ├── vitest.setup.ts          # Global test configuration
│   ├── test-utils.tsx           # Custom render with providers
│   └── mocks/
│       ├── server.ts            # MSW server setup
│       ├── handlers.ts          # API mock handlers
│       └── browser.ts           # Browser MSW setup
├── unit/                        # Component and hook tests
│   ├── components/
│   ├── hooks/
│   └── utils/
└── e2e/                        # End-to-end tests
    ├── auth.spec.ts
    ├── chat.spec.ts
    ├── assistants.spec.ts
    └── fixtures/                # Playwright fixtures

Test Commands
npm run test          # Watch mode unit tests
npm run test:run      # Single run unit tests
npm run test:coverage # Coverage report
npm run test:ui       # Vitest UI
npm run test:e2e      # Playwright E2E tests
npm run test:all      # All tests

Testing Standards
TDD Approach: Write tests before implementation
Component Testing: User interactions, accessibility, state changes
Hook Testing: Custom hooks with React Testing Library
E2E Testing: Critical user flows end-to-end
Coverage Requirements: Minimum 80% for new features

Mock Strategy
API Calls: MSW handlers for consistent API mocking
External Services: Mock Supabase, analytics providers
File Operations: Mock file upload/download operations
Real-time: Mock WebSocket connections and events

Responsibilities & Development Guidelines

Code Organization Responsibilities

Frontend Architecture
Components: Single responsibility, reusable, well-typed
Hooks: Business logic abstraction, side effect management
Utils: Pure functions, helper methods, type utilities
Types: Comprehensive TypeScript definitions

Backend Integration
API Client: Centralized request handling via fetch-client
Authentication: Token management and refresh logic
Real-time: WebSocket connection management
Error Handling: Consistent error boundaries and user feedback

Development Standards

TypeScript Standards
Strict Mode: No any types allowed
Explicit Interfaces: All props and API responses typed
Type Inference: Leverage when appropriate, explicit for complex cases
Generics: For reusable components and utilities

React Patterns
Server Components: Default choice, Client Components for interactivity
Custom Hooks: Business logic abstraction
Error Boundaries: Robust error handling
Accessibility: WCAG 2.1 AA compliance

Styling Standards
Tailwind CSS: All styling via utility classes
Shadcn/ui: Design system adherence
Responsive Design: Mobile-first approach
Theme Support: CSS custom properties for theming

File Naming Conventions
Components: PascalCase (AssistantCard.tsx)
Utilities: kebab-case (chat-helpers.ts)
Hooks: prefix with "use" (use-chat-store.ts)
Types: descriptive with domain context (conversation.ts)

Git Workflow
Branch Strategy: Feature branches from development
Commit Messages: Conventional commit format via Commitlint
Pre-commit Hooks: Husky with lint and format checks
Code Review: Required for all changes to main branch

Performance Guidelines
Code Splitting: Dynamic imports for large features
Image Optimization: Next.js Image component
Bundle Analysis: Regular bundle size monitoring
Virtualization: For large lists (conversations, messages)

Technology Stack

Core Framework
Next.js 13.5.1: React framework with App Router
React 18: UI library with concurrent features
TypeScript 5.2.2: Type-safe JavaScript

UI & Styling
Tailwind CSS 3.3.3: Utility-first CSS framework
Shadcn/ui: Component library with Radix UI primitives
Framer Motion: Animation library
Lucide React: Icon library

Backend & Database
Supabase: Backend-as-a-Service (PostgreSQL, Auth, Storage, Realtime)
Supabase SSR: Server-side rendering support

State Management
Zustand: Lightweight state management
React Query: Server state management
React Hook Form: Form state management

LLM Integrations
OpenAI: GPT models
Anthropic: Claude models
Google AI: Gemini models
LangChain: LLM abstraction layer

Development Tools
ESLint: Code linting with strict rules
Prettier: Code formatting
Husky: Git hooks for quality gates
Commitlint: Conventional commit enforcement

Testing
Vitest: Unit testing framework
Testing Library: React component testing utilities
Playwright: End-to-end testing framework
MSW: API mocking for tests

Analytics & Monitoring
PostHog: Product analytics and feature flags
Mixpanel: Advanced analytics
Sentry: Error tracking and monitoring

Additional Integrations
Redis: Caching and session management
Pinecone: Vector database for AI features
N8N: Workflow automation
Stripe: Payment processing (inferred from dependencies)

Environment & Configuration

Environment Variables
Required environment variables (from CLAUDE.md):
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# API Configuration
NEXT_PUBLIC_API_URL=

# Analytics
# PostHog configuration
# Mixpanel configuration
# Sentry configuration

# LLM Provider Keys
# OpenAI API key
# Anthropic API key
# Google AI API key

Development Scripts
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "lint:fix": "next lint --fix",
  "lint:strict": "eslint \"**/*.{js,ts,tsx}\" --max-warnings=0",
  "prettier": "prettier --write \"**/*.{js,ts,tsx,css,md}\"",
  "test": "vitest",
  "test:run": "vitest run",
  "test:e2e": "playwright test",
  "test:all": "npm run test:run && npm run test:e2e"
}

Configuration Files
next.config.js: Next.js configuration
tailwind.config.js: Tailwind CSS configuration
tsconfig.json: TypeScript configuration
vitest.config.ts: Vitest testing configuration
playwright.config.ts: Playwright E2E testing configuration
.eslintrc.json: ESLint configuration
prettier.config.js: Prettier formatting rules

Database Management
Supabase Migrations: Database schema changes in supabase/migrations/
Migration Commands:
supabase migration new [migration-name]

Deployment Considerations
Build Process: Next.js static generation and SSR
Environment Separation: Development, staging, production configs
Database Migrations: Automated via Supabase CLI
Monitoring: Sentry for error tracking in production
