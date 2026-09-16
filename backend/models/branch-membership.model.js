import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OmnichannelBranch', required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['agent', 'supervisor', 'manager'], default: 'agent' },
  languages: { type: [String], default: [] },
  max_conversations: { type: Number, default: null, min: 1 },
  availability: { type: String, enum: ['available', 'busy', 'away', 'offline'], default: 'available' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  deleted_at: { type: Date, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'omnichannel_branch_memberships' });

schema.index({ workspace_id: 1, branch_id: 1, user_id: 1, deleted_at: 1 }, { unique: true });
schema.index({ workspace_id: 1, branch_id: 1, availability: 1, status: 1 });

export default mongoose.models.OmnichannelBranchMembership || mongoose.model('OmnichannelBranchMembership', schema);
