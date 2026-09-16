# Integración con AllSender Omnichannel

El módulo se diseñó como paquete host-adapter: usa la autenticación, Workspace, usuarios, modelos de IA, API key de IA, ChatAssignment y canales que ya existen en AllSender.

## Requisitos del host

El host debe entregar estos modelos existentes al registrar el módulo:

- `Workspace`
- `User`
- `UserSetting`
- `AIModel`
- `ChatAssignment`

`UserSetting.ai_model` y `UserSetting.api_key` continúan siendo la fuente de verdad para el proveedor/modelo y la key que configura cada cliente. El módulo de sucursales no guarda una segunda key de IA.

## Registro en Express

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

La aplicación monta:

- `/api/branches`: administración autenticada y aislada por `x-workspace-id`.
- `/api/branch-data`: API machine-to-machine autenticada con una Branch API Key.

## Cifrado de credenciales externas

Configura una clave privada solo en backend:

```env
ALLSENDER_BRANCHES_ENCRYPTION_KEY=un-secreto-largo-y-aleatorio
```

Las credenciales de ERP, tracking o sistemas externos se cifran con AES-256-GCM. Nunca se envían al frontend ni al modelo de IA.

## Integración con mensajes entrantes

El host conserva la recepción de WhatsApp/Instagram/Web Chat. Después de normalizar un mensaje, puede usar los servicios del módulo:

```js
const resolution = await branchesModule.services.resolver.resolve({
  workspaceId,
  conversationKey,
  channelType: 'whatsapp',
  connectionId: phoneNumberId,
  location: whatsappLocation,
  text: messageText
});

if (resolution.branch) {
  const reply = await branchesModule.services.agentRuntime.respond({
    workspaceId,
    branchId: resolution.branch._id,
    conversationKey,
    message: messageText,
    language,
    channelContext: {
      sender_number,
      receiver_number,
      whatsapp_phone_number_id: phoneNumberId
    },
    metadata: {
      contact_id: contactId,
      phone: sender_number,
      email: contactEmail
    }
  });

  if (reply.sent) {
    // Enviar reply.text utilizando el sender existente de AllSender.
  }
}
```

El `ConversationControlService` garantiza que AI, automatización legacy y humano no sean dueños activos simultáneamente. Para integrar completamente automatizaciones antiguas, los puntos de envío automáticos del host deben consultar/adquirir ownership antes de responder.

## Ubicación WhatsApp

Para un mensaje de tipo location pasa:

```js
{
  latitude: message.location.latitude,
  longitude: message.location.longitude
}
```

`BranchResolver` usa Turf.js para radio, distancia y polígonos GeoJSON. El resultado guarda `branch_id`, origen de resolución y confianza en el estado de conversación.

## Handoff humano

El tool `request_human` crea un handoff y cambia la conversación a `WAITING_HUMAN`. Los miembros de la sucursal pueden hacer claim. La operación es atómica: el primer agente que gana queda asignado y el adapter actualiza el `ChatAssignment` existente cuando recibe el contexto WhatsApp necesario.
