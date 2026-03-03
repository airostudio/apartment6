/**
 * /api/stripe-connect-save
 *
 * POST { accountId: string }
 *   Called automatically by the admin UI after Stripe onboarding redirects
 *   back with ?setup=complete&account=acct_xxx.
 *
 *   Steps:
 *   1. Validates accountId format.
 *   2. Verifies the account actually exists in Stripe.
 *   3. Saves to /tmp/stripe-config.json — activates immediately on this
 *      server instance (no redeploy needed).
 *   4. If VERCEL_TOKEN + VERCEL_PROJECT_ID are configured as environment
 *      variables, also sets STRIPE_CONNECTED_ACCOUNT_ID permanently via
 *      the Vercel Projects API.
 *   5. If VERCEL_DEPLOY_HOOK is set, triggers a redeployment so all future
 *      cold-start Lambda instances pick up the env var immediately.
 *   6. Clears the "pending account" state from /tmp.
 *
 *   Response 200:
 *     { saved, accountId, session, vercel, vercelDeployTriggered, permanent, message }
 *
 * DELETE (no body required)
 *   Disconnects by clearing the session config.
 *   Note: cannot remove an env var — instructions are returned instead.
 *
 *   Response 200: { cleared, hasEnvVar, message }
 */

const secretKey = process.env.STRIPE_SECRET_KEY;
const cfg       = require('./_shared-config');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── DELETE — disconnect ─────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    cfg.saveConnectedAccountId(null);
    cfg.savePendingAccountId(null);
    const hasEnvVar = !!process.env.STRIPE_CONNECTED_ACCOUNT_ID;
    return res.status(200).json({
      cleared:   true,
      hasEnvVar,
      message: hasEnvVar
        ? 'Session config cleared. To permanently disconnect, remove STRIPE_CONNECTED_ACCOUNT_ID from your environment variables and redeploy.'
        : 'Disconnected.',
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Validate input ──────────────────────────────────────────────────────
  const { accountId } = req.body || {};
  if (!accountId || typeof accountId !== 'string' || !accountId.startsWith('acct_')) {
    return res.status(400).json({ error: 'accountId must be a Stripe connected account ID (acct_…)' });
  }

  // ── Verify the account exists in Stripe ────────────────────────────────
  if (secretKey && !secretKey.startsWith('pk_')) {
    try {
      const stripe  = require('stripe')(secretKey);
      const account = await stripe.accounts.retrieve(accountId);
      if (account.id !== accountId) throw new Error('Account ID mismatch');
    } catch (err) {
      return res.status(400).json({ error: 'Cannot verify Stripe account: ' + err.message });
    }
  }

  // ── Save to session (/tmp) ──────────────────────────────────────────────
  const session = cfg.saveConnectedAccountId(accountId);
  cfg.savePendingAccountId(null); // clear in-progress onboarding state

  // ── Vercel API — try to save permanently ───────────────────────────────
  let vercel                = false;
  let vercelDeployTriggered = false;

  const vercelToken     = process.env.VERCEL_TOKEN;
  const vercelProjectId = process.env.VERCEL_PROJECT_ID;
  const vercelTeamId    = process.env.VERCEL_TEAM_ID;

  if (vercelToken && vercelProjectId) {
    try {
      const qs = vercelTeamId ? `?teamId=${encodeURIComponent(vercelTeamId)}` : '';

      // List existing env vars to decide create vs patch
      const listRes  = await fetch(
        `https://api.vercel.com/v9/projects/${encodeURIComponent(vercelProjectId)}/env${qs}`,
        { headers: { Authorization: `Bearer ${vercelToken}` } }
      );
      const listData = await listRes.json();
      const existingEnv = Array.isArray(listData.envs)
        ? listData.envs.find(e => e.key === 'STRIPE_CONNECTED_ACCOUNT_ID')
        : null;

      const envPayload = JSON.stringify({
        key:    'STRIPE_CONNECTED_ACCOUNT_ID',
        value:  accountId,
        target: ['production', 'preview', 'development'],
        type:   'encrypted',
      });

      if (existingEnv?.id) {
        await fetch(
          `https://api.vercel.com/v9/projects/${encodeURIComponent(vercelProjectId)}/env/${existingEnv.id}${qs}`,
          { method: 'PATCH', headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' }, body: envPayload }
        );
      } else {
        await fetch(
          `https://api.vercel.com/v10/projects/${encodeURIComponent(vercelProjectId)}/env${qs}`,
          { method: 'POST', headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' }, body: envPayload }
        );
      }
      vercel = true;

      // Trigger a redeployment if a deploy hook is configured
      const deployHook = process.env.VERCEL_DEPLOY_HOOK;
      if (deployHook) {
        const hookRes         = await fetch(deployHook, { method: 'POST' });
        vercelDeployTriggered = hookRes.ok;
      }
    } catch (vercelErr) {
      console.warn('stripe-connect-save: Vercel API error:', vercelErr.message);
    }
  }

  const permanent = vercel || !!process.env.STRIPE_CONNECTED_ACCOUNT_ID;

  let message;
  if (vercel) {
    message = vercelDeployTriggered
      ? 'Permanently saved via Vercel API — redeployment triggered. Payments will be active within a minute.'
      : 'Saved to Vercel environment variables. Redeploy your project (or add VERCEL_DEPLOY_HOOK) to activate permanently across all instances.';
  } else if (process.env.STRIPE_CONNECTED_ACCOUNT_ID) {
    message = 'Already permanently set via STRIPE_CONNECTED_ACCOUNT_ID environment variable.';
  } else {
    message = 'Activated for this server session. Add STRIPE_CONNECTED_ACCOUNT_ID to your environment variables for permanent activation across all instances.';
  }

  return res.status(200).json({
    saved:                true,
    accountId,
    session,
    vercel,
    vercelDeployTriggered,
    permanent,
    message,
  });
};
