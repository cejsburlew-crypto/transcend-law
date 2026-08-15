/**
 * Deployment API Routes
 * Handles deployment request submissions and status tracking
 */

import type { Request, Response } from 'express';

interface DeploymentRequest {
  id: string;
  type: 'feature' | 'bugfix' | 'optimization' | 'docs';
  name: string;
  description: string;
  affected_pages: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'submitted' | 'in_progress' | 'testing' | 'staging' | 'production' | 'complete' | 'failed';
  created_at: string;
  completed_at?: string;
  git_branch: string;
  git_commit: string;
  test_results?: {
    passed: number;
    failed: number;
    coverage: number;
  };
  error_message?: string;
  requested_by: string;
}

// In-memory storage (replace with database in production)
const deployments: Map<string, DeploymentRequest> = new Map();

export async function submitDeploymentRequest(req: Request, res: Response) {
  try {
    const { type, name, description, affected_pages, priority } = req.body;

    // Validation
    if (!type || !name || !description || !affected_pages || !priority) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['feature', 'bugfix', 'optimization', 'docs'].includes(type)) {
      return res.status(400).json({ error: 'Invalid request type' });
    }

    if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    // Generate unique ID
    const id = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const gitBranch = `feature/${id}-${name.toLowerCase().replace(/\s+/g, '-')}`;

    const deployment: DeploymentRequest = {
      id,
      type,
      name,
      description,
      affected_pages: Array.isArray(affected_pages) ? affected_pages : [affected_pages],
      priority,
      status: 'submitted',
      created_at: new Date().toISOString(),
      git_branch: gitBranch,
      git_commit: '',
      requested_by: req.user?.email || 'unknown',
    };

    // Store deployment
    deployments.set(id, deployment);

    // Trigger GitHub Actions workflow
    await triggerGitHubWorkflow(deployment);

    res.json({
      id,
      status: 'submitted',
      message: 'Deployment request submitted successfully',
      git_branch: gitBranch,
    });
  } catch (error) {
    console.error('Deployment submission error:', error);
    res.status(500).json({ error: 'Failed to submit deployment request' });
  }
}

export async function getDeploymentStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Deployment ID required' });
    }

    const deployment = deployments.get(id);

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    res.json(deployment);
  } catch (error) {
    console.error('Get deployment status error:', error);
    res.status(500).json({ error: 'Failed to retrieve deployment status' });
  }
}

export async function getAllDeployments(req: Request, res: Response) {
  try {
    const allDeployments = Array.from(deployments.values());
    // Sort by created_at, newest first
    allDeployments.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    res.json(allDeployments);
  } catch (error) {
    console.error('Get all deployments error:', error);
    res.status(500).json({ error: 'Failed to retrieve deployments' });
  }
}

export async function updateDeploymentStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, test_results, error_message, git_commit } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Deployment ID required' });
    }

    const deployment = deployments.get(id);

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Update deployment
    deployment.status = status;
    if (test_results) deployment.test_results = test_results;
    if (error_message) deployment.error_message = error_message;
    if (git_commit) deployment.git_commit = git_commit;

    if (status === 'complete' || status === 'failed') {
      deployment.completed_at = new Date().toISOString();
    }

    deployments.set(id, deployment);

    res.json(deployment);
  } catch (error) {
    console.error('Update deployment status error:', error);
    res.status(500).json({ error: 'Failed to update deployment status' });
  }
}

async function triggerGitHubWorkflow(deployment: DeploymentRequest) {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO || 'yourusername/transcend-ssp';

    if (!githubToken) {
      console.warn('GITHUB_TOKEN not set, skipping workflow trigger');
      return;
    }

    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/actions/workflows/auto-deploy.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            request_id: deployment.id,
            request_type: deployment.type,
            feature_name: deployment.name,
            description: deployment.description,
            affected_pages: deployment.affected_pages.join(','),
            priority: deployment.priority,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Failed to trigger GitHub workflow:', response.statusText);
    }
  } catch (error) {
    console.error('Error triggering GitHub workflow:', error);
  }
}

// Export routes for Express server
export const deploymentRoutes = {
  'POST /api/admin/deployment-request': submitDeploymentRequest,
  'GET /api/admin/deployments/:id': getDeploymentStatus,
  'GET /api/admin/deployments': getAllDeployments,
  'PUT /api/admin/deployments/:id': updateDeploymentStatus,
};
