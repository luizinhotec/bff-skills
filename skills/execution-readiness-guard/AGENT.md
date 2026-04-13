# Agent Behavior - Execution Readiness Guard

## Uso correto

1. Ler uma rota específica do estado compartilhado.
2. Executar esta skill isoladamente.
3. Consumir a decisao registrada em `executionReadinessByRoute`.

## Guardrails

- Nunca assumir dado ausente como seguro.
- Nunca executar acoes externas a partir desta skill.
- Toda evolução de regra de prontidão deve virar outra skill ou uma nova versão desta skill.
