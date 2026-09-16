import crypto from 'node:crypto';

const DEFAULT_LOCK_MS = 120000;

export class ConversationControlService {
  constructor({ ConversationState }) {
    this.ConversationState = ConversationState;
  }

  async getOrCreate({ workspaceId, conversationKey }) {
    return this.ConversationState.findOneAndUpdate(
      { workspace_id: workspaceId, conversation_key: conversationKey },
      { $setOnInsert: { workspace_id: workspaceId, conversation_key: conversationKey, responder_type: 'NONE' } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  async markInbound({ workspaceId, conversationKey, messageId }) {
    const state = await this.getOrCreate({ workspaceId, conversationKey });
    if (!messageId) return { accepted: true, state };
    const normalizedMessageId = String(messageId);
    const updated = await this.ConversationState.findOneAndUpdate(
      {
        workspace_id: workspaceId,
        conversation_key: conversationKey,
        $or: [
          { last_message_id: { $exists: false } },
          { last_message_id: null },
          { last_message_id: { $ne: normalizedMessageId } }
        ]
      },
      { $set: { last_message_id: normalizedMessageId } },
      { new: true }
    );
    return { accepted: Boolean(updated), state: updated || state };
  }

  async canRespond({ workspaceId, conversationKey, responderType }) {
    const state = await this.getOrCreate({ workspaceId, conversationKey });
    if (state.responder_type === responderType) return true;
    if (state.responder_type === 'NONE') return true;
    return false;
  }

  async acquire({ workspaceId, conversationKey, responderType, responderId = null, lockMs = DEFAULT_LOCK_MS }) {
    await this.getOrCreate({ workspaceId, conversationKey });
    const now = new Date();
    const lockToken = crypto.randomUUID();
    const processingLockUntil = new Date(now.getTime() + Math.max(Number(lockMs) || DEFAULT_LOCK_MS, 10000));
    const state = await this.ConversationState.findOneAndUpdate(
      {
        workspace_id: workspaceId,
        conversation_key: conversationKey,
        responder_type: { $in: ['NONE', responderType] },
        $or: [
          { processing_lock_until: { $exists: false } },
          { processing_lock_until: null },
          { processing_lock_until: { $lte: now } }
        ]
      },
      {
        $set: {
          responder_type: responderType,
          responder_id: responderId ? String(responderId) : null,
          responder_since: now,
          processing_lock_token: lockToken,
          processing_lock_until: processingLockUntil
        }
      },
      { new: true }
    );
    return state ? { state, lockToken } : null;
  }

  async releaseProcessing({ workspaceId, conversationKey, lockToken }) {
    if (!lockToken) return null;
    return this.ConversationState.findOneAndUpdate(
      { workspace_id: workspaceId, conversation_key: conversationKey, processing_lock_token: lockToken },
      { $set: { processing_lock_token: null, processing_lock_until: null } },
      { new: true }
    );
  }

  async transfer({ workspaceId, conversationKey, toType, responderId = null }) {
    await this.getOrCreate({ workspaceId, conversationKey });
    return this.ConversationState.findOneAndUpdate(
      { workspace_id: workspaceId, conversation_key: conversationKey },
      { $set: { responder_type: toType, responder_id: responderId ? String(responderId) : null, responder_since: new Date() } },
      { new: true }
    );
  }

  async release({ workspaceId, conversationKey, expectedType = null }) {
    const query = { workspace_id: workspaceId, conversation_key: conversationKey };
    if (expectedType) query.responder_type = expectedType;
    return this.ConversationState.findOneAndUpdate(query, {
      $set: {
        responder_type: 'NONE',
        responder_id: null,
        responder_since: null,
        processing_lock_token: null,
        processing_lock_until: null
      }
    }, { new: true });
  }
}
