import mongoose from 'mongoose';

const channelBindingSchema = new mongoose.Schema({
  channel_type: { type: String, required: true, trim: true, lowercase: true },
  connection_id: { type: String, required: true, trim: true }
}, { _id: false });

const branchSchema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, default: '', trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  is_default: { type: Boolean, default: false },
  address: {
    country: { type: String, default: '' },
    region: { type: String, default: '' },
    city: { type: String, default: '' },
    postal_code: { type: String, default: '' },
    address_line: { type: String, default: '' }
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }
  },
  timezone: { type: String, default: 'UTC' },
  languages: { type: [String], default: [] },
  default_language: { type: String, default: null },
  aliases: { type: [String], default: [] },
  phone: { type: String, default: null },
  email: { type: String, default: null },
  manager_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  coverage_mode: { type: String, enum: ['none', 'radius', 'polygon'], default: 'none' },
  coverage_radius_km: { type: Number, default: null, min: 0 },
  coverage_polygon: { type: mongoose.Schema.Types.Mixed, default: null },
  channel_bindings: { type: [channelBindingSchema], default: [] },
  assignment_mode: { type: String, enum: ['manual', 'first_claim', 'round_robin', 'least_load'], default: 'first_claim' },
  business_hours_mode: { type: String, enum: ['inherit', 'custom'], default: 'inherit' },
  business_hours_id: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkingHours', default: null },
  sort_order: { type: Number, default: 0 },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deleted_at: { type: Date, default: null, index: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'omnichannel_branches' });

branchSchema.index({ workspace_id: 1, code: 1, deleted_at: 1 }, { unique: true });
branchSchema.index({ workspace_id: 1, status: 1, deleted_at: 1 });
branchSchema.index({ location: '2dsphere' }, { sparse: true });
branchSchema.index({ workspace_id: 1, 'channel_bindings.channel_type': 1, 'channel_bindings.connection_id': 1 });

export default mongoose.models.OmnichannelBranch || mongoose.model('OmnichannelBranch', branchSchema);
