import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OmnichannelBranch', required: true, index: true },
  conversation_key: { type: String, required: true, index: true },
  language: { type: String, default: null },
  reason: { type: String, default: 'customer_request' },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  summary: { type: String, default: '' },
  channel_context: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['waiting', 'claimed', 'cancelled', 'closed'], default: 'waiting', index: true },
  claimed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  claimed_at: { type: Date, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'omnichannel_branch_handoffs' });

schema.index({ workspace_id: 1, branch_id: 1, status: 1, created_at: 1 });

export default mongoose.models.OmnichannelBranchHandoff || mongoose.model('OmnichannelBranchHandoff', schema);
