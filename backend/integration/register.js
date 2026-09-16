import { createBranchesModule } from '../index.js';
import { createAllSenderBranchesHostAdapter } from './allSenderHostAdapter.js';

export function registerAllSenderBranches({ app, models, authenticate, resolveIntegrationSecret, basePath = '/api/branches' }) {
  if (!app) throw new Error('Express app is required');
  const host = createAllSenderBranchesHostAdapter({ models, resolveIntegrationSecret });
  const module = createBranchesModule({ host });
  const middleware = authenticate ? [authenticate, module.workspaceMiddleware] : [module.workspaceMiddleware];
  app.use(basePath, ...middleware, module.router);
  return module;
}
