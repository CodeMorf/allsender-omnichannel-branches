import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  conversation_key: { type: String, required: true, index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OmnichannelBranch', default: null, index: true },
  branch_resolution_source: { type: String, enum: ['existing', 'channel', 'location', 'keyword', 'history', 'ai', 'default', 'manual', 'unknown'], default: 'unknown' },
  branch_resolution_confidence: { type: Number, default: 0, min: 0, max: 1 },
  language: { type: String, default: null },
  responder_type: { type: String, enum: ['NONE', 'LEGACY_AUTOMATION', 'AI', 'WAITING_HUMAN', 'HUMAN'], default: 'NONE', index: true },
  responder_id: { type: String, default: null },
  responder_since: { type: Date, default: null },
  summary: { type: String, default: '' },
  recent_messages: { type: [{ role: String, content: String, at: Date }], default: [] },
  related_order: { type: String, default: null },
  related_tracking: { type: String, default: null },
  last_message_id: { type: String, default: null },
  last_outbound_fingerprint: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'omnichannel_branch_conversation_states' });

schema.index({ workspace_id: 1, conversation_key: 1 }, { unique: true });

export default mongoose.models.OmnichannelBranchConversationState || mongoose.model('OmnichannelBranchConversationState', schema);
