import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OmnichannelBranch', default: null, index: true },
  scope: { type: String, enum: ['workspace', 'branch'], default: 'branch' },
  type: { type: String, enum: ['text', 'faq', 'url', 'document', 'policy', 'terms', 'service', 'product'], default: 'text' },
  title: { type: String, required: true, trim: true },
  language: { type: String, default: null },
  country: { type: String, default: null },
  version: { type: String, default: null },
  effective_date: { type: Date, default: null },
  content: { type: String, default: '' },
  source_url: { type: String, default: null },
  external_ref: { type: String, default: null },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  deleted_at: { type: Date, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'omnichannel_branch_knowledge' });

schema.index({ workspace_id: 1, branch_id: 1, status: 1, deleted_at: 1 });
schema.index({ title: 'text', content: 'text' });

export default mongoose.models.OmnichannelBranchKnowledge || mongoose.model('OmnichannelBranchKnowledge', schema);
