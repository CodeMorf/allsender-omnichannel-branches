import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OmnichannelBranch', required: true, index: true },
  type: { type: String, enum: ['order', 'tracking', 'customer', 'inventory', 'reservation', 'custom'], required: true, index: true },
  external_id: { type: String, required: true, trim: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  external_updated_at: { type: Date, default: null },
  source: { type: String, default: 'branch_api' },
  deleted_at: { type: Date, default: null, index: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'omnichannel_branch_external_records' });

schema.index({ workspace_id: 1, branch_id: 1, type: 1, external_id: 1, deleted_at: 1 }, { unique: true });
schema.index({ workspace_id: 1, branch_id: 1, type: 1, updated_at: -1 });

export default mongoose.models.OmnichannelBranchExternalRecord || mongoose.model('OmnichannelBranchExternalRecord', schema);
