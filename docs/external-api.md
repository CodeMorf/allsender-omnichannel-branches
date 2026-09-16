# API externa por sucursal

Cada sucursal puede crear credenciales independientes de la API key usada por el proveedor de IA. Las Branch API Keys se guardan únicamente como hash SHA-256 y la clave completa se devuelve una sola vez al crearla.

## Autenticación

Usa uno de estos headers:

```http
Authorization: Bearer asb_xxxxx.secret
```

```http
X-Branch-API-Key: asb_xxxxx.secret
```

## Scopes

- `branch.read`
- `branch.orders.read`
- `branch.orders.write`
- `branch.tracking.read`
- `branch.tracking.write`
- `branch.data.read`
- `branch.data.write`
- `branch.knowledge.read`
- `branch.knowledge.write`

## Perfil

`GET /api/branch-data/profile`

## Sincronizar un pedido

`PUT /api/branch-data/records/order/ORDER-2042`

```json
{
  "customer_refs": {
    "contact_id": "CONTACT_ID",
    "phone": "+393330000000",
    "email": "cliente@example.com"
  },
  "payload": {
    "status": "paid",
    "total": 89.50,
    "currency": "EUR"
  }
}
```

Por defecto los registros son `customer_bound`: el tool autónomo solo entrega el dato al agente IA si las referencias coinciden con el cliente actual. Usa `"access_mode": "public"` únicamente para información que realmente pueda consultar cualquier usuario.

## Tracking

`PUT /api/branch-data/records/tracking/TRK-10020`

```json
{
  "customer_refs": { "phone": "+393330000000" },
  "payload": {
    "status": "in_transit",
    "last_location": "Roma",
    "estimated_delivery": "2026-09-18"
  }
}
```

## Knowledge / entrenamiento

`POST /api/branch-data/knowledge`

O para sincronización idempotente:

`PUT /api/branch-data/knowledge/returns-it-v3`

```json
{
  "type": "policy",
  "title": "Politica resi Italia",
  "language": "it",
  "version": "3",
  "content": "..."
}
```

El agente puede recuperar este contenido mediante `knowledge_search`.
