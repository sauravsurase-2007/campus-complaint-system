'use strict';
const { HttpError } = require('./errors');

const STATUSES = ['Pending', 'In Progress', 'Resolved', 'Rejected'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const CATEGORIES = ['Hostel', 'Academic', 'Library', 'Canteen', 'Transport', 'Infrastructure', 'IT / Network', 'Sanitation', 'Security', 'Other'];

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function validateCreate(b) {
  const out = {
    title: str(b.title),
    category: str(b.category),
    priority: str(b.priority) || 'Medium',
    location: str(b.location),
    description: str(b.description),
  };
  if (out.title.length < 3 || out.title.length > 100) throw new HttpError(400, 'Title must be 3-100 characters');
  if (!CATEGORIES.includes(out.category)) throw new HttpError(400, 'Invalid category');
  if (!PRIORITIES.includes(out.priority)) throw new HttpError(400, 'Invalid priority');
  if (out.location.length > 100) throw new HttpError(400, 'Location must be at most 100 characters');
  if (out.description.length < 10 || out.description.length > 2000) throw new HttpError(400, 'Description must be 10-2000 characters');
  return out;
}

function validateUpdate(b) {
  const out = {};
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) throw new HttpError(400, 'Invalid status');
    out.status = b.status;
  }
  if (b.adminRemark !== undefined) {
    out.adminRemark = str(b.adminRemark);
    if (out.adminRemark.length > 1000) throw new HttpError(400, 'Remark must be at most 1000 characters');
  }
  if (Object.keys(out).length === 0) throw new HttpError(400, 'Provide status and/or adminRemark');
  return out;
}

module.exports = { validateCreate, validateUpdate, STATUSES, PRIORITIES, CATEGORIES };
