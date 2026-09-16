export class BranchHandoffService {
  constructor({ Handoff, Membership, ConversationState, host }) {
    this.Handoff = Handoff;
    this.Membership = Membership;
    this.ConversationState = ConversationState;
    this.host = host;
  }

  async request({ workspaceId, branchId, conversationKey, language, reason, summary, priority = 'normal', channelContext = {} }) {
    const handoff = await this.Handoff.create({ workspace_id: workspaceId, branch_id: branchId, conversation_key: conversationKey, language, reason, summary, priority, channel_context: channelContext, status: 'waiting' });
    await this.ConversationState.findOneAndUpdate(
      { workspace_id: workspaceId, conversation_key: conversationKey },
      { $set: { branch_id: branchId, responder_type: 'WAITING_HUMAN', responder_id: null, responder_since: new Date(), summary: summary || '' } },
      { upsert: true }
    );
    return handoff;
  }

  async queue({ workspaceId, branchId, language = null }) {
    const query = { workspace_id: workspaceId, branch_id: branchId, status: 'waiting' };
    const handoffs = await this.Handoff.find(query).sort({ created_at: 1 }).lean();
    if (!language) return handoffs;
    return handoffs.sort((a, b) => Number(b.language === language) - Number(a.language === language));
  }

  async claim({ workspaceId, handoffId, userId }) {
    const handoff = await this.Handoff.findOne({ _id: handoffId, workspace_id: workspaceId, status: 'waiting' }).lean();
    if (!handoff) return { claimed: false, reason: 'already_claimed_or_unavailable' };
    const membership = await this.Membership.findOne({ workspace_id: workspaceId, branch_id: handoff.branch_id, user_id: userId, status: 'active', deleted_at: null }).lean();
    if (!membership || membership.availability === 'offline') throw new Error('Agent is not available for this branch');

    const claimed = await this.Handoff.findOneAndUpdate(
      { _id: handoffId, workspace_id: workspaceId, status: 'waiting', claimed_by: null },
      { $set: { status: 'claimed', claimed_by: userId, claimed_at: new Date() } },
      { new: true }
    ).lean();
    if (!claimed) return { claimed: false, reason: 'already_claimed_or_unavailable' };

    await this.ConversationState.findOneAndUpdate(
      { workspace_id: workspaceId, conversation_key: claimed.conversation_key },
      { $set: { responder_type: 'HUMAN', responder_id: String(userId), responder_since: new Date() } }
    );
    await this.host.assignExistingChat?.({ workspaceId, userId, channelContext: claimed.channel_context });
    return { claimed: true, handoff: claimed };
  }
}
