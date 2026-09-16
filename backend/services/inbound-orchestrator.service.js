export class BranchInboundOrchestrator {
  constructor({ resolver, agentRuntime, conversationControl }) {
    this.resolver = resolver;
    this.agentRuntime = agentRuntime;
    this.conversationControl = conversationControl;
  }

  async process({ workspaceId, conversationKey, channelType, connectionId, message, messageId = null, location = null, language = null, legacyHandled = false, channelContext = {}, metadata = {} }) {
    const inboundId = messageId || metadata?.message_id || metadata?.messageId || channelContext?.message_id || channelContext?.messageId || null;
    const mark = await this.conversationControl.markInbound({ workspaceId, conversationKey, messageId: inboundId });
    if (!mark.accepted) return { handled: true, duplicate: true, reason: 'duplicate_inbound_message' };

    const resolution = await this.resolver.resolve({ workspaceId, conversationKey, channelType, connectionId, location, text: message });
    const branch = resolution.branch;
    if (!branch) return { handled: false, resolution };

    const policy = branch.response_policy || 'legacy_first';
    if (policy === 'legacy_only' || policy === 'human_only') return { handled: false, resolution, reason: policy };
    if (policy === 'legacy_first' && legacyHandled) return { handled: true, resolution, reason: 'legacy_handled' };

    const input = String(message || '').trim() || (location ? 'The customer shared their current location.' : 'The customer sent a message.');
    const response = await this.agentRuntime.respond({ workspaceId, branchId: branch._id, conversationKey, message: input, language, channelContext, metadata });
    return { handled: Boolean(response.sent || response.blocked || response.handoff_pending), resolution, response };
  }
}
