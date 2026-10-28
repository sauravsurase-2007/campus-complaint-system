'use strict';
const { HttpError } = require('./errors');

const ADMIN_GROUP = process.env.ADMIN_GROUP || 'Admins';

// API Gateway has already verified the Cognito ID token signature, issuer, audience and expiry.
// Here we only read the verified claims and derive the role from the Cognito group.
function parseGroups(raw) {
  if (Array.isArray(raw)) return raw;
  return String(raw || '')
    .replace(/^\[|\]$/g, '')
    .split(/[,\s]+/)
    .filter(Boolean);
}

function getUser(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims || !claims.sub) throw new HttpError(401, 'Unauthorized');
  if (claims.token_use !== 'id') throw new HttpError(401, 'Send the Cognito ID token');
  const groups = parseGroups(claims['cognito:groups']);
  return {
    id: claims.sub,
    email: claims.email,
    name: claims.name || claims.email,
    role: groups.includes(ADMIN_GROUP) ? 'admin' : 'student',
  };
}

function requireRole(user, role) {
  if (user.role !== role) throw new HttpError(403, 'You are not allowed to perform this action');
}

module.exports = { getUser, requireRole };
