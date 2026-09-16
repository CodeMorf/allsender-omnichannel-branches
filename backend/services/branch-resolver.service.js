const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

export class BranchResolverService {
  constructor({ Branch, ConversationState, geoService }) {
    this.Branch = Branch;
    this.ConversationState = ConversationState;
    this.geoService = geoService;
  }

  async persist({ workspaceId, conversationKey, branch, source, confidence }) {
    if (!conversationKey) return branch;
    await this.ConversationState.findOneAndUpdate(
      { workspace_id: workspaceId, conversation_key: conversationKey },
      {
        $set: {
          branch_id: branch?._id || null,
          branch_resolution_source: source,
          branch_resolution_confidence: confidence
        },
        $setOnInsert: { workspace_id: workspaceId, conversation_key: conversationKey }
      },
      { upsert: true }
    );
    return branch;
  }

  async resolve({ workspaceId, conversationKey, channelType, connectionId, location, text, force = false }) {
    if (!force && conversationKey) {
      const state = await this.ConversationState.findOne({ workspace_id: workspaceId, conversation_key: conversationKey }).lean();
      if (state?.branch_id) {
        const existing = await this.Branch.findOne({ _id: state.branch_id, workspace_id: workspaceId, status: 'active', deleted_at: null }).lean();
        if (existing) return { branch: existing, source: 'existing', confidence: 1 };
      }
    }

    const activeQuery = { workspace_id: workspaceId, status: 'active', deleted_at: null };

    if (channelType && connectionId) {
      const branch = await this.Branch.findOne({
        ...activeQuery,
        channel_bindings: { $elemMatch: { channel_type: String(channelType).toLowerCase(), connection_id: String(connectionId) } }
      }).lean();
      if (branch) {
        await this.persist({ workspaceId, conversationKey, branch, source: 'channel', confidence: 1 });
        return { branch, source: 'channel', confidence: 1 };
      }
    }

    const branches = await this.Branch.find(activeQuery).sort({ sort_order: 1, name: 1 }).lean();

    if (location && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))) {
      const match = this.geoService.findBestBranch(branches, location);
      if (match?.branch) {
        const confidence = match.inside ? 1 : Math.max(0.55, 0.95 - Math.min(match.distance_km, 100) / 250);
        await this.persist({ workspaceId, conversationKey, branch: match.branch, source: 'location', confidence });
        return { branch: match.branch, source: 'location', confidence, distance_km: match.distance_km, inside_coverage: match.inside };
      }
    }

    const normalizedText = normalize(text);
    if (normalizedText) {
      const candidates = branches
        .map((branch) => ({
          branch,
          terms: [branch.name, branch.code, branch.address?.city, ...(branch.aliases || [])].filter(Boolean).map(normalize)
        }))
        .filter(({ terms }) => terms.some((term) => term.length >= 2 && normalizedText.includes(term)))
        .sort((a, b) => Math.max(...b.terms.map((x) => x.length)) - Math.max(...a.terms.map((x) => x.length)));
      if (candidates[0]) {
        const branch = candidates[0].branch;
        await this.persist({ workspaceId, conversationKey, branch, source: 'keyword', confidence: 0.9 });
        return { branch, source: 'keyword', confidence: 0.9 };
      }
    }

    const fallback = branches.find((branch) => branch.is_default);
    if (fallback) {
      await this.persist({ workspaceId, conversationKey, branch: fallback, source: 'default', confidence: 0.5 });
      return { branch: fallback, source: 'default', confidence: 0.5 };
    }

    return { branch: null, source: 'unknown', confidence: 0, needs_user_selection: branches.length > 1, choices: branches.map(({ _id, name, address }) => ({ id: _id, name, city: address?.city || '' })) };
  }
}
