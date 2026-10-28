'use strict';
const { randomUUID } = require('crypto');
const { HttpError } = require('./errors');
const { getUser, requireRole } = require('./auth');
const { validateCreate, validateUpdate } = require('./validate');
const db = require('./db');
const notify = require('./notify');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    const b = JSON.parse(raw);
    if (b === null || typeof b !== 'object' || Array.isArray(b)) throw new Error();
    return b;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}

async function createComplaint(event, user) {
  requireRole(user, 'student');
  const data = validateCreate(parseBody(event));
  const now = new Date().toISOString();
  const item = {
    complaintId: randomUUID(),
    userId: user.id,          // always taken from the verified token, never from the request body
    userEmail: user.email,
    userName: user.name,
    ...data,
    status: 'Pending',
    adminRemark: '',
    createdAt: now,
    updatedAt: now,
    history: [{ status: 'Pending', remark: 'Complaint submitted', by: user.name, at: now }],
  };
  await db.createComplaint(item);
  await Promise.all([notify.notifyAdminNewComplaint(item), notify.subscribeStudent(user.email)]);
  return json(201, item);
}

async function listComplaints(event, user) {
  if (user.role === 'admin') {
    const status = event.queryStringParameters?.status;
    return json(200, { items: await db.listAll(status) });
  }
  return json(200, { items: await db.listByUser(user.id) });
}

async function getComplaint(event, user) {
  const item = await db.getComplaint(event.pathParameters.id);
  // Students asking for someone else's complaint get 404 (don't reveal that it exists).
  if (!item || (user.role !== 'admin' && item.userId !== user.id)) throw new HttpError(404, 'Complaint not found');
  return json(200, item);
}

async function updateComplaint(event, user) {
  requireRole(user, 'admin');
  const id = event.pathParameters.id;
  const patch = validateUpdate(parseBody(event));
  const old = await db.getComplaint(id);
  if (!old) throw new HttpError(404, 'Complaint not found');

  const status = patch.status ?? old.status;
  const adminRemark = patch.adminRemark ?? old.adminRemark;
  if (status === old.status && adminRemark === old.adminRemark) throw new HttpError(400, 'No changes to save');
  if (status === 'Rejected' && !adminRemark) throw new HttpError(400, 'Please add a remark explaining the rejection');

  const entry = { status, remark: adminRemark, by: user.name, at: new Date().toISOString() };
  let updated;
  try {
    updated = await db.updateComplaint(id, { status, adminRemark }, entry);
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') throw new HttpError(404, 'Complaint not found');
    throw e;
  }
  await notify.notifyStudentUpdate(updated);
  return json(200, updated);
}

const routes = {
  'POST /complaints': createComplaint,
  'GET /complaints': listComplaints,
  'GET /complaints/{id}': getComplaint,
  'PUT /complaints/{id}': updateComplaint,
};

exports.handler = async (event) => {
  try {
    const user = getUser(event);
    const route = routes[event.routeKey];
    if (!route) throw new HttpError(404, 'Not found');
    return await route(event, user);
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { message: e.message });
    console.error(e);
    return json(500, { message: 'Internal server error' });
  }
};
