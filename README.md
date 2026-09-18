# AllSender Omnichannel Branches

Módulo open-source de **sucursales conversacionales** para AllSender Omnichannel.

No es el módulo Departamentos. Una sucursal representa un punto físico u operativo y funciona de forma independiente: ubicación, canales, agentes humanos, agentes IA, conocimiento e integraciones empresariales.

## Qué incluye

- Multi-tenant por Workspace.
- CRUD de sucursales y miembros.
- Turf.js: distancia, sucursal más cercana, radio de cobertura y polígonos GeoJSON.
- Resolución por canal dedicado, ubicación WhatsApp, alias/palabras, ciudad y sucursal por defecto.
- Agentes autónomos con VoltAgent.
- Reutiliza `UserSetting.ai_model` + `UserSetting.api_key` del cliente en AllSender.
- Proveedores: OpenAI, Anthropic, Google, Groq, Mistral, Cohere, xAI, DeepSeek y custom OpenAI-compatible.
- Knowledge por empresa o sucursal.
- Tools verificadas para información de sucursal, knowledge, pedidos/tracking sincronizados, APIs externas y handoff humano.
- Conversation ownership: `NONE`, `LEGACY_AUTOMATION`, `AI`, `WAITING_HUMAN`, `HUMAN`.
- Human handoff y First Claim atómico.
- API externa por sucursal con scopes y claves hasheadas.
- Importación OpenAPI: GET habilitados; operaciones de escritura deshabilitadas por defecto.
- Credenciales externas cifradas AES-256-GCM.
- Cliente TypeScript para React/Vite.

## Arquitectura

```text
Canal existente de AllSender
        |
        v
  BranchResolver
  | channel
  | WhatsApp location -> Turf.js
  | alias / ciudad
  | default
        |
        v
     Branch
        |
   +----+-------------------+
   |                        |
VoltAgent                Human Queue
   |                        |
   | tools                  | first claim
   v                        v
Knowledge / ERP /      Existing User +
Orders / Tracking      ChatAssignment
```

## Instalación en AllSender API

Mientras el paquete se consume directamente desde GitHub:

```bash
npm install github:CodeMorf/allsender-omnichannel-branches
```

Después registra el módulo en el `app.js` de AllSender:

```js
import db from './models/index.js';
import { authenticate } from './middlewares/auth.js';
import { registerAllSenderBranches } from '@allsender/omnichannel-branches/integration';

export const branchesModule = registerAllSenderBranches({
  app,
  models: db,
  authenticate,
  integrationEncryptionKey: process.env.ALLSENDER_BRANCHES_ENCRYPTION_KEY
});
```

El módulo comparte Express y Mongoose del host mediante peer dependencies; no crea otra conexión MongoDB.

Configura una clave de cifrado backend para credenciales de ERP/tracking:

```env
ALLSENDER_BRANCHES_ENCRYPTION_KEY=una-clave-larga-unica-del-servidor
```

La **key del modelo IA no se configura aquí**. Se obtiene del sistema ya existente de AllSender (`UserSetting.ai_model` y `UserSetting.api_key`).

Consulta [docs/integration.md](docs/integration.md) para conectar mensajes entrantes y [docs/external-api.md](docs/external-api.md) para sincronizar pedidos, tracking y conocimiento.

## Uso desde React / Vite

```ts
import { createBranchesApi } from '@allsender/omnichannel-branches/frontend';

const branchesApi = createBranchesApi({
  workspaceId: () => localStorage.getItem('selected_workspace_id')
});

const branches = await branchesApi.list();
```

El cliente envía `x-workspace-id` y cookies de sesión; puedes inyectar headers de autenticación si tu frontend actual los necesita.

## API administrativa

Base: `/api/branches`

- `GET /` — sucursales.
- `POST /` — crear.
- `POST /resolve` — resolver sucursal.
- `GET/PATCH/DELETE /:id` — detalle, editar, archivar.
- `GET/POST/PATCH/DELETE /:id/members...` — agentes humanos.
- `GET/POST/PATCH/DELETE /:id/agents...` — agentes IA.
- `POST /:id/agents/respond` — ejecución autónoma.
- `GET/POST /:id/knowledge` — conocimiento.
- `GET/POST/PATCH/DELETE /:id/integrations...` — APIs externas.
- `POST /:id/integrations/import-openapi` — importar OpenAPI.
- `GET /:id/handoffs` — cola humana.
- `POST /handoffs/:id/claim` — First Claim.
- `GET/POST /:id/api-keys` — credenciales de API por sucursal.

Todas las rutas administrativas usan el Workspace seleccionado desde el header confiable `x-workspace-id`; no aceptan `workspace_id` del body como autoridad.

## Flujo autónomo

1. Llega un mensaje a un canal ya conectado en AllSender.
2. `BranchResolver` conserva una sucursal ya seleccionada o intenta canal → ubicación → palabra/alias → default.
3. Turf.js selecciona zona/sucursal cuando el mensaje contiene ubicación.
4. `ConversationControlService` intenta adquirir ownership para `AI`.
5. El adapter obtiene el modelo/key que el dueño del Workspace ya configuró en AllSender.
6. VoltAgent crea el agente de esa sucursal y expone únicamente tools permitidas.
7. Información empresarial dinámica se consulta; no se inventa.
8. Si requiere persona, `request_human` cambia ownership a `WAITING_HUMAN`.
9. El primer miembro autorizado que hace claim cambia ownership a `HUMAN` y se refleja en `ChatAssignment`.

## Tools

Un `BranchAgent` puede habilitar:

- `branch_info`
- `knowledge_search`
- `external_records`
- `external_api`
- `request_human`

`external_records` respeta binding de cliente para evitar que un agente consulte pedidos/tracking de otra persona.

## Desarrollo

```bash
npm install
npm run validate
```

GitHub Actions ejecuta syntax check, TypeScript y tests en cada push/PR.

## Estado

El repositorio contiene el dominio y runtime integrable del módulo. La recepción/envío de WhatsApp, Instagram y demás canales sigue siendo responsabilidad de AllSender; esto evita duplicar el stack omnicanal existente.

## Licencia

MIT


## Contrato Maestro y Especificación de Sistema

Este módulo cumple con el **Contrato Maestro de Agentes Conversacionales Multi-Tenant**:
- Secuencia obligatoria: Saludo → Detección de Intención → Recolección de Datos → **Resolución Obligatoria de Sucursal** → Asignación de Agente → Creación de Ticket → Handoff y Silencio.
- Memoria continua multi-turn (`activeAssignment` / `activeCase`).
- Base de conocimiento documental para políticas, tarifas y preguntas frecuentes (.md, .txt, .pdf).
- Guardrails deterministas en backend para evitar derivaciones o registros prematuros.

Consulta la especificación técnica completa y la hoja de ruta en [docs/master-contract.md](docs/master-contract.md).
