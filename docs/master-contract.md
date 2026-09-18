# Contrato Maestro de Comportamiento y Especificación de Sistema
## Módulo de Sucursales y Enrutamiento Inteligente AllSender

Este documento define la especificación oficial, el flujo lógico, el estado actual de cumplimiento y la hoja de ruta (*roadmap*) del agente conversacional de sucursales integrado con AllSender Omnichannel.

---

## 1. Flujo Lógico y Secuencia Obligatoria del Sistema

Toda interacción gestionada por el enrutador de sucursales sigue una secuencia estricta y determinista:

```text
               NUEVO MENSAJE (WhatsApp / Omnicanal)
                                |
                                v
                   ¿Existe Tenant / Workspace?
                                | SÍ
                                v
                    ¿Humano activo en el chat?
                     ├── SÍ ──> SILENCIO TOTAL (chatbot_paused = true)
                     └── NO
                          |
                          v
                 ¿Bot de Flujo en espera?
                     ├── SÍ (sin breakout) ──> SILENCIO (cede al flujo)
                     └── NO o con breakout permitido
                          |
                          v
            Detección de Idioma e Intención (11 categorías)
                          |
                          v
       ¿Caso requiere seguimiento o atención humana?
         ├── NO ──> Responde consulta (Base de Conocimiento)
         └── SÍ
              |
              v
       REGLA DE SUCURSAL OBLIGATORIA (Requisito Previo)
       ¿Sucursal identificada y validada en el catálogo?
         ├── NO ──> Pregunta ciudad/sucursal (NO promete registro)
         └── SÍ
              |
              v
       1. Resolver Sucursal (`resolved_branch_id`)
       2. Deducir Departamento según intención
       3. Buscar mejor agente disponible (menor carga / round-robin)
       4. Crear Ticket / Caso con prioridad y metadatos
       5. Asignar chat y ticket al agente seleccionado
       6. Confirmar derivación al cliente con nombre de sede
       7. Handoff y silencio de IA (`chatbot_paused = true`)
```

---

## 2. Taxonomía Maestra de Intenciones (11 Categorías)

El enrutador clasifica semánticamente cada consulta en una de las 11 categorías oficiales:
1. `SALES`: Ventas, cotizaciones, compras o contratación.
2. `SUPPORT`: Soporte técnico, incidencias operativas y asistencia.
3. `COMPLAINT`: Reclamos formales, inconformidad o paquetes dañados.
4. `BILLING`: Facturación, pagos, cobros duplicados o transferencias.
5. `ORDER`: Estatus, seguimiento o problemas con envíos/paquetes.
6. `PRODUCT_INFORMATION`: Características de productos o servicios.
7. `STOCK_CHECK`: Disponibilidad de inventario físico.
8. `HUMAN_REQUEST`: Solicitud explícita de hablar con un asesor humano.
9. `GENERAL_INFORMATION`: Horarios de atención, ubicaciones y teléfonos.
10. `GREETING`: Saludos de cortesía simples sin consulta de fondo.
11. `UNKNOWN`: Mensajes no clasificados o ambiguos.

---

## 3. Matriz de Cumplimiento de las 7 Herramientas del Contrato

El comportamiento operativo de las 7 herramientas solicitadas en el contrato maestro se encuentra **100% implementado y activo en la lógica de negocio**:

| Herramienta del Contrato | Estado Operativo | Mecanismo de Ejecución Actual |
| :--- | :---: | :--- |
| `create_ticket` | ✅ Implementado | Ejecutado en backend vía `organizationCaseService.openCase` con título, resumen estructurado, prioridad, intención, idioma y acción recomendada. |
| `find_best_agent` | ✅ Implementado | Ejecutado vía `selectAgentAccordingToContract`: filtra miembros activos de la sucursal y departamento, desempatando por menor carga de chats activos. |
| `assign_ticket_to_agent` | ✅ Implementado | Asigna `assigned_to` en Contacto, `agent_id` en `ChatAssignment` y crea la tarea en `AgentTask`. |
| `escalate_to_human` | ✅ Implementado | Pausa inmediata del bot (`chatbot_paused = true`), actualización de estado de conversación y emisión en tiempo real por WebSockets. |
| `update_contact_data` | ✅ Implementado | Enriquecimiento CRM automático: actualiza ciudad (`metadata.city`), idioma preferido y campos personalizados confirmados. |
| `check_catalog_or_stock` | ✅ Implementado | Conectado con la Base de Conocimiento empresarial (`organizationKnowledgeService`) y catálogo de productos. |
| `update_ticket_context` | ✅ Implementado | Memoria multi-turn activa: si el cliente aporta datos adicionales a un caso ya abierto, se agregan a `collected_information` sin duplicar tickets. |

---

## 4. Diferencia Técnica de Implementación: JSON Estructurado vs Function Calling

### Estado Actual (Producción):
El enrutador utiliza un **Esquema JSON Estructurado con Guardrails de Backend**:
- **Ventaja**: Compatibilidad universal con cualquier proveedor (DeepSeek, Gemini, Groq, OpenAI, Anthropic) a través de `omnicall-llm`.
- **Determinismo**: El modelo devuelve la interpretación semántica y el backend en JavaScript valida rigurosamente las reglas de seguridad, sucursales y permisos antes de ejecutar la acción en base de datos.
- **Seguridad**: Evita que un LLM invoque funciones con identificadores arbitrarios de otros inquilinos (aislamiento Multi-Tenant garantizado).

### Qué Falta / Roadmap Técnico:
1. **Capa Dual de Function Calling Nativo**:
   - Agregar soporte directo para el protocolo `tools` / `function_call` de OpenAI/Gemini como alternativa configurable por tenant, permitiendo ejecuciones de herramientas en tiempo real para clientes que no utilicen el esquema JSON estructurado.
2. **Presencia en Tiempo Real de Agentes**:
   - Integrar estados dinámicos del agente (`disponible`, `almorzando`, `ocupado`, `desconectado`) en tiempo real mediante Redis/WebSockets, complementando el conteo de carga de chats actual.
3. **Webhooks Bidireccionales para Sistemas Externos**:
   - Publicar eventos de cambio de estado de tickets a los endpoints configurados en `omnichannel_branch_integrations` mediante las Branch API Keys ya operativas.
