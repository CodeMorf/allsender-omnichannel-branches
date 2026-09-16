import mongoose from 'mongoose';
import { createIntegrationSecretCodec } from './secretCodec.js';

const toObjectId = (value) => mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
const currentOwnerId = (req) => req.user?.owner_id || req.user?._id || req.user?.id;

export function createAllSenderBranchesHostAdapter({ models, encryptIntegrationSecret, resolveIntegrationSecret, integrationEncryptionKey } = {}) {
  const { Workspace, User, UserSetting, AIModel, ChatAssignment } = models || {};
  if (!Workspace || !User || !UserSetting || !AIModel || !ChatAssignment) throw new Error('AllSender branches adapter requires Workspace, User, UserSetting, AIModel and ChatAssignment models');
  const codec = createIntegrationSecretCodec(integrationEncryptionKey);
  const encryptSecret = encryptIntegrationSecret || (codec.available ? codec.encrypt : null);
  const decryptSecret = resolveIntegrationSecret || (codec.available ? codec.decrypt : null);

  const resolveWorkspaceId = async (req) => {
    const workspaceId = toObjectId(req.headers?.['x-workspace-id']);
    const ownerId = toObjectId(currentOwnerId(req));
    if (!workspaceId || !ownerId) return null;
    const workspace = await Workspace.findOne({ _id: workspaceId, user_id: ownerId, deleted_at: null, is_active: { $ne: false } }).select('_id').lean();
    return workspace?._id || null;
  };
  const getOwnerId = async (workspaceId) => {
    const workspace = await Workspace.findOne({ _id: toObjectId(workspaceId), deleted_at: null, is_active: { $ne: false } }).select('user_id').lean();
    if (!workspace?.user_id) throw new Error('Workspace owner context is required');
    return workspace.user_id;
  };
  const validateUser = async ({ workspaceId, userId }) => {
    const ownerId = await getOwnerId(workspaceId);
    const user = await User.findOne({ _id: toObjectId(userId), created_by: ownerId, deleted_at: null, status: { $ne: false } }).select('_id').lean();
    if (!user) throw new Error('Agent is not available in this workspace');
    return user;
  };
  const resolveCustomerAI = async ({ workspaceId, modelId = null }) => {
    const ownerId = await getOwnerId(workspaceId);
    const settings = await UserSetting.findOne({ user_id: ownerId }).select('ai_model api_key').lean();
    const selectedModelId = modelId || settings?.ai_model;
    if (!selectedModelId) throw new Error('Select an AI model in AllSender settings before enabling the branch agent');
    if (!settings?.api_key) throw new Error('Add the customer AI API key in AllSender settings before enabling the branch agent');
    const model = await AIModel.findOne({ _id: toObjectId(selectedModelId), status: 'active', deleted_at: null }).lean();
    if (!model) throw new Error('The configured AI model is not available');
    return { model, apiKey: settings.api_key };
  };
  const assignExistingChat = async ({ workspaceId, userId, channelContext = {} }) => {
    await validateUser({ workspaceId, userId });
    const ownerId = await getOwnerId(workspaceId);
    const { sender_number, receiver_number, whatsapp_phone_number_id } = channelContext;
    if (!sender_number || !receiver_number || !whatsapp_phone_number_id) return { assigned: false, reason: 'channel_assignment_context_missing' };
    const assignment = await ChatAssignment.findOneAndUpdate(
      { sender_number, receiver_number, whatsapp_phone_number_id },
      { $set: { agent_id: userId, assigned_by: ownerId, status: 'assigned', is_solved: false, chatbot_id: null, chatbot_expires_at: null } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    return { assigned: true, assignment };
  };
  const encodeIntegrationSecret = async (plainText) => {
    if (!plainText) return null;
    if (!encryptSecret) throw new Error('Configure integration encryption before saving credentials');
    return encryptSecret(plainText);
  };
  const resolveIntegrationAuth = async (integration) => {
    if (integration.auth_type === 'none') return { headers: {} };
    if (!decryptSecret || !integration.encrypted_secret) throw new Error('Integration credentials are unavailable');
    const secret = await decryptSecret(integration.encrypted_secret, integration);
    switch (integration.auth_type) {
      case 'bearer': return { headers: { Authorization: `Bearer ${secret}` } };
      case 'api_key': return { headers: { [integration.auth_meta?.header || 'X-API-Key']: secret } };
      case 'basic': return { headers: { Authorization: `Basic ${secret}` } };
      default: return { headers: {} };
    }
  };
  return { resolveWorkspaceId, getOwnerId, validateUser, resolveCustomerAI, assignExistingChat, encodeIntegrationSecret, resolveIntegrationAuth };
}
