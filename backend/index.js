import Branch from './models/branch.model.js';
import Membership from './models/branch-membership.model.js';
import BranchAgent from './models/branch-agent.model.js';
import Knowledge from './models/branch-knowledge.model.js';
import Integration from './models/branch-integration.model.js';
import ConversationState from './models/branch-conversation-state.model.js';
import Handoff from './models/branch-handoff.model.js';
import BranchApiKey from './models/branch-api-key.model.js';
import ExternalRecord from './models/branch-external-record.model.js';
import geoService from './services/geo.service.js';
import { BranchService } from './services/branch.service.js';
import { BranchResolverService } from './services/branch-resolver.service.js';
import { ConversationControlService } from './services/conversation-control.service.js';
import { BranchIntegrationService } from './services/integration.service.js';
import { BranchHandoffService } from './services/handoff.service.js';
import { BranchApiKeyService } from './services/api-key.service.js';
import { BranchExternalRecordService } from './services/external-record.service.js';
import { BranchAgentRuntime } from './services/agent-runtime.service.js';
import { BranchInboundOrchestrator } from './services/inbound-orchestrator.service.js';
import openApiImportService from './services/openapi.service.js';
import { createBranchRouter } from './routes/branch.routes.js';
import { createBranchPublicRouter } from './routes/branch-public.routes.js';

export function createBranchesModule({ host }) {
  if (!host?.resolveWorkspaceId) throw new Error('Branches module requires a host adapter');
  const models = { Branch, Membership, BranchAgent, Knowledge, Integration, ConversationState, Handoff, BranchApiKey, ExternalRecord };
  const branchService = new BranchService({ Branch, Membership, BranchAgent, Knowledge, Integration, BranchApiKey, host });
  const conversationControl = new ConversationControlService({ ConversationState });
  const resolver = new BranchResolverService({ Branch, ConversationState, geoService });
  const integrationService = new BranchIntegrationService({ Integration, host });
  const handoffService = new BranchHandoffService({ Handoff, Membership, ConversationState, host });
  const apiKeyService = new BranchApiKeyService({ BranchApiKey });
  const externalRecordService = new BranchExternalRecordService({ ExternalRecord });
  const agentRuntime = new BranchAgentRuntime({ models, host, conversationControl, handoffService, integrationService, externalRecordService });
  const inboundOrchestrator = new BranchInboundOrchestrator({ resolver, agentRuntime, conversationControl });
  const workspaceMiddleware = async (req, res, next) => {
    try { const workspaceId = await host.resolveWorkspaceId(req); if (!workspaceId) return res.status(403).json({ success: false, message: 'Selecciona un espacio de trabajo válido.' }); req.branchWorkspaceId = workspaceId; return next(); }
    catch (error) { console.error('[branches:workspace]', error); return res.status(403).json({ success: false, message: 'No se pudo validar el espacio de trabajo.' }); }
  };
  const router = createBranchRouter({ branchService, resolver, agentRuntime, handoffService, apiKeyService, externalRecordService, openApiImportService, host });
  const publicRouter = createBranchPublicRouter({ apiKeyService, externalRecordService, Branch, Knowledge });
  return { models, services: { branchService, geoService, resolver, conversationControl, integrationService, handoffService, apiKeyService, externalRecordService, agentRuntime, inboundOrchestrator, openApiImportService }, workspaceMiddleware, router, publicRouter };
}

export { Branch, Membership as BranchMembership, BranchAgent, Knowledge as BranchKnowledge, Integration as BranchIntegration, ConversationState as BranchConversationState, Handoff as BranchHandoff, BranchApiKey, ExternalRecord as BranchExternalRecord };
