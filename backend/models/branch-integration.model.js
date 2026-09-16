import mongoose from 'mongoose';

const operationSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true },
  method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
  path: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  read_only: { type: Boolean, default: true }
}, { _id: false });

const schema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OmnichannelBranch', required: true, index: true },
  name: { type: String, required: true },
  code: { type: String, required: true, trim: true, lowercase: true },
  base_url: { type: String, required: true },
  auth_type: { type: String, enum: ['none', 'api_key', 'bearer', 'basic', 'oauth'], default: 'none' },
  encrypted_secret: { type: String, default: null },
  auth_meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  default_headers: { type: mongoose.Schema.Types.Mixed, default: {} },
  operations: { type: [operationSchema], default: [] },
  timeout_ms: { type: Number, default: 10000, min: 1000, max: 60000 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  deleted_at: { type: Date, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'omnichannel_branch_integrations' });

schema.index({ workspace_id: 1, branch_id: 1, code: 1, deleted_at: 1 }, { unique: true });

export default mongoose.models.OmnichannelBranchIntegration || mongoose.model('OmnichannelBranchIntegration', schema);
