import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OmnichannelBranch', required: true, index: true },
  name: { type: String, required: true },
  prefix: { type: String, required: true, index: true },
  key_hash: { type: String, required: true, unique: true },
  scopes: { type: [String], default: ['branch.read'] },
  expires_at: { type: Date, default: null },
  last_used_at: { type: Date, default: null },
  revoked_at: { type: Date, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'omnichannel_branch_api_keys' });

schema.index({ workspace_id: 1, branch_id: 1, revoked_at: 1 });

export default mongoose.models.OmnichannelBranchApiKey || mongoose.model('OmnichannelBranchApiKey', schema);
