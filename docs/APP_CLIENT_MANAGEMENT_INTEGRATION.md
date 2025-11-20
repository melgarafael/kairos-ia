# 🔧 Integração Final - Client Management no App.tsx

## ✅ O Que Foi Feito

1. ✅ Botão adicionado no Header
2. ✅ Opção no OrganizationsDropdown
3. ⏳ Listener e overlay no App.tsx (em progresso)

## 📝 Código para Adicionar no App.tsx

### Localização
Arquivo: `src/App.tsx`
Componente: `AuthenticatedApp`

### Passo 1: Adicionar useEffect para account_type

Adicionar APÓS os outros useEffect no início do componente:

```typescript
// Check if user is professional
useEffect(() => {
  let cancelled = false
  const checkProfessional = async () => {
    try {
      if (!user?.id) return
      const { data } = await masterSupabase
        .from('saas_users')
        .select('account_type')
        .eq('id', user.id)
        .single()
      if (!cancelled) setIsProfessional(data?.account_type === 'profissional')
    } catch {
      if (!cancelled) setIsProfessional(false)
    }
  }
  checkProfessional()
  return () => { cancelled = true }
}, [user?.id])

// Listen for event to open Client Management
useEffect(() => {
  const handleOpen = () => {
    if (isProfessional) {
      setShowClientManagement(true)
    }
  }
  window.addEventListener('openClientManagement', handleOpen)
  return () => window.removeEventListener('openClientManagement', handleOpen)
}, [isProfessional])
```

### Passo 2: Renderizar Overlay

Adicionar ANTES do `</SafeModeBoundary>` final:

```typescript
{/* Client Management Overlay */}
{showClientManagement && isProfessional && (
  <div className="fixed inset-0 z-[9999] bg-background">
    <ClientManagement onBack={() => setShowClientManagement(false)} />
  </div>
)}
```

---

## 🎯 Solução Completa

O problema é que o **OrganizationSetup não está renderizado** quando estamos dentro do App.

**Solução:** Mover a lógica do overlay para o **App.tsx** que está sempre renderizado!

---

**Status:** Código preparado, aguardando aplicação no App.tsx

