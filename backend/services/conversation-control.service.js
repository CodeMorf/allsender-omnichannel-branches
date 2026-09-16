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

  async canRespond({ workspaceId, conversationKey, responderType }) {
    const state = await this.getOrCreate({ workspaceId, conversationKey });
    if (state.responder_type === responderType) return true;
    if (state.responder_type === 'NONE') return true;
    return false;
  }

  async acquire({ workspaceId, conversationKey, responderType, responderId = null }) {
    await this.getOrCreate({ workspaceId, conversationKey });
    return this.ConversationState.findOneAndUpdate(
      {
        workspace_id: workspaceId,
        conversation_key: conversationKey,
        responder_type: { $in: ['NONE', responderType] }
      },
      {
        $set: {
          responder_type: responderType,
          responder_id: responderId ? String(responderId) : null,
          responder_since: new Date()
        }
      },
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
      $set: { responder_type: 'NONE', responder_id: null, responder_since: null }
    }, { new: true });
  }
}
