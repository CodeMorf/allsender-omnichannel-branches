import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OmnichannelBranch', required: true, index: true },
  name: { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  priority: { type: Number, default: 100 },
  mode: { type: String, enum: ['autonomous', 'copilot'], default: 'autonomous' },
  languages: { type: [String], default: [] },
  instructions: { type: String, default: '' },
  ai_model_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AIModel', default: null },
  allowed_tools: { type: [String], default: ['branch_info', 'knowledge_search', 'external_records', 'request_human'] },
  max_steps: { type: Number, default: 8, min: 1, max: 25 },
  handoff_enabled: { type: Boolean, default: true },
  handoff_message: { type: String, default: 'Voy a comunicarte con una persona de esta sucursal.' },
  deleted_at: { type: Date, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'omnichannel_branch_agents' });

schema.index({ workspace_id: 1, branch_id: 1, status: 1, priority: 1 });

export default mongoose.models.OmnichannelBranchAgent || mongoose.model('OmnichannelBranchAgent', schema);
